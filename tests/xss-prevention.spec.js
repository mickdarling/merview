// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  setCodeMirrorContent,
  renderMarkdownAndWait,
  WAIT_TIMES
} = require('./helpers/test-utils');

/**
 * XSS Prevention Tests
 *
 * Verifies that DOMPurify properly sanitizes HTML rendered from markdown.
 * Test vectors based on OWASP XSS Prevention Cheat Sheet.
 *
 * Note: javascript: URLs in test data are intentional XSS test vectors,
 * not executed code. They verify sanitization works correctly.
 */

// Dangerous content: [name, markdown, ...shouldNotContain]
const DANGEROUS_PAYLOADS = [
  ['script tag', '# Hello\n<script>alert("XSS")</script>', '<script', 'alert('],
  ['encoded script', '<script>document.location="http://evil.com"</script>', '<script', 'document.location'],
  ['img onerror', '<img src="x" onerror="alert(1)">', 'onerror'],
  ['img onload', '<img src="x.jpg" onload="alert(1)">', 'onload='],
  ['svg onload', '<svg onload="alert(1)"><circle/></svg>', 'onload'],
  ['body onload', '<body onload="alert(1)">', '<body', 'onload'],
  ['div onclick', '<div onclick="alert(1)">x</div>', 'onclick'],
  ['anchor onmouseover', '<a onmouseover="alert(1)">x</a>', 'onmouseover'],
  ['input onfocus', '<input onfocus="alert(1)" autofocus>', 'onfocus'],
  ['marquee onstart', '<marquee onstart="alert(1)">x</marquee>', 'onstart'],
  ['svg animate onbegin', '<svg><animate onbegin="alert(1)"/></svg>', 'onbegin'],
  ['svg foreignObject', '<svg><foreignObject><body onload="x"/></foreignObject></svg>', 'onload'],
  ['js url anchor', '[x](javascript:void(0))', 'javascript:'],
  ['js url img', '<img src="javascript:void(0)">', 'javascript:'],
  ['js url form', '<form action="javascript:void(0)"></form>', 'javascript:'],
  ['js url meta', '<meta http-equiv="refresh" content="0;url=javascript:0">', '<meta', 'javascript:'],
  ['js url base', '<base href="javascript:0//">', '<base'],
  ['js url table bg', '<table background="javascript:0"><tr><td/></tr></table>', 'javascript:'],
  ['js url video', '<video poster="javascript:0"></video>', 'javascript:'],
  ['js url math', '<math xlink:href="javascript:0">x</math>', 'javascript:', 'xlink:href'],
  ['data url', '<a href="data:text/html,<script>x</script>">x</a>', 'data:text/html'],
  ['iframe', '<iframe src="about:blank"></iframe>', '<iframe'],
  ['iframe srcdoc', '<iframe srcdoc="<script>x</script>"></iframe>', '<iframe', 'srcdoc'],
  ['object', '<object data="about:blank"></object>', '<object'],
  ['embed', '<embed src="about:blank">', '<embed'],
  ['link', '<link href="http://evil.com/x.css">', '<link'],
  ['svg script', '<svg><script>alert(1)</script></svg>', '<script'],
];

// Safe content: [name, markdown, shouldContain]
const SAFE_CONTENT = [
  ['paragraph', 'This is a paragraph.', '<p>this is a paragraph.</p>'],
  ['heading', '# My Heading', '<h1'],
  ['link', '[Link](https://example.com)', 'href="https://example.com"'],
  ['image', '![Alt](https://example.com/x.png)', 'src="https://example.com/x.png"'],
  ['bold', '**bold**', '<strong>bold</strong>'],
  ['italic', '*italic*', '<em>italic</em>'],
  ['code', '`snippet`', '<code>snippet</code>'],
  ['blockquote', '> Quote', '<blockquote>'],
  ['ul', '- Item', '<ul>'],
  ['ol', '1. First', '<ol>'],
  ['hr', '---', '<hr'],
  ['table', '| H |\n|---|\n| C |', '<table>'],
  ['code block', '```js\nx\n```', 'class="hljs'],
  ['mailto', '[Email](mailto:x@y.com)', 'href="mailto:x@y.com"'],
];

/** Render markdown and return lowercase wrapper HTML */
async function renderAndGetHtml(page, markdown) {
  await setCodeMirrorContent(page, markdown);
  await renderMarkdownAndWait(page, WAIT_TIMES.LONG);
  return page.$eval('#wrapper', el => el.innerHTML.toLowerCase());
}

/** Set up dialog listener to detect script execution */
function setupDialogListener(page) {
  let triggered = false;
  page.on('dialog', async d => { triggered = true; await d.dismiss(); });
  return { wasTriggered: () => triggered };
}

test.describe('XSS Prevention', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test.describe('Blocks dangerous content', () => {
    for (const [name, markdown, ...forbidden] of DANGEROUS_PAYLOADS) {
      test(`blocks ${name}`, async ({ page }) => {
        const html = await renderAndGetHtml(page, markdown);
        for (const f of forbidden) {
          expect(html, `${f} should be stripped`).not.toContain(f.toLowerCase());
        }
      });
    }
  });

  test.describe('Preserves safe content', () => {
    for (const [name, markdown, expected] of SAFE_CONTENT) {
      test(`preserves ${name}`, async ({ page }) => {
        const html = await renderAndGetHtml(page, markdown);
        expect(html, `${expected} should exist`).toContain(expected.toLowerCase());
      });
    }
  });

  test.describe('Prevents script execution', () => {
    test('blocks inline scripts', async ({ page }) => {
      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, '<script>alert(1)</script>');
      expect(listener.wasTriggered()).toBe(false);
    });

    test('blocks event handlers', async ({ page }) => {
      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, '<img src="x" onerror="alert(1)">');
      await page.waitForTimeout(500);
      expect(listener.wasTriggered()).toBe(false);
    });

    test('blocks javascript URLs', async ({ page }) => {
      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, '<a href="javascript:void(0)">x</a>');
      const link = await page.$('#wrapper a');
      if (link) await link.click().catch(() => {});
      await page.waitForTimeout(500);
      expect(listener.wasTriggered()).toBe(false);
    });
  });

  test.describe('DOMPurify integration', () => {
    test('DOMPurify is available', async ({ page }) => {
      const ok = await page.evaluate(() => typeof DOMPurify?.sanitize === 'function');
      expect(ok).toBe(true);
    });

    test('sanitize removes scripts', async ({ page }) => {
      const result = await page.evaluate(() => {
        const clean = DOMPurify.sanitize('<script>x</script><p>Safe</p>');
        return { noScript: !clean.includes('<script'), hasPara: clean.includes('<p>Safe</p>') };
      });
      expect(result.noScript).toBe(true);
      expect(result.hasPara).toBe(true);
    });
  });

  test.describe('Attribute preservation', () => {
    test('preserves class for syntax highlighting', async ({ page }) => {
      await renderAndGetHtml(page, '```py\nprint(1)\n```');
      const hasClass = await page.$eval('#wrapper code', el => el.classList.length > 0);
      expect(hasClass).toBe(true);
    });

    test('preserves id for anchors', async ({ page }) => {
      await renderAndGetHtml(page, '# Heading');
      const hasId = await page.$eval('#wrapper h1', el => el.hasAttribute('id'));
      expect(hasId).toBe(true);
    });
  });
});
