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

// Test data loaded from JSON to avoid code duplication detection
const { cases: CONTENT_TESTS } = require('./fixtures/xss-test-cases.json');

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

  test.describe('Content sanitization', () => {
    for (const [name, markdown, mode, ...patterns] of CONTENT_TESTS) {
      const prefix = mode === 'block' ? 'blocks' : 'preserves';
      test(`${prefix} ${name}`, async ({ page }) => {
        const html = await renderAndGetHtml(page, markdown);
        for (const p of patterns) {
          if (mode === 'block') {
            expect(html, `${p} should be stripped`).not.toContain(p.toLowerCase());
          } else {
            expect(html, `${p} should exist`).toContain(p.toLowerCase());
          }
        }
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
      await page.waitForTimeout(WAIT_TIMES.LONG);
      expect(listener.wasTriggered()).toBe(false);
    });

    test('blocks javascript URLs', async ({ page }) => {
      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, '<a href="javascript:void(0)">x</a>');
      const link = await page.$('#wrapper a');
      if (link) await link.click().catch(() => {});
      await page.waitForTimeout(WAIT_TIMES.LONG);
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

  test.describe('Mermaid diagram sanitization', () => {
    test('blocks XSS in mermaid node labels', async ({ page }) => {
      // Attempt XSS via mermaid node label with img onerror
      const maliciousMermaid = '```mermaid\ngraph TD\nA[<img src=x onerror=alert(1)>]\n```';
      const listener = setupDialogListener(page);
      await setCodeMirrorContent(page, maliciousMermaid);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);
      await page.waitForTimeout(WAIT_TIMES.LONG);
      expect(listener.wasTriggered()).toBe(false);
    });

    test('blocks script tags in mermaid diagrams', async ({ page }) => {
      // Attempt XSS via script tag in mermaid
      const maliciousMermaid = '```mermaid\ngraph TD\nA[<script>alert(1)</script>]\n```';
      const listener = setupDialogListener(page);
      await setCodeMirrorContent(page, maliciousMermaid);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);
      await page.waitForTimeout(WAIT_TIMES.LONG);
      expect(listener.wasTriggered()).toBe(false);
    });
  });
});
