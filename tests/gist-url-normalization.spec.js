// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests for Gist URL normalization (Issue #107)
 *
 * The normalization feature should:
 * - Convert gist.github.com URLs to gist.githubusercontent.com/raw URLs
 * - Preserve query parameters and fragments
 * - Handle URLs with and without filenames
 * - Leave non-gist URLs unchanged
 * - Work for both markdown and CSS loading
 */

/**
 * Helper to test URL normalization
 * @param {import('@playwright/test').Page} page
 * @param {string} url - URL to normalize
 * @returns {Promise<string>} - Normalized URL
 */
async function testNormalizeGistUrl(page, url) {
  return page.evaluate((testUrl) => {
    // @ts-ignore - normalizeGistUrl is defined in the app
    return globalThis.normalizeGistUrl(testUrl);
  }, url);
}

test.describe('Gist URL Normalization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.CodeMirror', { timeout: 15000 });
  });

  test.describe('Basic Transformations', () => {
    test('should transform gist.github.com/{user}/{id} to raw URL', async ({ page }) => {
      const input = 'https://gist.github.com/splch/cc419f65d0bedd84ff29f2aa1db9273a';
      const expected = 'https://gist.githubusercontent.com/splch/cc419f65d0bedd84ff29f2aa1db9273a/raw';

      const result = await testNormalizeGistUrl(page, input);
      expect(result).toBe(expected);
    });

    test('should transform gist.github.com/{user}/{id}/{filename} to raw URL with filename', async ({ page }) => {
      const input = 'https://gist.github.com/user/abc123/readability.css';
      const expected = 'https://gist.githubusercontent.com/user/abc123/raw/readability.css';

      const result = await testNormalizeGistUrl(page, input);
      expect(result).toBe(expected);
    });

    test('should handle gist URLs with multiple path segments after ID', async ({ page }) => {
      const input = 'https://gist.github.com/user/abc123/path/to/file.md';
      const expected = 'https://gist.githubusercontent.com/user/abc123/raw/path/to/file.md';

      const result = await testNormalizeGistUrl(page, input);
      expect(result).toBe(expected);
    });

    test('should handle trailing slashes', async ({ page }) => {
      const input = 'https://gist.github.com/splch/cc419f65d0bedd84ff29f2aa1db9273a/';
      const expected = 'https://gist.githubusercontent.com/splch/cc419f65d0bedd84ff29f2aa1db9273a/raw';

      const result = await testNormalizeGistUrl(page, input);
      expect(result).toBe(expected);
    });
  });

  test.describe('Query Parameters and Fragments', () => {
    test('should preserve query parameters', async ({ page }) => {
      const input = 'https://gist.github.com/user/abc123?foo=bar&baz=qux';
      const expected = 'https://gist.githubusercontent.com/user/abc123/raw?foo=bar&baz=qux';

      const result = await testNormalizeGistUrl(page, input);
      expect(result).toBe(expected);
    });

    test('should preserve URL fragments', async ({ page }) => {
      const input = 'https://gist.github.com/user/abc123#section';
      const expected = 'https://gist.githubusercontent.com/user/abc123/raw#section';

      const result = await testNormalizeGistUrl(page, input);
      expect(result).toBe(expected);
    });

    test('should preserve both query params and fragments', async ({ page }) => {
      const input = 'https://gist.github.com/user/abc123/file.css?version=2#L10-L20';
      const expected = 'https://gist.githubusercontent.com/user/abc123/raw/file.css?version=2#L10-L20';

      const result = await testNormalizeGistUrl(page, input);
      expect(result).toBe(expected);
    });
  });

  test.describe('Non-Gist URLs', () => {
    test('should leave raw.githubusercontent.com URLs unchanged', async ({ page }) => {
      const url = 'https://raw.githubusercontent.com/user/repo/main/file.md';
      const result = await testNormalizeGistUrl(page, url);
      expect(result).toBe(url);
    });

    test('should leave gist.githubusercontent.com raw URLs unchanged', async ({ page }) => {
      const url = 'https://gist.githubusercontent.com/user/abc123/raw/file.md';
      const result = await testNormalizeGistUrl(page, url);
      expect(result).toBe(url);
    });

    test('should leave github.com URLs unchanged', async ({ page }) => {
      const url = 'https://github.com/user/repo/blob/main/README.md';
      const result = await testNormalizeGistUrl(page, url);
      expect(result).toBe(url);
    });

    test('should leave CDN URLs unchanged', async ({ page }) => {
      const urls = [
        'https://cdn.jsdelivr.net/npm/package@1.0.0/file.css',
        'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css',
        'https://unpkg.com/package@1.0.0/dist/style.css'
      ];

      for (const url of urls) {
        const result = await testNormalizeGistUrl(page, url);
        expect(result).toBe(url);
      }
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle invalid URLs gracefully', async ({ page }) => {
      const invalidUrls = [
        'not-a-url',
        'gist.github.com/incomplete',  // No protocol
        'https://gist.github.com',  // No user/id
        'https://gist.github.com/onlyuser'  // Only user, no ID
      ];

      for (const url of invalidUrls) {
        const result = await testNormalizeGistUrl(page, url);
        // Should return original URL unchanged
        expect(result).toBe(url);
      }
    });

    test('should handle empty string', async ({ page }) => {
      const result = await testNormalizeGistUrl(page, '');
      expect(result).toBe('');
    });

    test('should handle gist URLs with unusual but valid IDs', async ({ page }) => {
      // GitHub gist IDs can contain alphanumeric characters
      const input = 'https://gist.github.com/user/abc123def456';
      const expected = 'https://gist.githubusercontent.com/user/abc123def456/raw';

      const result = await testNormalizeGistUrl(page, input);
      expect(result).toBe(expected);
    });

    test('should handle usernames with hyphens and underscores', async ({ page }) => {
      const input = 'https://gist.github.com/user-name_123/abc123';
      const expected = 'https://gist.githubusercontent.com/user-name_123/abc123/raw';

      const result = await testNormalizeGistUrl(page, input);
      expect(result).toBe(expected);
    });
  });

  test.describe('Integration with URL Loading', () => {
    test('normalized gist URLs should pass domain validation', async ({ page }) => {
      const gistUrl = 'https://gist.github.com/user/abc123/style.css';

      // First normalize
      const normalized = await testNormalizeGistUrl(page, gistUrl);
      expect(normalized).toContain('gist.githubusercontent.com');

      // Then validate (should pass because gist.githubusercontent.com is in allowlist)
      const isAllowed = await page.evaluate((url) => {
        // @ts-ignore - isAllowedCSSURL is defined in the app
        return globalThis.isAllowedCSSURL(url);
      }, normalized);

      expect(isAllowed).toBe(true);
    });

    test('normalized gist URLs for markdown should pass validation', async ({ page }) => {
      const gistUrl = 'https://gist.github.com/user/abc123/notes.md';

      // First normalize
      const normalized = await testNormalizeGistUrl(page, gistUrl);
      expect(normalized).toContain('gist.githubusercontent.com');

      // Then validate
      const isAllowed = await page.evaluate((url) => {
        // @ts-ignore - isAllowedMarkdownURL is defined in the app
        return globalThis.isAllowedMarkdownURL(url);
      }, normalized);

      expect(isAllowed).toBe(true);
    });

    test('original gist.github.com URLs should NOT pass validation directly', async ({ page }) => {
      // Without normalization, gist.github.com is not in the allowlist
      const gistUrl = 'https://gist.github.com/user/abc123/style.css';

      const isAllowed = await page.evaluate((url) => {
        // @ts-ignore - isAllowedCSSURL is defined in the app
        return globalThis.isAllowedCSSURL(url);
      }, gistUrl);

      // Should fail because gist.github.com is not in ALLOWED_CSS_DOMAINS
      expect(isAllowed).toBe(false);
    });
  });

  test.describe('Real-World Examples', () => {
    test('should handle the example from issue #107', async ({ page }) => {
      // The exact example from the issue description
      const input = 'https://gist.github.com/splch/cc419f65d0bedd84ff29f2aa1db9273a';
      const result = await testNormalizeGistUrl(page, input);

      // Should transform to raw URL (GitHub will redirect to latest revision)
      expect(result).toBe('https://gist.githubusercontent.com/splch/cc419f65d0bedd84ff29f2aa1db9273a/raw');
      expect(result).toContain('gist.githubusercontent.com');
      expect(result).toContain('/raw');
    });

    test('should handle gist URLs with specific file revisions', async ({ page }) => {
      // Users might paste a URL with revision ID in query params
      const input = 'https://gist.github.com/user/abc123?file=style.css';
      const expected = 'https://gist.githubusercontent.com/user/abc123/raw?file=style.css';

      const result = await testNormalizeGistUrl(page, input);
      expect(result).toBe(expected);
    });
  });

  test.describe('URL Loading Flow', () => {
    test('should apply normalization before validation in markdown loading', async ({ page }) => {
      // This tests that the integration is correct
      // We're verifying the functions are called in the right order

      const testUrl = 'https://gist.github.com/user/abc123/test.md';

      // Simulate what loadMarkdownFromURL does
      const result = await page.evaluate((url) => {
        // @ts-ignore - normalizeGistUrl and isAllowedMarkdownURL are defined
        const normalized = globalThis.normalizeGistUrl(url);
        const isAllowed = globalThis.isAllowedMarkdownURL(normalized);
        return { normalized, isAllowed };
      }, testUrl);

      expect(result.normalized).toContain('gist.githubusercontent.com/user/abc123/raw/test.md');
      expect(result.isAllowed).toBe(true);
    });

    test('should apply normalization before validation in CSS loading', async ({ page }) => {
      const testUrl = 'https://gist.github.com/user/abc123/style.css';

      // Simulate what loadCSSFromURL does
      const result = await page.evaluate((url) => {
        // @ts-ignore - normalizeGistUrl and isAllowedCSSURL are defined
        const normalized = globalThis.normalizeGistUrl(url);
        const isAllowed = globalThis.isAllowedCSSURL(normalized);
        return { normalized, isAllowed };
      }, testUrl);

      expect(result.normalized).toContain('gist.githubusercontent.com/user/abc123/raw/style.css');
      expect(result.isAllowed).toBe(true);
    });
  });
});
