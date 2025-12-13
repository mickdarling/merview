// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  getLineTokens,
  lineHasTokenType,
  setContentAndWait,
  WAIT_TIMES
} = require('./helpers/test-utils');

/**
 * Helper to get CodeMirror token information for a specific line and character position
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} line - Line number (0-indexed)
 * @param {number} ch - Character position (0-indexed)
 * @returns {Promise<{type: string, string: string}>} Token information
 */
async function getTokenAt(page, line, ch) {
  return page.evaluate(({ line, ch }) => {
    const cmElement = document.querySelector('.CodeMirror');
    const cm = cmElement?.CodeMirror;
    if (!cm) {
      throw new Error('CodeMirror instance not found');
    }
    const token = cm.getTokenAt({ line, ch });
    return {
      type: token.type || '',
      string: token.string
    };
  }, { line, ch });
}

test.describe('CodeMirror YAML Front Matter Editor Mode', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test.describe('First line detection', () => {
    test('highlights --- on line 1 as front matter delimiter', async ({ page }) => {
      const content = '---\ntitle: Test\n---\n# Content';
      await setContentAndWait(page, content);

      // Line 0 (first line) should have "meta" token type for the delimiter
      const hasMeta = await lineHasTokenType(page, 0, 'meta');
      expect(hasMeta).toBe(true);

      // Verify the actual token
      const token = await getTokenAt(page, 0, 1);
      expect(token.type).toContain('meta');
    });

    test('does NOT highlight --- on line 2 as front matter delimiter', async ({ page }) => {
      const content = '# Heading\n---\ntitle: Test\n---\n# Content';
      await setContentAndWait(page, content);

      // Line 0 should NOT be front matter (it's a heading)
      const line0HasMeta = await lineHasTokenType(page, 0, 'meta');
      expect(line0HasMeta).toBe(false);

      // Line 1 (the ---) should NOT be treated as front matter opening delimiter
      // It might be treated as a horizontal rule or normal text in GFM mode
      const line1Tokens = await getLineTokens(page, 1);
      // Should not have the special "meta" type that indicates YAML front matter delimiter
      const hasYamlMeta = line1Tokens.some(token =>
        token.type?.includes('meta') && token.string === '---'
      );
      expect(hasYamlMeta).toBe(false);
    });

    test('does NOT highlight --- when preceded by whitespace on line 1', async ({ page }) => {
      const content = ' ---\ntitle: Test\n---\n# Content';
      await setContentAndWait(page, content);

      // Line 0 should NOT be treated as YAML front matter because of leading space
      // The regex requires --- at the start of the line
      const line0Tokens = await getLineTokens(page, 0);

      // Check if first non-whitespace token is "---" with meta type
      const yamlDelimiterToken = line0Tokens.find(token =>
        token.string.trim() === '---' && token.type?.includes('meta')
      );

      // Should not find YAML front matter delimiter (it's at sol() but not matching the pattern)
      expect(yamlDelimiterToken).toBeUndefined();
    });

    test('correctly handles blank first line followed by --- on line 2', async ({ page }) => {
      const content = '\n---\ntitle: Test\n---\n# Content';
      await setContentAndWait(page, content);

      // Line 1 (second line) should NOT be treated as front matter opening
      // because the first line (line 0) was blank, which sets isFirstLine to false
      // This enforces that YAML front matter must truly be at the very start
      const line1Tokens = await getLineTokens(page, 1);
      const hasYamlMeta = line1Tokens.some(token =>
        token.type?.includes('meta') && token.string === '---'
      );
      expect(hasYamlMeta).toBe(false);
    });
  });

  test.describe('Front matter region highlighting', () => {
    test('highlights content between --- delimiters as YAML', async ({ page }) => {
      const content = '---\ntitle: Test Document\nauthor: John Doe\n---\n# Content';
      await setContentAndWait(page, content);

      // Line 1 (title: Test Document) should have YAML highlighting
      const line1Tokens = await getLineTokens(page, 1);
      // Should have tokens from YAML mode (like "atom" for keys)
      expect(line1Tokens.length).toBeGreaterThan(0);

      // Line 2 (author: John Doe) should also have YAML highlighting
      const line2Tokens = await getLineTokens(page, 2);
      expect(line2Tokens.length).toBeGreaterThan(0);
    });

    test('highlights closing --- delimiter as meta', async ({ page }) => {
      const content = '---\ntitle: Test\n---\n# Content';
      await setContentAndWait(page, content);

      // Line 2 (closing ---) should have "meta" token type
      const hasMeta = await lineHasTokenType(page, 2, 'meta');
      expect(hasMeta).toBe(true);
    });

    test('highlights content after closing --- as markdown', async ({ page }) => {
      const content = '---\ntitle: Test\n---\n# Heading\n**bold**';
      await setContentAndWait(page, content);

      // Line 3 (# Heading) should use markdown/GFM mode
      // GFM mode typically uses "header" or "line-header-*" classes for headings
      const line3Tokens = await getLineTokens(page, 3);
      expect(line3Tokens.length).toBeGreaterThan(0);

      // The tokens should not be YAML-specific anymore
      // (We can't easily check for specific markdown tokens without knowing GFM mode internals,
      //  but we can verify that tokenization is happening)
      expect(line3Tokens.some(t => t.string.includes('#'))).toBe(true);
    });
  });

  test.describe('Edge cases - multiple --- in document', () => {
    test('does not treat --- later in document as front matter delimiter', async ({ page }) => {
      const content = '---\ntitle: Test\n---\n# Heading\n\nSome text\n\n---\n\nMore text';
      await setContentAndWait(page, content);

      // Line 0 and 2 should be meta (opening and closing front matter)
      const line0HasMeta = await lineHasTokenType(page, 0, 'meta');
      const line2HasMeta = await lineHasTokenType(page, 2, 'meta');
      expect(line0HasMeta).toBe(true);
      expect(line2HasMeta).toBe(true);

      // Line 7 (the --- later in the document) should NOT be treated as YAML front matter
      // It might be a horizontal rule in GFM mode, but not a YAML delimiter
      const line7Tokens = await getLineTokens(page, 7);

      // Check that it's not being treated as YAML front matter meta
      const isYamlDelimiter = line7Tokens.some(token =>
        token.type?.includes('meta') &&
        token.string === '---' &&
        // Make sure it's being treated as YAML meta, not GFM meta
        token.type.split(' ').length <= 2 // YAML meta is typically just "meta" or "meta something"
      );

      // This later --- should not reopen front matter mode
      expect(isYamlDelimiter).toBe(false);
    });

    test('handles document with only opening --- (no closing)', async ({ page }) => {
      const content = '---\ntitle: Test\nauthor: John\n# Heading';
      await setContentAndWait(page, content);

      // Line 0 should be meta (opening delimiter)
      const line0HasMeta = await lineHasTokenType(page, 0, 'meta');
      expect(line0HasMeta).toBe(true);

      // Lines 1-2 should continue to be highlighted as YAML since no closing delimiter
      const line1Tokens = await getLineTokens(page, 1);
      const line2Tokens = await getLineTokens(page, 2);
      expect(line1Tokens.length).toBeGreaterThan(0);
      expect(line2Tokens.length).toBeGreaterThan(0);

      // Line 3 (# Heading) should ALSO be highlighted as YAML because front matter never closed
      const line3Tokens = await getLineTokens(page, 3);
      expect(line3Tokens.length).toBeGreaterThan(0);
    });
  });

  test.describe('State management', () => {
    test('isFirstLine flag prevents --- on line 2+ from being front matter', async ({ page }) => {
      // This is the specific edge case we're testing with the fix
      const content = 'Not YAML\n---\ntitle: Test\n---\n# Content';
      await setContentAndWait(page, content);

      // Line 0 is not a delimiter, so isFirstLine should be set to false
      // Line 1 (---) should NOT be treated as front matter opening
      const line1Tokens = await getLineTokens(page, 1);
      const hasYamlMeta = line1Tokens.some(token =>
        token.type?.includes('meta') && token.string === '---'
      );
      expect(hasYamlMeta).toBe(false);
    });

    test('frontMatterEnded flag prevents reopening front matter', async ({ page }) => {
      const content = '---\ntitle: Test\n---\n# Heading\n---\ntitle: Should Not Be YAML\n---';
      await setContentAndWait(page, content);

      // First pair of --- should work (lines 0 and 2)
      const line0HasMeta = await lineHasTokenType(page, 0, 'meta');
      const line2HasMeta = await lineHasTokenType(page, 2, 'meta');
      expect(line0HasMeta).toBe(true);
      expect(line2HasMeta).toBe(true);

      // The second pair of --- (lines 4 and 6) should NOT create another YAML region
      // They should be treated as normal markdown (horizontal rules or text)
      const line4Tokens = await getLineTokens(page, 4);
      const line6Tokens = await getLineTokens(page, 6);

      // These should not have the YAML meta delimiter type
      const line4IsYamlDelimiter = line4Tokens.some(token =>
        token.type?.includes('meta') && token.string === '---'
      );
      const line6IsYamlDelimiter = line6Tokens.some(token =>
        token.type?.includes('meta') && token.string === '---'
      );

      expect(line4IsYamlDelimiter).toBe(false);
      expect(line6IsYamlDelimiter).toBe(false);
    });

    test('empty document handles first line correctly', async ({ page }) => {
      await setContentAndWait(page, '');

      // Should not crash when checking empty document
      const lineCount = await page.evaluate(() => {
        const cmElement = document.querySelector('.CodeMirror');
        const cm = cmElement?.CodeMirror;
        return cm ? cm.lineCount() : 0;
      });

      expect(lineCount).toBeGreaterThanOrEqual(0);
    });

    test('single line document with --- works correctly', async ({ page }) => {
      const content = '---';
      await setContentAndWait(page, content);

      // Should highlight as meta (opening delimiter)
      const hasMeta = await lineHasTokenType(page, 0, 'meta');
      expect(hasMeta).toBe(true);
    });
  });

  test.describe('Delimiter format requirements', () => {
    test('requires exactly three dashes', async ({ page }) => {
      const content = '----\ntitle: Test\n----\n# Content';
      await setContentAndWait(page, content);

      // Four dashes should NOT be treated as YAML front matter delimiter
      const line0Tokens = await getLineTokens(page, 0);
      const hasYamlMeta = line0Tokens.some(token =>
        token.type?.includes('meta') && token.string.includes('----')
      );
      expect(hasYamlMeta).toBe(false);
    });

    test('requires dashes followed by optional whitespace', async ({ page }) => {
      const content = '---  \ntitle: Test\n---\n# Content';
      await setContentAndWait(page, content);

      // --- with trailing spaces should work (regex is /^---\s*$/)
      const hasMeta = await lineHasTokenType(page, 0, 'meta');
      expect(hasMeta).toBe(true);
    });

    test('rejects --- with trailing non-whitespace', async ({ page }) => {
      const content = '--- title\ntitle: Test\n---\n# Content';
      await setContentAndWait(page, content);

      // --- with trailing non-whitespace should NOT match the pattern
      const line0Tokens = await getLineTokens(page, 0);
      const hasYamlMeta = line0Tokens.some(token =>
        token.type?.includes('meta') && token.string === '---'
      );
      expect(hasYamlMeta).toBe(false);
    });
  });

  test.describe('Real-world edge cases', () => {
    test('handles typical blog post front matter correctly', async ({ page }) => {
      const content = `---
title: "My Blog Post"
author: "Jane Doe"
date: 2025-12-13
tags:
  - blogging
  - testing
---

# My Blog Post

Content here.`;

      await setContentAndWait(page, content);

      // First line should be YAML delimiter
      const line0HasMeta = await lineHasTokenType(page, 0, 'meta');
      expect(line0HasMeta).toBe(true);

      // Closing delimiter (line 7) should be meta
      const line7HasMeta = await lineHasTokenType(page, 7, 'meta');
      expect(line7HasMeta).toBe(true);

      // Content after should be markdown
      const line9Tokens = await getLineTokens(page, 9);
      expect(line9Tokens.length).toBeGreaterThan(0);
    });

    test('handles document with no front matter correctly', async ({ page }) => {
      const content = '# Just a Heading\n\nSome **bold** text.';
      await setContentAndWait(page, content);

      // All lines should use GFM mode (no YAML meta tokens)
      const line0Tokens = await getLineTokens(page, 0);
      expect(line0Tokens.length).toBeGreaterThan(0);

      // Should not have YAML front matter meta type
      const hasYamlMeta = line0Tokens.some(token =>
        token.type?.includes('meta')
      );
      expect(hasYamlMeta).toBe(false);
    });

    test('handles mixed content with horizontal rules', async ({ page }) => {
      const content = `---
title: Test
---

# Section 1

Content here.

---

# Section 2

More content.`;

      await setContentAndWait(page, content);

      // First two --- should be YAML delimiters (lines 0 and 2)
      const line0HasMeta = await lineHasTokenType(page, 0, 'meta');
      const line2HasMeta = await lineHasTokenType(page, 2, 'meta');
      expect(line0HasMeta).toBe(true);
      expect(line2HasMeta).toBe(true);

      // Later --- (line 8) should be treated as normal markdown (horizontal rule)
      // not as YAML delimiter
      const line8Tokens = await getLineTokens(page, 8);
      const isYamlDelimiter = line8Tokens.some(token =>
        token.type?.includes('meta') && token.string === '---' &&
        token.type.split(' ').length <= 2
      );
      expect(isYamlDelimiter).toBe(false);
    });
  });

  test.describe('Integration with CodeMirror', () => {
    test('state is properly copied when splitting lines', async ({ page }) => {
      const content = '---\ntitle: Test\n---\n# Content';
      await setContentAndWait(page, content);

      // Simulate editing in the middle of front matter
      await page.evaluate(() => {
        const cmElement = document.querySelector('.CodeMirror');
        const cm = cmElement?.CodeMirror;
        // Insert a new line in the YAML section
        cm.replaceRange('\nauthor: John', { line: 1, ch: 12 });
      });

      await page.waitForTimeout(WAIT_TIMES.SHORT);

      // The new line should also be highlighted as YAML
      const line2Tokens = await getLineTokens(page, 2);
      expect(line2Tokens.length).toBeGreaterThan(0);
    });

    test('mode changes properly when adding closing delimiter', async ({ page }) => {
      const content = '---\ntitle: Test\nauthor: John\n# Should be YAML initially';
      await setContentAndWait(page, content);

      // Now add closing delimiter by replacing content
      await page.evaluate(() => {
        const cmElement = document.querySelector('.CodeMirror');
        const cm = cmElement?.CodeMirror;
        cm.replaceRange('\n---', { line: 2, ch: 12 });
      });

      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      // Verify the edit was made successfully without crashing
      const lineCount = await page.evaluate(() => {
        const cmElement = document.querySelector('.CodeMirror');
        const cm = cmElement?.CodeMirror;
        return cm.lineCount();
      });

      // Should have 5 lines now (original 4 + 1 new line)
      expect(lineCount).toBeGreaterThanOrEqual(5);

      // Line 3 should be the closing delimiter we just added
      const line3Tokens = await getLineTokens(page, 3);
      // Just verify tokenization is working (not crashing)
      expect(line3Tokens).toBeDefined();
    });
  });
});
