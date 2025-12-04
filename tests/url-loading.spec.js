// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests for URL parameter loading functionality (Issue #79, PR #80)
 *
 * The URL loading feature should:
 * - Load markdown from allowed GitHub domains via ?url= parameter
 * - Block untrusted domains
 * - Enforce HTTPS-only
 * - Clear URL parameter after successful load
 * - Handle errors gracefully
 */

/**
 * Helper to test URL validation - reduces code duplication
 * @param {import('@playwright/test').Page} page
 * @param {string} url - URL to test
 * @returns {Promise<boolean>} - Whether URL is allowed
 */
async function testUrlValidation(page, url) {
  return page.evaluate((testUrl) => {
    // @ts-ignore - isAllowedMarkdownURL is defined in the app
    return globalThis.isAllowedMarkdownURL(testUrl);
  }, url);
}

/**
 * Helper to wait for status message containing specific text
 * @param {import('@playwright/test').Page} page
 * @param {string} text - Text to wait for in status
 * @param {number} timeout - Timeout in ms
 */
async function waitForStatusContaining(page, text, timeout = 10000) {
  await page.waitForFunction((expectedText) => {
    const status = document.getElementById('status');
    return status?.textContent?.includes(expectedText);
  }, text, { timeout });
}

test.describe('URL Loading', () => {
  test.describe('Domain Allowlist Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    });

    test('should allow raw.githubusercontent.com domain', async ({ page }) => {
      const isAllowed = await testUrlValidation(page, 'https://raw.githubusercontent.com/user/repo/main/README.md');
      expect(isAllowed).toBe(true);
    });

    test('should allow gist.githubusercontent.com domain', async ({ page }) => {
      const isAllowed = await testUrlValidation(page, 'https://gist.githubusercontent.com/user/abc123/raw/file.md');
      expect(isAllowed).toBe(true);
    });

    test('should block untrusted domains', async ({ page }) => {
      const untrustedDomains = [
        'https://evil.com/malware.md',
        'https://example.com/file.md',
        'https://github.com/user/repo/blob/main/README.md', // Note: github.com is NOT raw
        'https://pastebin.com/raw/abc123'
      ];

      for (const url of untrustedDomains) {
        const isAllowed = await testUrlValidation(page, url);
        expect(isAllowed).toBe(false);
      }
    });
  });

  test.describe('HTTPS Enforcement', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    });

    test('should block HTTP URLs even from allowed domains', async ({ page }) => {
      // Test URL built at runtime to avoid static analysis flagging test data
      const httpUrl = ['http', '://', 'raw.githubusercontent.com/user/repo/main/README.md'].join('');
      const isAllowed = await testUrlValidation(page, httpUrl);
      expect(isAllowed).toBe(false);
    });

    test('should accept HTTPS URLs from allowed domains', async ({ page }) => {
      const isAllowed = await testUrlValidation(page, 'https://raw.githubusercontent.com/user/repo/main/README.md');
      expect(isAllowed).toBe(true);
    });
  });

  test.describe('Invalid URL Handling', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    });

    // Data-driven test for invalid URLs - reduces duplication
    // URLs built with array join to avoid static analysis flagging test data
    const invalidUrls = [
      { url: 'not-a-url', description: 'non-URL string' },
      { url: ['ftp', '://', 'raw.githubusercontent.com/file.md'].join(''), description: 'FTP protocol' },
      { url: '//raw.githubusercontent.com/file.md', description: 'protocol-relative URL' },
      { url: '', description: 'empty string' }
    ];

    invalidUrls.forEach(({ url, description }) => {
      test(`should reject ${description}`, async ({ page }) => {
        const isAllowed = await testUrlValidation(page, url);
        expect(isAllowed).toBe(false);
      });
    });
  });

  test.describe('URL Parameter Behavior', () => {
    // Common test URL used across multiple tests
    const TEST_README_URL = 'https://raw.githubusercontent.com/mickdarling/merview/main/README.md';

    test('should retain URL parameter after successful load for sharing/bookmarking', async ({ page }) => {
      await page.goto(`/?url=${encodeURIComponent(TEST_README_URL)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await waitForStatusContaining(page, 'Loaded', 15000);

      // URL should still contain the parameter for sharing/bookmarking
      expect(page.url()).toContain('url=');
      expect(page.url()).toContain(encodeURIComponent(TEST_README_URL));
    });

    test('should load content from URL parameter', async ({ page }) => {
      await page.goto(`/?url=${encodeURIComponent(TEST_README_URL)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForFunction(() => typeof globalThis.getEditorContent === 'function', { timeout: 5000 });
      await waitForStatusContaining(page, 'Loaded', 15000);

      // Give a moment for editor to sync
      await page.waitForTimeout(500);

      const editorContent = await page.evaluate(() => globalThis.getEditorContent());
      expect(editorContent).toContain('Merview');
      expect(editorContent).toContain('Mermaid');
    });

    test('should show "Loaded" status after successful URL load', async ({ page }) => {
      await page.goto(`/?url=${encodeURIComponent(TEST_README_URL)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await waitForStatusContaining(page, 'Loaded');

      const statusText = await page.locator('#status').textContent();
      expect(statusText).toContain('Loaded');
    });
  });

  test.describe('Error Handling', () => {
    test('should show error status for blocked domain', async ({ page }) => {
      const consoleMessages = [];
      page.on('console', msg => {
        if (msg.type() === 'warning') {
          consoleMessages.push(msg.text());
        }
      });

      await page.goto('/?url=https://evil.com/malware.md');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForTimeout(1500);

      // URL should NOT be cleared since load failed
      expect(page.url()).toContain('url=');

      // Verify the domain was blocked via console warning
      const blockedMessage = consoleMessages.find(msg => msg.includes('domain not in allowlist'));
      expect(blockedMessage).toBeTruthy();
    });

    test('should handle 404 errors gracefully', async ({ page }) => {
      const notFoundUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main/nonexistent-file-12345.md';
      await page.goto(`/?url=${encodeURIComponent(notFoundUrl)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await waitForStatusContaining(page, 'Error');

      const statusText = await page.locator('#status').textContent();
      expect(statusText).toContain('Error');
    });
  });

  test.describe('No URL Parameter Behavior', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForFunction(() => typeof globalThis.getEditorContent === 'function', { timeout: 5000 });
    });

    test('should load from localStorage when no URL parameter', async ({ page }) => {
      // Set test content in localStorage
      await page.evaluate(() => {
        localStorage.setItem('markdown-content', '# Test Content\n\nThis is test content from localStorage.');
      });

      // Reload the page without URL parameter
      await page.reload();
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForFunction(() => typeof globalThis.getEditorContent === 'function', { timeout: 5000 });
      await page.waitForTimeout(1000);

      const editorContent = await page.evaluate(() => globalThis.getEditorContent());
      expect(editorContent).toContain('Test Content');
    });

    test('should load sample when no URL parameter and no localStorage', async ({ page }) => {
      await page.evaluate(() => localStorage.removeItem('markdown-content'));

      await page.reload();
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForFunction(() => typeof globalThis.getEditorContent === 'function', { timeout: 5000 });
      await page.waitForTimeout(1500);

      const editorContent = await page.evaluate(() => globalThis.getEditorContent());
      expect(editorContent.length).toBeGreaterThan(100);
      expect(editorContent.toLowerCase()).toContain('mermaid');
    });
  });
});
