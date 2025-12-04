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

test.describe('URL Loading', () => {
  test.describe('Domain Allowlist Validation', () => {
    test('should allow raw.githubusercontent.com domain', async ({ page }) => {
      // Navigate without URL param first
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Test the validation function directly
      const isAllowed = await page.evaluate(() => {
        // @ts-ignore - isAllowedMarkdownURL is defined in the app
        return globalThis.isAllowedMarkdownURL('https://raw.githubusercontent.com/user/repo/main/README.md');
      });
      expect(isAllowed).toBe(true);
    });

    test('should allow gist.githubusercontent.com domain', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      const isAllowed = await page.evaluate(() => {
        // @ts-ignore
        return globalThis.isAllowedMarkdownURL('https://gist.githubusercontent.com/user/abc123/raw/file.md');
      });
      expect(isAllowed).toBe(true);
    });

    test('should block untrusted domains', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      const untrustedDomains = [
        'https://evil.com/malware.md',
        'https://example.com/file.md',
        'https://github.com/user/repo/blob/main/README.md', // Note: github.com is NOT raw
        'https://pastebin.com/raw/abc123'
      ];

      for (const url of untrustedDomains) {
        const isAllowed = await page.evaluate((testUrl) => {
          // @ts-ignore
          return globalThis.isAllowedMarkdownURL(testUrl);
        }, url);
        expect(isAllowed).toBe(false);
      }
    });
  });

  test.describe('HTTPS Enforcement', () => {
    test('should block HTTP URLs even from allowed domains', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      const isAllowed = await page.evaluate(() => {
        // @ts-ignore
        return globalThis.isAllowedMarkdownURL('http://raw.githubusercontent.com/user/repo/main/README.md');
      });
      expect(isAllowed).toBe(false);
    });

    test('should accept HTTPS URLs from allowed domains', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      const isAllowed = await page.evaluate(() => {
        // @ts-ignore
        return globalThis.isAllowedMarkdownURL('https://raw.githubusercontent.com/user/repo/main/README.md');
      });
      expect(isAllowed).toBe(true);
    });
  });

  test.describe('Invalid URL Handling', () => {
    test('should reject invalid URL formats', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      const invalidUrls = [
        'not-a-url',
        'ftp://raw.githubusercontent.com/file.md',
        '//raw.githubusercontent.com/file.md',
        ''
      ];

      for (const url of invalidUrls) {
        const isAllowed = await page.evaluate((testUrl) => {
          // @ts-ignore
          return globalThis.isAllowedMarkdownURL(testUrl);
        }, url);
        expect(isAllowed).toBe(false);
      }
    });
  });

  test.describe('URL Parameter Clearing', () => {
    test('should clear URL parameter after successful load', async ({ page }) => {
      // Use a real GitHub raw URL that exists
      const testUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main/README.md';

      // Navigate with URL parameter
      await page.goto(`/?url=${encodeURIComponent(testUrl)}`);

      // Wait for content to load
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Wait for the async load to complete and URL to be cleared
      await page.waitForFunction(() => {
        return !globalThis.location.search.includes('url=');
      }, { timeout: 10000 });

      // Verify URL parameter is gone
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('url=');
    });

    test('should load content from URL parameter', async ({ page }) => {
      const testUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main/README.md';

      await page.goto(`/?url=${encodeURIComponent(testUrl)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Wait for editor API to be ready
      await page.waitForFunction(() => typeof globalThis.getEditorContent === 'function', { timeout: 5000 });

      // Wait for status to show "Loaded" which indicates content was loaded
      await page.waitForFunction(() => {
        const status = document.getElementById('status');
        return status && status.textContent.includes('Loaded');
      }, { timeout: 15000 });

      // Give a moment for editor to sync
      await page.waitForTimeout(500);

      // Verify the README content was loaded
      const editorContent = await page.evaluate(() => {
        // @ts-ignore
        return globalThis.getEditorContent();
      });

      expect(editorContent).toContain('Merview');
      expect(editorContent).toContain('Mermaid');
    });
  });

  test.describe('Status Messages', () => {
    test('should show "Loaded" status after successful URL load', async ({ page }) => {
      const testUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main/README.md';

      await page.goto(`/?url=${encodeURIComponent(testUrl)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Wait for status to show loaded message
      await page.waitForFunction(() => {
        const status = document.getElementById('status');
        return status && status.textContent.includes('Loaded');
      }, { timeout: 10000 });

      const statusText = await page.locator('#status').textContent();
      expect(statusText).toContain('Loaded');
    });
  });

  test.describe('Error Handling', () => {
    test('should show error status for blocked domain', async ({ page }) => {
      // Listen for console warnings to verify domain was blocked
      const consoleMessages = [];
      page.on('console', msg => {
        if (msg.type() === 'warning') {
          consoleMessages.push(msg.text());
        }
      });

      // Navigate with blocked domain
      await page.goto('/?url=https://evil.com/malware.md');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Give time for the validation to run
      await page.waitForTimeout(1500);

      // URL should NOT be cleared since load failed
      const currentUrl = page.url();
      expect(currentUrl).toContain('url=');

      // Verify the domain was blocked via console warning
      const blockedMessage = consoleMessages.find(msg => msg.includes('domain not in allowlist'));
      expect(blockedMessage).toBeTruthy();
    });

    test('should handle 404 errors gracefully', async ({ page }) => {
      // Use a URL that will return 404
      const notFoundUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main/nonexistent-file-12345.md';

      await page.goto(`/?url=${encodeURIComponent(notFoundUrl)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Wait for error to appear in status
      await page.waitForFunction(() => {
        const status = document.getElementById('status');
        return status && status.textContent.includes('Error');
      }, { timeout: 10000 });

      const statusText = await page.locator('#status').textContent();
      expect(statusText).toContain('Error');
    });
  });

  test.describe('No URL Parameter Behavior', () => {
    test('should load from localStorage when no URL parameter', async ({ page }) => {
      // First, set some content in localStorage before page loads
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForFunction(() => typeof globalThis.getEditorContent === 'function', { timeout: 5000 });

      // Set test content in localStorage
      await page.evaluate(() => {
        localStorage.setItem('markdown-content', '# Test Content\n\nThis is test content from localStorage.');
      });

      // Reload the page without URL parameter
      await page.reload();
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForFunction(() => typeof globalThis.getEditorContent === 'function', { timeout: 5000 });

      // Wait for CodeMirror to be fully ready and have content
      await page.waitForTimeout(1000);

      const editorContent = await page.evaluate(() => {
        // @ts-ignore
        return globalThis.getEditorContent();
      });

      expect(editorContent).toContain('Test Content');
    });

    test('should load sample when no URL parameter and no localStorage', async ({ page }) => {
      // Clear localStorage first
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForFunction(() => typeof globalThis.getEditorContent === 'function', { timeout: 5000 });

      await page.evaluate(() => {
        localStorage.removeItem('markdown-content');
      });

      // Reload the page
      await page.reload();
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForFunction(() => typeof globalThis.getEditorContent === 'function', { timeout: 5000 });

      // Wait for app to fully initialize
      await page.waitForTimeout(1500);

      const editorContent = await page.evaluate(() => {
        // @ts-ignore
        return globalThis.getEditorContent();
      });

      // Sample content includes mermaid diagrams and is substantial
      expect(editorContent.length).toBeGreaterThan(100);
      expect(editorContent.toLowerCase()).toContain('mermaid');
    });
  });
});
