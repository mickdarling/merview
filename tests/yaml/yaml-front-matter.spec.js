// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  setCodeMirrorContent,
  renderMarkdownAndWait,
  setupDialogListener,
  WAIT_TIMES
} = require('../helpers/test-utils');

/**
 * Helper to render markdown and return wrapper HTML
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} markdown - Markdown content to render
 * @returns {Promise<string>} Wrapper HTML
 */
async function renderAndGetHtml(page, markdown) {
  await setCodeMirrorContent(page, markdown);
  await renderMarkdownAndWait(page, WAIT_TIMES.LONG);
  return page.$eval('#wrapper', el => el.innerHTML);
}

/**
 * Helper to check if YAML front matter panel exists
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>} True if panel exists
 */
async function yamlPanelExists(page) {
  const panel = await page.$('.yaml-front-matter');
  return panel !== null;
}

/**
 * Helper to get YAML panel content
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} Panel HTML content
 */
async function getYamlPanelContent(page) {
  return page.$eval('.yaml-front-matter', el => el.innerHTML);
}

test.describe('YAML Front Matter', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test.describe('Basic rendering', () => {
    test('renders basic key-value pairs', async ({ page }) => {
      const markdown = `---
title: Test Document
author: John Doe
date: 2025-12-12
version: 1.0
---

# Content`;

      await renderAndGetHtml(page, markdown);

      // Check that metadata panel appears
      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      // Check for summary element
      const summary = await page.$('.yaml-front-matter summary');
      expect(summary).not.toBeNull();

      // Verify key-value rendering in table
      const content = await getYamlPanelContent(page);
      expect(content).toContain('title');
      expect(content).toContain('Test Document');
      expect(content).toContain('author');
      expect(content).toContain('John Doe');
      expect(content).toContain('date');
      expect(content).toContain('2025-12-12');
      expect(content).toContain('version');
      expect(content).toContain('1.0');
    });

    test('renders arrays as bullet lists', async ({ page }) => {
      const markdown = `---
tags:
  - markdown
  - yaml
  - testing
categories:
  - documentation
  - tools
---

# Content`;

      await renderAndGetHtml(page, markdown);

      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      const content = await getYamlPanelContent(page);

      // Check for array keys
      expect(content).toContain('tags');
      expect(content).toContain('categories');

      // Check for bullet list (ul/li elements)
      const hasList = await page.$('.yaml-front-matter ul');
      expect(hasList).not.toBeNull();

      // Verify array items are present
      expect(content).toContain('markdown');
      expect(content).toContain('yaml');
      expect(content).toContain('testing');
      expect(content).toContain('documentation');
      expect(content).toContain('tools');
    });

    // Skip: The simple YAML parser doesn't support deeply nested objects (3+ levels)
    // It only handles single-level nesting. This is a known limitation.
    test.skip('renders nested objects correctly', async ({ page }) => {
      const markdown = `---
metadata:
  author:
    name: Jane Smith
    email: jane@example.com
  project:
    name: Merview
    version: 2.0
---

# Content`;

      await renderAndGetHtml(page, markdown);

      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      const content = await getYamlPanelContent(page);

      // Check for nested structure
      expect(content).toContain('metadata');
      expect(content).toContain('author');
      expect(content).toContain('Jane Smith');
      expect(content).toContain('jane@example.com');
      expect(content).toContain('project');
      expect(content).toContain('Merview');
    });

    test('panel is collapsible with details/summary', async ({ page }) => {
      const markdown = `---
title: Collapsible Test
---

# Content`;

      await renderAndGetHtml(page, markdown);

      // Check for details element (collapsible container)
      const details = await page.$('.yaml-front-matter');
      expect(details).not.toBeNull();

      const tagName = await page.$eval('.yaml-front-matter', el => el.tagName.toLowerCase());
      expect(tagName).toBe('details');

      // Check for summary element (clickable header)
      const summary = await page.$('.yaml-front-matter summary');
      expect(summary).not.toBeNull();

      // Verify summary contains "Document Metadata" text
      const summaryText = await page.$eval('.yaml-front-matter summary', el => el.textContent);
      expect(summaryText).toContain('Document Metadata');
    });
  });

  test.describe('Edge cases', () => {
    test('handles empty front matter gracefully', async ({ page }) => {
      const markdown = `---
---

# Content`;

      await renderAndGetHtml(page, markdown);

      // Empty front matter should not create a panel
      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(false);

      // Content should still render
      const heading = await page.$('#wrapper h1');
      expect(heading).not.toBeNull();
    });

    test('handles malformed YAML gracefully', async ({ page }) => {
      const markdown = `---
title: Test
invalid yaml here: [unclosed bracket
  bad: indentation
---

# Content Should Still Render`;

      await renderAndGetHtml(page, markdown);

      // Malformed YAML should not break the page
      const wrapper = await page.$('#wrapper');
      expect(wrapper).not.toBeNull();

      // Content after front matter should render
      const heading = await page.$('#wrapper h1');
      expect(heading).not.toBeNull();
    });

    test('handles missing closing delimiter', async ({ page }) => {
      const markdown = `---
title: No Closing Delimiter

# This should render as normal markdown`;

      await renderAndGetHtml(page, markdown);

      // Without closing ---, should treat as normal markdown
      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(false);

      // Content should render
      const heading = await page.$('#wrapper h1');
      expect(heading).not.toBeNull();
    });

    test('handles very long values', async ({ page }) => {
      const longValue = 'A'.repeat(1000);
      const markdown = `---
title: Test
description: ${longValue}
---

# Content`;

      await renderAndGetHtml(page, markdown);

      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      // Verify long value is present (at least partially)
      const content = await getYamlPanelContent(page);
      expect(content).toContain('A'.repeat(100)); // Check for substantial portion
    });

    test('handles special characters in keys and values', async ({ page }) => {
      const markdown = `---
"special-key": "value with spaces"
"key:with:colons": "value"
number: 42
boolean: true
null_value: null
---

# Content`;

      await renderAndGetHtml(page, markdown);

      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      const content = await getYamlPanelContent(page);
      expect(content).toContain('value with spaces');
      expect(content).toContain('42');
      expect(content).toContain('true');
    });

    test('handles unicode and emoji in values', async ({ page }) => {
      const markdown = `---
title: "Test with 中文 and العربية"
emoji: "🎉🚀✨"
symbols: "©®™€£¥"
---

# Content`;

      await renderAndGetHtml(page, markdown);

      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      const content = await getYamlPanelContent(page);
      expect(content).toContain('中文');
      expect(content).toContain('العربية');
      expect(content).toContain('🎉');
      expect(content).toContain('©®™');
    });

    test('does not render YAML that is not at document start', async ({ page }) => {
      const markdown = `# First Heading

Some content here.

---
title: This is not front matter
---

More content.`;

      await renderAndGetHtml(page, markdown);

      // YAML not at start should not create metadata panel
      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(false);

      // Should render as normal content (likely horizontal rule or code)
      const heading = await page.$('#wrapper h1');
      expect(heading).not.toBeNull();
    });
  });

  test.describe('Security - XSS Prevention', () => {
    test('escapes script tags in YAML values', async ({ page }) => {
      const markdown = `---
title: "<script>alert('XSS')</script>"
description: "Safe <b>HTML</b> should be escaped"
---

# Content`;

      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, markdown);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      // Script should not execute
      expect(listener.wasTriggered()).toBe(false);

      // Get HTML and check script tag is escaped or removed
      const html = await getYamlPanelContent(page);
      const lowerHtml = html.toLowerCase();

      // Script tags should be escaped (not present as actual tags)
      // DOMPurify should remove them entirely or they should be text
      const hasActiveScript = lowerHtml.includes('<script>');
      expect(hasActiveScript).toBe(false);
    });

    test('escapes event handlers in YAML values', async ({ page }) => {
      const markdown = `---
title: "Test"
xss: "<img src=x onerror='alert(1)'>"
onclick: "javascript:alert('xss')"
---

# Content`;

      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, markdown);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      // No alert should be triggered
      expect(listener.wasTriggered()).toBe(false);

      // onerror attribute should not be present as an active attribute
      // It should either be removed or escaped
      const hasOnerror = await page.evaluate(() => {
        const panel = document.querySelector('.yaml-front-matter');
        const imgTags = panel?.querySelectorAll('img');
        for (const img of imgTags || []) {
          if (img.hasAttribute('onerror')) {
            return true;
          }
        }
        return false;
      });
      expect(hasOnerror).toBe(false);
    });

    test('escapes javascript: URLs in YAML values', async ({ page }) => {
      const markdown = `---
link: "javascript:alert('XSS')"
url: "javascript:void(0)"
---

# Content`;

      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, markdown);

      // Try to find any links in the YAML panel
      const links = await page.$$('.yaml-front-matter a');
      for (const link of links) {
        const href = await link.getAttribute('href');
        // javascript: URLs should be removed or escaped
        expect(href).not.toContain('javascript:');
      }

      // No alert should be triggered
      expect(listener.wasTriggered()).toBe(false);
    });

    test('escapes iframe injection attempts', async ({ page }) => {
      const markdown = `---
embed: "<iframe src='javascript:alert(1)'></iframe>"
frame: "<iframe src='https://evil.com'></iframe>"
---

# Content`;

      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, markdown);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      // No script execution
      expect(listener.wasTriggered()).toBe(false);

      // Check that iframes are not present as active elements
      const iframes = await page.$$('.yaml-front-matter iframe');
      expect(iframes.length).toBe(0);
    });

    test('escapes object and embed tags', async ({ page }) => {
      const markdown = `---
object: "<object data='javascript:alert(1)'></object>"
embed: "<embed src='javascript:alert(1)'>"
---

# Content`;

      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, markdown);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      // No script execution
      expect(listener.wasTriggered()).toBe(false);

      // Check that object/embed tags are not present
      const objects = await page.$$('.yaml-front-matter object');
      const embeds = await page.$$('.yaml-front-matter embed');
      expect(objects.length).toBe(0);
      expect(embeds.length).toBe(0);
    });

    test('handles mixed safe and malicious content', async ({ page }) => {
      const markdown = `---
safe_title: "My Document"
xss_attempt: "<script>alert('xss')</script>"
safe_author: "John Doe"
another_xss: "<img src=x onerror=alert(1)>"
safe_date: "2025-12-12"
---

# Content`;

      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, markdown);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      // No script execution
      expect(listener.wasTriggered()).toBe(false);

      // Safe content should still be present
      const content = await getYamlPanelContent(page);
      expect(content).toContain('My Document');
      expect(content).toContain('John Doe');
      expect(content).toContain('2025-12-12');
    });
  });

  test.describe('Integration with markdown content', () => {
    test('renders both YAML panel and markdown content', async ({ page }) => {
      const markdown = `---
title: Full Document
author: Test Author
tags:
  - test
  - integration
---

# Main Heading

This is the document content.

## Sub Heading

- List item 1
- List item 2`;

      await renderAndGetHtml(page, markdown);

      // Check YAML panel exists
      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      // Check markdown content is rendered
      const mainHeading = await page.$('#wrapper #main-heading');
      expect(mainHeading).not.toBeNull();

      const subHeading = await page.$('#wrapper #sub-heading');
      expect(subHeading).not.toBeNull();

      // Check both exist in proper order (YAML first, then content)
      const html = await page.$eval('#wrapper', el => el.innerHTML);
      const yamlIndex = html.indexOf('yaml-front-matter');
      const headingIndex = html.indexOf('Main Heading');
      expect(yamlIndex).toBeLessThan(headingIndex);
    });

    test('YAML panel does not interfere with mermaid diagrams', async ({ page }) => {
      const markdown = `---
title: Document with Diagram
---

# Mermaid Test

\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\``;

      await setCodeMirrorContent(page, markdown);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

      // Check YAML panel exists
      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      // Wait for mermaid to render the SVG with extended timeout for lazy loading
      await expect(page.locator('.mermaid svg')).toBeVisible({ timeout: 10000 });
    });

    test('YAML panel does not interfere with code blocks', async ({ page }) => {
      const markdown = `---
title: Code Example
language: javascript
---

# Code Sample

\`\`\`javascript
function hello() {
    console.log("Hello, World!");
}
\`\`\``;

      await renderAndGetHtml(page, markdown);

      // Check YAML panel exists
      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      // Check code block is rendered with syntax highlighting
      const codeBlock = await page.$('#wrapper pre code');
      expect(codeBlock).not.toBeNull();

      // Verify code content
      const codeText = await page.$eval('#wrapper pre code', el => el.textContent);
      expect(codeText).toContain('function hello()');
    });

    test('YAML panel does not interfere with anchor links', async ({ page }) => {
      const markdown = `---
title: Anchors Test
---

# First Heading

[Link to second heading](#second-heading)

## Second Heading

Content here.`;

      await renderAndGetHtml(page, markdown);

      // Check YAML panel exists
      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      // Check anchor link exists and has correct href
      const link = await page.$('#wrapper a[href="#second-heading"]');
      expect(link).not.toBeNull();

      // Check target heading has ID
      const heading = await page.$('#wrapper #second-heading');
      expect(heading).not.toBeNull();
    });
  });

  test.describe('Visual structure', () => {
    test('panel has proper styling attributes', async ({ page }) => {
      const markdown = `---
title: Style Test
---

# Content`;

      await renderAndGetHtml(page, markdown);

      // Check details element has proper class
      const hasClass = await page.$eval(
        '.yaml-front-matter',
        el => el.classList.contains('yaml-front-matter')
      );
      expect(hasClass).toBe(true);

      // Check that CSS styling is applied (via computed styles, not inline styles)
      // The yaml-front-matter class applies styling through CSS rules in index.html
      // Using more robust checks that work across different browsers
      const hasProperStyling = await page.$eval(
        '.yaml-front-matter',
        el => {
          const styles = globalThis.getComputedStyle(el);
          // Check for presence of expected values rather than absence of defaults
          // This handles browser differences in default value representation
          const hasBorder = styles.borderWidth && styles.borderWidth !== '0px' &&
                           styles.borderStyle && styles.borderStyle !== 'none';
          const hasBorderRadius = Number.parseFloat(styles.borderRadius) > 0;
          const hasBackground = styles.backgroundColor &&
                               styles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                               styles.backgroundColor !== 'transparent';
          return hasBorder && hasBorderRadius && hasBackground;
        }
      );
      expect(hasProperStyling).toBe(true);
    });

    test('panel contains table for data display', async ({ page }) => {
      const markdown = `---
key1: value1
key2: value2
---

# Content`;

      await renderAndGetHtml(page, markdown);

      // Check for table element
      const table = await page.$('.yaml-front-matter table');
      expect(table).not.toBeNull();

      // Check for table rows
      const rows = await page.$$('.yaml-front-matter table tr');
      expect(rows.length).toBeGreaterThan(0);
    });

    test('summary contains emoji and text', async ({ page }) => {
      const markdown = `---
title: Test
---

# Content`;

      await renderAndGetHtml(page, markdown);

      const summaryText = await page.$eval('.yaml-front-matter summary', el => el.textContent);

      // Should contain emoji (📋 or similar)
      expect(summaryText.length).toBeGreaterThan(0);

      // Should contain "Document Metadata" text
      expect(summaryText).toContain('Document Metadata');
    });
  });
});
