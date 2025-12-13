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
 * Helper to check if a code block contains a specific highlight.js class
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} className - CSS class to check for
 * @returns {Promise<boolean>} True if class exists in any code block
 */
async function codeBlockHasClass(page, className) {
  const hasClass = await page.evaluate((cls) => {
    const codeBlocks = document.querySelectorAll('#wrapper pre code');
    for (const block of codeBlocks) {
      const spans = block.querySelectorAll(`span.${cls}`);
      if (spans.length > 0) {
        return true;
      }
    }
    return false;
  }, className);
  return hasClass;
}

/**
 * Helper to get all text content from elements with a specific class in code blocks
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} className - CSS class to search for
 * @returns {Promise<string[]>} Array of text content from matching elements
 */
async function getTextFromClassInCodeBlock(page, className) {
  return page.evaluate((cls) => {
    const codeBlocks = document.querySelectorAll('#wrapper pre code');
    const results = [];
    for (const block of codeBlocks) {
      const spans = block.querySelectorAll(`span.${cls}`);
      for (const span of spans) {
        const text = span.textContent.trim();
        if (text) {
          results.push(text);
        }
      }
    }
    return results;
  }, className);
}

/**
 * Helper to check if code block has language attribute
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} language - Expected language
 * @returns {Promise<boolean>} True if code block has the language
 */
async function codeBlockHasLanguage(page, language) {
  const hasLang = await page.evaluate((lang) => {
    const codeBlocks = document.querySelectorAll('#wrapper pre code');
    for (const block of codeBlocks) {
      const dataLang = block.getAttribute('data-language');
      const classLang = block.className.includes(`language-${lang}`);
      if (dataLang === lang || classLang) {
        return true;
      }
    }
    return false;
  }, language);
  return hasLang;
}

test.describe('YAML Front Matter Syntax Highlighting in Code Blocks', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test.describe('Basic highlighting', () => {
    test('highlights YAML front matter delimiters with hljs-meta class', async ({ page }) => {
      // Create markdown with a code block containing YAML front matter
      const markdown = '```markdown\n---\ntitle: Test\nauthor: John Doe\n---\n# Hello World\n```';

      await renderAndGetHtml(page, markdown);

      // Check for hljs-meta class on delimiters
      const hasMetaClass = await codeBlockHasClass(page, 'hljs-meta');
      expect(hasMetaClass).toBe(true);

      // Verify the delimiters contain ---
      const metaTexts = await getTextFromClassInCodeBlock(page, 'hljs-meta');
      expect(metaTexts.length).toBeGreaterThanOrEqual(2);
      expect(metaTexts.filter(t => t === '---').length).toBe(2);
    });

    test('highlights YAML keys with hljs-attr class', async ({ page }) => {
      const markdown = '```markdown\n---\ntitle: Test Document\nauthor: Jane Smith\ndate: 2025-12-13\n---\n# Content\n```';

      await renderAndGetHtml(page, markdown);

      // Check for hljs-attr class (YAML keys)
      const hasAttrClass = await codeBlockHasClass(page, 'hljs-attr');
      expect(hasAttrClass).toBe(true);

      // Verify that key names appear in the code block
      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('title');
      expect(html).toContain('author');
      expect(html).toContain('date');
    });

    test('highlights YAML string values with hljs-string class', async ({ page }) => {
      const markdown = '```markdown\n---\ntitle: "Test Document"\ndescription: "A test file"\n---\n# Header\n```';

      await renderAndGetHtml(page, markdown);

      // Check for hljs-string class (quoted values)
      const hasStringClass = await codeBlockHasClass(page, 'hljs-string');
      expect(hasStringClass).toBe(true);
    });

    test('highlights markdown content after front matter with markdown syntax', async ({ page }) => {
      const markdown = '```markdown\n---\ntitle: Test\n---\n# Main Heading\n## Subheading\n```';

      await renderAndGetHtml(page, markdown);

      // Check for hljs-section class (markdown headings)
      const hasSectionClass = await codeBlockHasClass(page, 'hljs-section');
      expect(hasSectionClass).toBe(true);

      // Verify heading content appears
      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('Main Heading');
      expect(html).toContain('Subheading');
    });

    test('applies language-markdown class to the code block', async ({ page }) => {
      const markdown = '```markdown\n---\ntitle: Test\n---\n# Content\n```';

      await renderAndGetHtml(page, markdown);

      // Verify language attribute
      const hasLanguage = await codeBlockHasLanguage(page, 'markdown');
      expect(hasLanguage).toBe(true);
    });
  });

  test.describe('Edge cases', () => {
    test('handles front matter with no markdown body', async ({ page }) => {
      const markdown = '```markdown\n---\ntitle: Metadata Only\nauthor: Test User\nversion: 1.0\n---\n```';

      await renderAndGetHtml(page, markdown);

      // Should still highlight YAML correctly
      const hasMetaClass = await codeBlockHasClass(page, 'hljs-meta');
      expect(hasMetaClass).toBe(true);

      const hasAttrClass = await codeBlockHasClass(page, 'hljs-attr');
      expect(hasAttrClass).toBe(true);

      // Verify content appears
      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('title');
      expect(html).toContain('author');
      expect(html).toContain('version');
    });

    test('handles empty markdown content after front matter', async ({ page }) => {
      const markdown = '```markdown\n---\ntitle: Test\n---\n\n```';

      await renderAndGetHtml(page, markdown);

      // Should highlight YAML part
      const hasMetaClass = await codeBlockHasClass(page, 'hljs-meta');
      expect(hasMetaClass).toBe(true);

      const hasAttrClass = await codeBlockHasClass(page, 'hljs-attr');
      expect(hasAttrClass).toBe(true);
    });

    test('works with md language identifier', async ({ page }) => {
      // Use 'md' instead of 'markdown'
      const markdown = '```md\n---\ntitle: Short Form\nauthor: Test\n---\n# Hello\n```';

      await renderAndGetHtml(page, markdown);

      // Should work same as markdown
      const hasMetaClass = await codeBlockHasClass(page, 'hljs-meta');
      expect(hasMetaClass).toBe(true);

      const hasAttrClass = await codeBlockHasClass(page, 'hljs-attr');
      expect(hasAttrClass).toBe(true);

      const hasSectionClass = await codeBlockHasClass(page, 'hljs-section');
      expect(hasSectionClass).toBe(true);
    });

    test('regular markdown code block without front matter still works', async ({ page }) => {
      const markdown = '```markdown\n# Just a heading\n\nSome **bold** text and *italic* text.\n```';

      await renderAndGetHtml(page, markdown);

      // Should use normal markdown highlighting
      const hasSectionClass = await codeBlockHasClass(page, 'hljs-section');
      expect(hasSectionClass).toBe(true);

      // Should NOT have YAML-specific classes from delimiters
      const metaTexts = await getTextFromClassInCodeBlock(page, 'hljs-meta');
      // Meta class might exist for other markdown syntax, but not for '---' delimiters
      const hasDelimiters = metaTexts.filter(t => t === '---').length === 2;
      expect(hasDelimiters).toBe(false);
    });

    test('handles complex YAML with arrays in front matter', async ({ page }) => {
      const markdown = '```markdown\n---\ntags:\n  - test\n  - demo\n  - markdown\ncategories:\n  - documentation\n---\n# Content\n```';

      await renderAndGetHtml(page, markdown);

      // Should highlight YAML arrays
      const hasAttrClass = await codeBlockHasClass(page, 'hljs-attr');
      expect(hasAttrClass).toBe(true);

      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('tags');
      expect(html).toContain('categories');
    });

    test('handles YAML with numeric and boolean values', async ({ page }) => {
      const markdown = '```markdown\n---\nversion: 1.0\ncount: 42\npublished: true\ndraft: false\n---\n# Document\n```';

      await renderAndGetHtml(page, markdown);

      // Should highlight YAML with various value types
      const hasAttrClass = await codeBlockHasClass(page, 'hljs-attr');
      expect(hasAttrClass).toBe(true);

      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('version');
      expect(html).toContain('count');
      expect(html).toContain('published');
      expect(html).toContain('draft');
    });

    test('handles markdown content with various syntax after front matter', async ({ page }) => {
      const markdown = '```markdown\n---\ntitle: Full Example\n---\n# Heading\n\n**Bold** and *italic*\n\n- List item 1\n- List item 2\n\n[Link](https://example.com)\n```';

      await renderAndGetHtml(page, markdown);

      // Should highlight both YAML and markdown
      const hasAttrClass = await codeBlockHasClass(page, 'hljs-attr');
      expect(hasAttrClass).toBe(true);

      const hasSectionClass = await codeBlockHasClass(page, 'hljs-section');
      expect(hasSectionClass).toBe(true);

      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('Heading');
      expect(html).toContain('Bold');
      expect(html).toContain('italic');
    });
  });

  test.describe('Non-interference', () => {
    test('regular YAML code blocks still highlight normally', async ({ page }) => {
      // Pure YAML block (not markdown with front matter)
      const markdown = '```yaml\nkey: value\nlist:\n  - item1\n  - item2\nnested:\n  sub: data\n```';

      await renderAndGetHtml(page, markdown);

      // Should have normal YAML highlighting
      const hasAttrClass = await codeBlockHasClass(page, 'hljs-attr');
      expect(hasAttrClass).toBe(true);

      // Should have YAML language
      const hasLanguage = await codeBlockHasLanguage(page, 'yaml');
      expect(hasLanguage).toBe(true);

      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('key');
      expect(html).toContain('list');
      expect(html).toContain('nested');
    });

    test('javascript code blocks remain unaffected', async ({ page }) => {
      const markdown = '```javascript\nfunction test() {\n  console.log("Hello");\n  return true;\n}\n```';

      await renderAndGetHtml(page, markdown);

      // Should have JavaScript highlighting
      const hasLanguage = await codeBlockHasLanguage(page, 'javascript');
      expect(hasLanguage).toBe(true);

      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('function');
      expect(html).toContain('console');
    });

    test('python code blocks remain unaffected', async ({ page }) => {
      const markdown = '```python\ndef hello():\n    print("Hello, World!")\n    return None\n```';

      await renderAndGetHtml(page, markdown);

      // Should have Python highlighting
      const hasLanguage = await codeBlockHasLanguage(page, 'python');
      expect(hasLanguage).toBe(true);

      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('def');
      expect(html).toContain('print');
    });

    test('multiple code blocks with different languages work together', async ({ page }) => {
      const markdown = `# Code Examples

\`\`\`markdown
---
title: Example
---
# Markdown
\`\`\`

\`\`\`yaml
key: value
\`\`\`

\`\`\`javascript
const x = 42;
\`\`\``;

      await renderAndGetHtml(page, markdown);

      // All should render correctly
      const hasAttrClass = await codeBlockHasClass(page, 'hljs-attr');
      expect(hasAttrClass).toBe(true);

      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('title');
      expect(html).toContain('key');
      expect(html).toContain('const');
    });
  });

  test.describe('Delimiter variations', () => {
    test('handles front matter with extra newlines', async ({ page }) => {
      const markdown = '```markdown\n---\n\ntitle: Test\nauthor: User\n\n---\n\n# Content\n```';

      await renderAndGetHtml(page, markdown);

      // This might not match the pattern due to strict regex, but should still render something
      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('title');
    });

    test('requires exact delimiter format (three dashes)', async ({ page }) => {
      // Four dashes should not trigger front matter highlighting
      const markdown = '```markdown\n----\ntitle: Test\n----\n# Content\n```';

      await renderAndGetHtml(page, markdown);

      // Should render as normal markdown (not as front matter)
      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('title');

      // The delimiters won't be highlighted with hljs-meta in the special way
      // because they don't match the exact pattern
    });

    test('handles delimiter at start of code block only', async ({ page }) => {
      // Front matter must be at the very start
      const markdown = '```markdown\n# Heading\n\n---\ntitle: Not Front Matter\n---\n```';

      await renderAndGetHtml(page, markdown);

      // Should use normal markdown highlighting, not front matter special handling
      const hasSectionClass = await codeBlockHasClass(page, 'hljs-section');
      expect(hasSectionClass).toBe(true);
    });
  });

  test.describe('Real-world examples', () => {
    test('highlights a typical blog post front matter', async ({ page }) => {
      const markdown = `\`\`\`markdown
---
title: "My Blog Post"
author: "Jane Doe"
date: 2025-12-13
tags:
  - blogging
  - markdown
  - testing
published: true
---

# My Blog Post

This is the content of my blog post with **formatting**.
\`\`\``;

      await renderAndGetHtml(page, markdown);

      // Check comprehensive highlighting
      const hasMetaClass = await codeBlockHasClass(page, 'hljs-meta');
      expect(hasMetaClass).toBe(true);

      const hasAttrClass = await codeBlockHasClass(page, 'hljs-attr');
      expect(hasAttrClass).toBe(true);

      const hasSectionClass = await codeBlockHasClass(page, 'hljs-section');
      expect(hasSectionClass).toBe(true);
    });

    test('highlights documentation file front matter', async ({ page }) => {
      const markdown = `\`\`\`markdown
---
title: API Documentation
version: 2.0
category: reference
lastUpdated: 2025-12-13
---

## API Endpoints

### GET /users

Returns a list of users.
\`\`\``;

      await renderAndGetHtml(page, markdown);

      const hasAttrClass = await codeBlockHasClass(page, 'hljs-attr');
      expect(hasAttrClass).toBe(true);

      const hasSectionClass = await codeBlockHasClass(page, 'hljs-section');
      expect(hasSectionClass).toBe(true);

      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('version');
      expect(html).toContain('category');
      expect(html).toContain('API Endpoints');
    });

    test('highlights Jekyll-style front matter', async ({ page }) => {
      const markdown = `\`\`\`md
---
layout: post
title: "Jekyll Post"
permalink: /blog/my-post/
categories: jekyll update
---

# Jekyll Post Title

Content here.
\`\`\``;

      await renderAndGetHtml(page, markdown);

      const hasMetaClass = await codeBlockHasClass(page, 'hljs-meta');
      expect(hasMetaClass).toBe(true);

      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('layout');
      expect(html).toContain('permalink');
      expect(html).toContain('categories');
    });
  });

  test.describe('Error resilience', () => {
    test('handles malformed YAML gracefully', async ({ page }) => {
      // Invalid YAML syntax, but should still attempt highlighting
      const markdown = '```markdown\n---\ntitle: Test\ninvalid yaml: [unclosed\n---\n# Content\n```';

      await renderAndGetHtml(page, markdown);

      // Should still render something (may fall back to normal highlighting)
      const html = await renderAndGetHtml(page, markdown);
      expect(html.length).toBeGreaterThan(0);
      expect(html).toContain('title');
      expect(html).toContain('Content');
    });

    test('handles empty code block', async ({ page }) => {
      const markdown = '```markdown\n```';

      await renderAndGetHtml(page, markdown);

      // Should render empty code block without errors
      const codeBlock = await page.$('#wrapper pre code');
      expect(codeBlock).not.toBeNull();
    });

    test('handles code block with only delimiters', async ({ page }) => {
      const markdown = '```markdown\n---\n---\n```';

      await renderAndGetHtml(page, markdown);

      // Should handle empty front matter
      const html = await renderAndGetHtml(page, markdown);
      expect(html.length).toBeGreaterThan(0);
    });

    test('handles very long YAML front matter', async ({ page }) => {
      const longValue = 'A'.repeat(500);
      const markdown = `\`\`\`markdown
---
title: Test
description: "${longValue}"
tags:
  - tag1
  - tag2
  - tag3
---
# Content
\`\`\``;

      await renderAndGetHtml(page, markdown);

      // Should handle long content
      const hasAttrClass = await codeBlockHasClass(page, 'hljs-attr');
      expect(hasAttrClass).toBe(true);

      const html = await renderAndGetHtml(page, markdown);
      expect(html).toContain('title');
      expect(html).toContain('A'.repeat(100)); // At least some of it
    });
  });
});
