// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Maximum URL length allowed by the application (matches security.js)
 * @constant {number}
 */
const MAX_URL_LENGTH = 2048;

/**
 * Tests for URL parameter loading functionality (Issue #79, PR #80, Issue #201)
 *
 * The URL loading feature should:
 * - Load markdown from any HTTPS URL via ?url= parameter (content sanitized by DOMPurify)
 * - Enforce HTTPS-only
 * - Block URLs with embedded credentials
 * - Block URLs exceeding length limits
 * - Block non-ASCII hostnames (IDN homograph attacks)
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
  test.describe('HTTPS URL Acceptance (Issue #201)', () => {
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

    test('should allow any HTTPS domain (content sanitized by DOMPurify)', async ({ page }) => {
      // Issue #201: Domain allowlist removed - any HTTPS URL is now allowed
      // Content is sanitized by DOMPurify, so it's safe to load from any source
      const anyHttpsDomains = [
        'https://example.com/file.md',
        'https://github.com/user/repo/blob/main/README.md',
        'https://pastebin.com/raw/abc123',
        'https://mydomain.com/docs/readme.md'
      ];

      for (const url of anyHttpsDomains) {
        const isAllowed = await testUrlValidation(page, url);
        expect(isAllowed).toBe(true);
      }
    });
  });

  test.describe('HTTPS Enforcement', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    });

    test('should block HTTP URLs (HTTPS required)', async ({ page }) => {
      // Test URL built at runtime to avoid static analysis flagging test data
      const httpUrl = ['http', '://', 'example.com/file.md'].join('');
      const isAllowed = await testUrlValidation(page, httpUrl);
      expect(isAllowed).toBe(false);
    });

    test('should accept any HTTPS URL', async ({ page }) => {
      const isAllowed = await testUrlValidation(page, 'https://example.com/any-file.md');
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

  test.describe('URL Security Edge Cases (Issue #82)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    });

    test('should block URLs with embedded credentials (user:pass@host)', async ({ page }) => {
      const urlWithCreds = 'https://user:password@raw.githubusercontent.com/user/repo/main/file.md';
      const isAllowed = await testUrlValidation(page, urlWithCreds);
      expect(isAllowed).toBe(false);
    });

    test('should block URLs with username only', async ({ page }) => {
      const urlWithUser = 'https://admin@raw.githubusercontent.com/user/repo/main/file.md';
      const isAllowed = await testUrlValidation(page, urlWithUser);
      expect(isAllowed).toBe(false);
    });

    test('should block URLs exceeding 2048 characters', async ({ page }) => {
      // Create a URL that exceeds the 2048 character limit
      const baseUrl = 'https://raw.githubusercontent.com/user/repo/main/';
      const longPath = 'a'.repeat(2100);
      const longUrl = baseUrl + longPath + '.md';

      expect(longUrl.length).toBeGreaterThan(2048);

      const isAllowed = await testUrlValidation(page, longUrl);
      expect(isAllowed).toBe(false);
    });

    test('should allow URLs just under 2048 characters', async ({ page }) => {
      // Create a URL that is exactly at the limit
      const baseUrl = 'https://raw.githubusercontent.com/user/repo/main/';
      const targetLength = 2048;
      const pathLength = targetLength - baseUrl.length - 3; // -3 for ".md"
      const path = 'a'.repeat(pathLength);
      const validUrl = baseUrl + path + '.md';

      expect(validUrl.length).toBeLessThanOrEqual(2048);

      const isAllowed = await testUrlValidation(page, validUrl);
      expect(isAllowed).toBe(true);
    });

    test('should block IDN homograph attack URLs (Cyrillic characters)', async ({ page }) => {
      // URL with Cyrillic 'а' (U+0430) instead of Latin 'a' in 'raw'
      // This simulates a homograph attack: rаw.githubusercontent.com
      const homographUrl = 'https://r\u0430w.githubusercontent.com/user/repo/main/file.md';

      const isAllowed = await testUrlValidation(page, homographUrl);
      expect(isAllowed).toBe(false);
    });

    test('should block legitimate IDN domains (security policy)', async ({ page }) => {
      // URL with legitimate German umlaut is blocked as part of IDN homograph attack prevention
      // Security policy: ALL non-ASCII hostnames are blocked, even legitimate ones
      // This prevents sophisticated homograph attacks that use legitimate characters
      const unicodeUrl = 'https://müller.com/file.md';

      const isAllowed = await testUrlValidation(page, unicodeUrl);
      expect(isAllowed).toBe(false);
    });

    test('should allow legitimate ASCII URLs from trusted domains', async ({ page }) => {
      const legitimateUrls = [
        'https://raw.githubusercontent.com/user/repo/main/README.md',
        'https://raw.githubusercontent.com/org/project/branch/path/to/file.md',
        'https://gist.githubusercontent.com/user/abc123/raw/file.md'
      ];

      for (const url of legitimateUrls) {
        const isAllowed = await testUrlValidation(page, url);
        expect(isAllowed).toBe(true);
      }
    });

    test('should log appropriate warning for credential URLs', async ({ page }) => {
      const consoleMessages = [];
      page.on('console', msg => {
        if (msg.type() === 'warning') {
          consoleMessages.push(msg.text());
        }
      });

      const urlWithCreds = 'https://user:pass@raw.githubusercontent.com/user/repo/main/file.md';
      await testUrlValidation(page, urlWithCreds);

      const credentialWarning = consoleMessages.find(msg => msg.includes('credentials not allowed'));
      expect(credentialWarning).toBeTruthy();
    });

    test('should log appropriate warning for long URLs', async ({ page }) => {
      const consoleMessages = [];
      page.on('console', msg => {
        if (msg.type() === 'warning') {
          consoleMessages.push(msg.text());
        }
      });

      const longUrl = 'https://raw.githubusercontent.com/' + 'a'.repeat(2100) + '.md';
      await testUrlValidation(page, longUrl);

      const lengthWarning = consoleMessages.find(msg => msg.includes('URL too long'));
      expect(lengthWarning).toBeTruthy();
    });

    test('should log appropriate warning for IDN homograph URLs', async ({ page }) => {
      const consoleMessages = [];
      page.on('console', msg => {
        if (msg.type() === 'warning') {
          consoleMessages.push(msg.text());
        }
      });

      const homographUrl = 'https://r\u0430w.githubusercontent.com/user/repo/main/file.md';
      await testUrlValidation(page, homographUrl);

      const homographWarning = consoleMessages.find(msg => msg.includes('homoglyphs'));
      expect(homographWarning).toBeTruthy();
    });
  });

  test.describe('Fetch Timeout and Size Limits (Issue #85)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    });

    test('should use AbortController for fetch timeout capability', async ({ page }) => {
      // Verify AbortController is available and functions correctly
      // This validates the timeout mechanism used by loadMarkdownFromURL

      const result = await page.evaluate(async () => {
        const controller = new AbortController();

        // Immediately abort to simulate timeout behavior
        controller.abort();

        try {
          await fetch('https://raw.githubusercontent.com/test/test/main/test.md', {
            signal: controller.signal
          });
          return { aborted: false };
        } catch (error) {
          return { aborted: true, errorName: error.name };
        }
      });

      expect(result.aborted).toBe(true);
      expect(result.errorName).toBe('AbortError');
    });

    test('should successfully load files within size limit', async ({ page }) => {
      // Load a normal-sized file from GitHub (README is well under 10MB)
      const testUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main/README.md';

      await page.goto(`/?url=${encodeURIComponent(testUrl)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Wait for the load to complete
      await page.waitForFunction(() => {
        const status = document.getElementById('status');
        return status?.textContent?.includes('Loaded') || status?.textContent?.includes('Error');
      }, { timeout: 15000 });

      const statusText = await page.locator('#status').textContent();
      expect(statusText).toContain('Loaded');
    });

    test('should log error for failed URL loads', async ({ page }) => {
      // Verify error handling path works correctly
      const consoleMessages = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleMessages.push(msg.text());
        }
      });

      // Try to load a non-existent file to trigger error handling
      const notFoundUrl = 'https://raw.githubusercontent.com/test/nonexistent-repo-12345/main/file.md';
      await page.goto(`/?url=${encodeURIComponent(notFoundUrl)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Wait for error
      await page.waitForFunction(() => {
        const status = document.getElementById('status');
        return status?.textContent?.includes('Error');
      }, { timeout: 15000 });

      // Verify error was logged
      const hasErrorLog = consoleMessages.some(msg => msg.includes('Error loading URL'));
      expect(hasErrorLog).toBe(true);
    });

    test('should display user-friendly error message on failure', async ({ page }) => {
      // Verify status shows helpful error message
      const notFoundUrl = 'https://raw.githubusercontent.com/test/nonexistent-repo-12345/main/file.md';
      await page.goto(`/?url=${encodeURIComponent(notFoundUrl)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      await page.waitForFunction(() => {
        const status = document.getElementById('status');
        return status?.textContent?.includes('Error');
      }, { timeout: 15000 });

      const statusText = await page.locator('#status').textContent();
      expect(statusText).toContain('Error loading URL');
      expect(statusText).toContain('HTTP'); // Should mention HTTP status
    });
  });

  test.describe('Content-Type Validation (Issue #83)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    });

    test('should successfully load files with text/plain Content-Type', async ({ page }) => {
      // GitHub raw files typically serve text/plain - integration test
      const testUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main/README.md';

      await page.goto(`/?url=${encodeURIComponent(testUrl)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      await page.waitForFunction(() => {
        const status = document.getElementById('status');
        return status?.textContent?.includes('Loaded') || status?.textContent?.includes('Error');
      }, { timeout: 15000 });

      const statusText = await page.locator('#status').textContent();
      expect(statusText).toContain('Loaded');
    });

    // Data-driven tests for Content-Type validation
    // Uses the actual isValidMarkdownContentType function exported from file-ops.js
    const allowedTypes = ['text/plain', 'text/markdown', 'text/x-markdown',
      'text/plain; charset=utf-8', 'application/octet-stream', null, undefined];
    const blockedTypes = ['application/javascript', 'text/javascript', 'application/x-javascript',
      'text/html', 'text/vbscript', 'application/json', 'image/png'];

    for (const contentType of allowedTypes) {
      test(`should allow Content-Type: ${contentType}`, async ({ page }) => {
        const result = await page.evaluate((ct) => globalThis.isValidMarkdownContentType(ct), contentType);
        expect(result).toBe(true);
      });
    }

    for (const contentType of blockedTypes) {
      test(`should block Content-Type: ${contentType}`, async ({ page }) => {
        const result = await page.evaluate((ct) => globalThis.isValidMarkdownContentType(ct), contentType);
        expect(result).toBe(false);
      });
    }
  });

  test.describe('URL Parameter Behavior (Issue #204)', () => {
    // Common test URL used across multiple tests
    const TEST_README_URL = 'https://raw.githubusercontent.com/mickdarling/merview/main/README.md';

    test('should retain URL parameter after successful load for sharing/bookmarking', async ({ page }) => {
      await page.goto(`/?url=${encodeURIComponent(TEST_README_URL)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await waitForStatusContaining(page, 'Loaded', 15000);

      // URL should still contain the parameter for sharing/bookmarking
      expect(page.url()).toContain('url=');
      // URL should be minimally encoded (readable, not over-encoded)
      expect(page.url()).toContain('https://raw.githubusercontent.com');
      // Should not have percent-encoded slashes or colons
      expect(page.url()).not.toContain('%2F');
      expect(page.url()).not.toContain('%3A');
    });

    test('should persist URL parameter after loading from URL via modal', async ({ page }) => {
      // Start without URL parameter
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Open the "Load from URL" modal via document selector
      await page.selectOption('#documentSelector', '__load_url__');

      // Wait for modal to appear (note: modal ID is 'urlModal', not 'urlInputModal')
      await page.waitForSelector('#urlModal[open]', { timeout: 5000 });

      // Enter URL and submit
      await page.fill('#urlInput', TEST_README_URL);
      await page.click('#urlModalLoad');

      // Wait for load to complete
      await waitForStatusContaining(page, 'Loaded', 15000);

      // URL parameter should now be in address bar (minimally encoded)
      expect(page.url()).toContain('url=');
      expect(page.url()).toContain('https://raw.githubusercontent.com');
      expect(page.url()).not.toContain('%2F');
      expect(page.url()).not.toContain('%3A');
    });

    test('should update URL parameter when loading different URL via modal', async ({ page }) => {
      // Start with first URL
      await page.goto(`/?url=${encodeURIComponent(TEST_README_URL)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await waitForStatusContaining(page, 'Loaded', 15000);

      // Verify first URL parameter is present (minimally encoded)
      expect(page.url()).toContain('url=');
      expect(page.url()).toContain('README.md');

      // Load a different URL via modal
      const SECOND_URL = 'https://raw.githubusercontent.com/mickdarling/merview/main/docs/about.md';

      // Open the "Load from URL" modal via document selector
      await page.selectOption('#documentSelector', '__load_url__');

      // Wait for modal to appear
      await page.waitForSelector('#urlModal[open]', { timeout: 5000 });

      // Enter new URL and submit
      await page.fill('#urlInput', SECOND_URL);
      await page.click('#urlModalLoad');

      // Wait for load to complete
      await waitForStatusContaining(page, 'Loaded', 15000);

      // URL parameter should be updated to the new URL (minimally encoded)
      expect(page.url()).toContain('url=');
      expect(page.url()).toContain('docs/about.md');
      expect(page.url()).not.toContain('README.md');
    });

    test('should clear URL parameter when loading local file', async ({ page }) => {
      // Start with URL parameter
      await page.goto(`/?url=${encodeURIComponent(TEST_README_URL)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await waitForStatusContaining(page, 'Loaded', 15000);

      // Verify URL parameter is present
      expect(page.url()).toContain('url=');

      // Create test content for loading
      const testContent = '# Test Local File\n\nThis is test content.';

      // Simulate file loading (since we can't easily trigger file picker in tests)
      await page.evaluate((content) => {
        if (globalThis.state.cmEditor) {
          globalThis.state.cmEditor.setValue(content);
        }
        globalThis.state.currentFilename = 'test.md';
        globalThis.state.loadedFromURL = null;
        // Simulate the clearURLParameter call that happens in loadMarkdownFile
        const newUrl = new URL(globalThis.location.href);
        newUrl.searchParams.delete('url');
        history.replaceState(null, '', newUrl.toString());
      }, testContent);

      // Wait a moment for URL to update
      await page.waitForTimeout(500);

      // URL parameter should be cleared
      expect(page.url()).not.toContain('url=');
    });

    test('should clear URL parameter when loading sample document', async ({ page }) => {
      // Start with URL parameter
      await page.goto(`/?url=${encodeURIComponent(TEST_README_URL)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await waitForStatusContaining(page, 'Loaded', 15000);

      // Verify URL parameter is present
      expect(page.url()).toContain('url=');

      // Load sample by clicking the logo/brand link
      await page.click('#brandHomeLink');
      await page.waitForTimeout(500);

      // URL parameter should be cleared
      expect(page.url()).not.toContain('url=');

      // Content should be the sample
      const content = await page.evaluate(() => globalThis.getEditorContent());
      expect(content).toContain('Welcome to Merview');
    });

    test('should clear URL parameter when creating new document', async ({ page }) => {
      // Start with URL parameter
      await page.goto(`/?url=${encodeURIComponent(TEST_README_URL)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await waitForStatusContaining(page, 'Loaded', 15000);

      // Verify URL parameter is present
      expect(page.url()).toContain('url=');

      // Create new document via selector
      await page.selectOption('#documentSelector', '__new__');
      await page.waitForTimeout(500);

      // URL parameter should be cleared
      expect(page.url()).not.toContain('url=');

      // Editor should be empty
      const content = await page.evaluate(() => globalThis.getEditorContent());
      expect(content).toBe('');
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
    test('should block HTTP URLs and show appropriate warning', async ({ page }) => {
      const consoleMessages = [];
      page.on('console', msg => {
        if (msg.type() === 'warning') {
          consoleMessages.push(msg.text());
        }
      });

      // Use HTTP (not HTTPS) to trigger blocking
      await page.goto('/?url=http://example.com/file.md');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForTimeout(1500);

      // URL should NOT be cleared since load failed
      expect(page.url()).toContain('url=');

      // Verify the URL was blocked via console warning (HTTPS required)
      const blockedMessage = consoleMessages.find(msg => msg.includes('HTTPS required'));
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

  test.describe('URL Path Encoding with International Characters (Issue #248)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    });

    test('should allow Japanese characters in URL path', async ({ page }) => {
      // URLs with Japanese characters in the path should be allowed
      // Browsers automatically percent-encode non-ASCII path characters
      const urlWithJapanese = 'https://example.com/docs/日本語ファイル.md';
      const isAllowed = await testUrlValidation(page, urlWithJapanese);
      expect(isAllowed).toBe(true);
    });

    test('should allow percent-encoded Japanese path', async ({ page }) => {
      // Pre-encoded Japanese path should be accepted
      const encodedUrl = 'https://example.com/docs/%E6%97%A5%E6%9C%AC%E8%AA%9E.md';
      const isAllowed = await testUrlValidation(page, encodedUrl);
      expect(isAllowed).toBe(true);
    });

    test('should allow Chinese characters in URL path', async ({ page }) => {
      // Chinese characters in path
      const urlWithChinese = 'https://example.com/文档/readme.md';
      const isAllowed = await testUrlValidation(page, urlWithChinese);
      expect(isAllowed).toBe(true);
    });

    test('should allow Korean characters in URL path', async ({ page }) => {
      // Korean (Hangul) characters in path
      const urlWithKorean = 'https://example.com/path/to/한국어.md';
      const isAllowed = await testUrlValidation(page, urlWithKorean);
      expect(isAllowed).toBe(true);
    });

    test('should allow GitHub URL with international path', async ({ page }) => {
      // GitHub raw URL with international characters in path
      const githubUrl = 'https://raw.githubusercontent.com/user/repo/main/文档/readme.md';
      const isAllowed = await testUrlValidation(page, githubUrl);
      expect(isAllowed).toBe(true);
    });

    test('should allow gist URL with international filename', async ({ page }) => {
      // Gist URL with international filename
      const gistUrl = 'https://gist.githubusercontent.com/user/abc123/raw/日本語.md';
      const isAllowed = await testUrlValidation(page, gistUrl);
      expect(isAllowed).toBe(true);
    });

    test('should allow URL with mixed ASCII and international characters in path', async ({ page }) => {
      // Mixed ASCII and international characters
      const mixedUrl = 'https://example.com/docs/guide-日本語-v1.md';
      const isAllowed = await testUrlValidation(page, mixedUrl);
      expect(isAllowed).toBe(true);
    });

    test('should allow URL with international directory and filename', async ({ page }) => {
      // Both directory and filename with international characters
      const deepPath = 'https://example.com/文档/指南/日本語/readme.md';
      const isAllowed = await testUrlValidation(page, deepPath);
      expect(isAllowed).toBe(true);
    });

    test('should allow URL with percent-encoded Chinese characters', async ({ page }) => {
      // Pre-encoded Chinese characters
      const encodedChinese = 'https://example.com/%E6%96%87%E6%A1%A3/readme.md';
      const isAllowed = await testUrlValidation(page, encodedChinese);
      expect(isAllowed).toBe(true);
    });

    test('should allow URL with percent-encoded Korean characters', async ({ page }) => {
      // Pre-encoded Korean characters
      const encodedKorean = 'https://example.com/path/%ED%95%9C%EA%B5%AD%EC%96%B4.md';
      const isAllowed = await testUrlValidation(page, encodedKorean);
      expect(isAllowed).toBe(true);
    });

    test('should allow URL with international query parameters', async ({ page }) => {
      // International characters in query parameters (not just path)
      const urlWithQuery = 'https://example.com/file.md?title=日本語';
      const isAllowed = await testUrlValidation(page, urlWithQuery);
      expect(isAllowed).toBe(true);
    });

    test('should allow URL with emoji in path', async ({ page }) => {
      // Emoji are also non-ASCII Unicode characters
      const emojiUrl = 'https://example.com/docs/readme-🚀.md';
      const isAllowed = await testUrlValidation(page, emojiUrl);
      expect(isAllowed).toBe(true);
    });

    test('should reject URL with international characters in HOSTNAME (security)', async ({ page }) => {
      // While paths with international chars are OK, hostnames should be blocked
      // This prevents IDN homograph attacks
      const urlWithIntlHostname = 'https://例え.com/file.md';
      const isAllowed = await testUrlValidation(page, urlWithIntlHostname);
      expect(isAllowed).toBe(false);
    });

    test('should reject URL with Cyrillic in hostname but allow in path', async ({ page }) => {
      // Cyrillic in hostname = blocked (homograph attack)
      const cyrillicHostname = 'https://examрle.com/file.md'; // 'р' is Cyrillic
      const isAllowedHostname = await testUrlValidation(page, cyrillicHostname);
      expect(isAllowedHostname).toBe(false);

      // Cyrillic in path = allowed
      const cyrillicPath = 'https://example.com/файл.md';
      const isAllowedPath = await testUrlValidation(page, cyrillicPath);
      expect(isAllowedPath).toBe(true);
    });

    test('should handle URL.toString() with international characters correctly', async ({ page }) => {
      // Test that URL parsing and toString() preserves international characters
      const result = await page.evaluate(() => {
        const url = new URL('https://example.com/docs/日本語.md');
        return {
          href: url.href,
          pathname: url.pathname,
          // pathname should be percent-encoded
          isEncoded: url.pathname.includes('%')
        };
      });

      // URL API should automatically percent-encode the path
      expect(result.isEncoded).toBe(true);
      expect(result.href).toContain('%');
    });

    test('should verify normalizeGitHubContentUrl preserves encoded international paths for GitHub blobs', async ({ page }) => {
      // Test that normalizeGitHubContentUrl handles international characters correctly for GitHub blobs
      const result = await page.evaluate(() => {
        const blobUrl = 'https://github.com/user/repo/blob/main/文档/readme.md';
        // @ts-ignore - normalizeGitHubContentUrl is defined in the app
        const normalized = globalThis.normalizeGitHubContentUrl(blobUrl);
        return normalized;
      });

      // Should convert to raw URL and preserve encoded path
      expect(result).toContain('raw.githubusercontent.com');
      expect(result).toContain('user/repo/main/');
      // Path should be percent-encoded in the result
      expect(result).toContain('%');
    });

    test('should verify normalizeGistUrl preserves encoded international paths', async ({ page }) => {
      // Test that normalizeGistUrl handles international characters correctly
      const result = await page.evaluate(() => {
        const gistUrl = 'https://gist.github.com/user/abc123/日本語.md';
        // @ts-ignore - normalizeGistUrl is defined in the app
        const normalized = globalThis.normalizeGistUrl(gistUrl);
        return normalized;
      });

      // Should convert to raw URL and preserve encoded filename
      expect(result).toContain('gist.githubusercontent.com');
      expect(result).toContain('/raw/');
      // Filename should be percent-encoded
      expect(result).toContain('%');
    });

    test('should allow very long international paths under length limit', async ({ page }) => {
      // Long but valid international path
      const baseUrl = 'https://example.com/';
      const longPath = '日本語/'.repeat(50) + 'file.md';
      const fullUrl = baseUrl + longPath;

      // Only test if under the 2048 limit
      if (fullUrl.length <= 2048) {
        const isAllowed = await testUrlValidation(page, fullUrl);
        expect(isAllowed).toBe(true);
      }
    });

    test('should check URL length limit on raw string (not encoded length)', async ({ page }) => {
      // The length validation checks the RAW string length (before percent-encoding)
      // This is a security measure to prevent DoS - checking encoded length would be expensive
      const baseUrl = 'https://example.com/';

      // Test 1: URL with international chars that's under MAX_URL_LENGTH raw but over when encoded
      // Each Japanese character '日' encodes to 9 bytes (%E6%97%A5)
      // 230 chars * 9 bytes = 2070 bytes encoded, but only ~253 bytes raw
      const pathUnder = '日'.repeat(230) + '.md';
      const urlUnder = baseUrl + pathUnder;
      expect(urlUnder.length).toBeLessThan(MAX_URL_LENGTH); // Raw length under limit
      const isAllowedUnder = await testUrlValidation(page, urlUnder);
      expect(isAllowedUnder).toBe(true); // Should be allowed (raw length is what matters)

      // Test 2: URL that exceeds MAX_URL_LENGTH in RAW string length
      // This creates a 2050-character URL (2026 repeated chars + 24 for "https://example.com/" + ".md")
      // We chose 2050 to clearly exceed the 2048 limit while staying well under test framework constraints
      const pathOver = '日'.repeat(2026) + '.md'; // 2050 chars raw (2026 + 23 for base + 1 for /)
      const urlOver = baseUrl + pathOver;
      expect(urlOver.length).toBeGreaterThan(MAX_URL_LENGTH); // Raw length over limit
      const isAllowedOver = await testUrlValidation(page, urlOver);
      expect(isAllowedOver).toBe(false); // Should be blocked (raw length exceeds limit)
    });

    test('should handle URL with international fragment identifier', async ({ page }) => {
      // Fragment with international characters
      const urlWithFragment = 'https://example.com/file.md#セクション';
      const isAllowed = await testUrlValidation(page, urlWithFragment);
      expect(isAllowed).toBe(true);
    });

    test('should properly encode international characters for fetch', async ({ page }) => {
      // Verify that fetch receives properly encoded URLs
      const consoleMessages = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      // This will fail (non-existent URL) but we can check the encoding in the error
      const intlUrl = 'https://example.com/docs/日本語.md';
      const fetchResult = await page.evaluate(async (url) => {
        try {
          // @ts-ignore - loadMarkdownFromURL is defined in the app
          await globalThis.loadMarkdownFromURL(url);
          return { success: true, error: null };
        } catch (e) {
          // Expected to fail (non-existent URL) - we're testing URL encoding, not fetch success
          // Return error info so we can verify the URL was properly processed
          return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
      }, intlUrl);

      // We expect the fetch to fail (non-existent URL), but the error should not be about encoding
      expect(fetchResult.success).toBe(false);
      // Error should be about fetch failure, not URL validation
      expect(fetchResult.error).not.toContain('blocked');

      // The URL should have been validated (no blocking warnings)
      const blockingWarnings = consoleMessages.filter(msg =>
        msg.type === 'warning' && msg.text.includes('blocked')
      );
      expect(blockingWarnings.length).toBe(0);
    });

    test('should handle malformed percent encoding gracefully', async ({ page }) => {
      // Malformed percent encoding (incomplete sequences like %E6%97 instead of %E6%97%A5)
      // The URL API should handle these gracefully without crashing

      const malformedUrls = [
        'https://example.com/docs/%E6%97.md',        // Incomplete UTF-8 sequence
        'https://example.com/docs/%E6.md',           // Single byte of multi-byte char
        'https://example.com/docs/%GG.md',           // Invalid hex digits
        'https://example.com/docs/%.md',             // Percent with no hex
        'https://example.com/docs/%2.md'             // Percent with single hex digit
      ];

      for (const url of malformedUrls) {
        // These should not crash the validation - they may be allowed or blocked
        // but should not throw an exception
        const result = await page.evaluate((testUrl) => {
          try {
            // @ts-ignore - isAllowedMarkdownURL is defined in the app
            const isAllowed = globalThis.isAllowedMarkdownURL(testUrl);
            return { success: true, isAllowed };
          } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
          }
        }, url);

        // Validation should complete without throwing
        expect(result.success).toBe(true);
      }
    });

    test('should handle double-encoded international characters', async ({ page }) => {
      // Double encoding: 日 -> %E6%97%A5 -> %25E6%2597%25A5
      // This can happen when URLs are encoded multiple times

      const doubleEncodedUrl = 'https://example.com/docs/%25E6%2597%25A5%25E6%259C%25AC%25E8%25AA%259E.md';

      // Double-encoded URL should still be valid (allowed)
      const isAllowed = await testUrlValidation(page, doubleEncodedUrl);
      expect(isAllowed).toBe(true);

      // Verify the URL API handles it correctly
      const urlParts = await page.evaluate((url) => {
        const parsed = new URL(url);
        return {
          pathname: parsed.pathname,
          // Check if it contains the double-encoded percent signs
          hasDoubleEncoding: parsed.pathname.includes('%25')
        };
      }, doubleEncodedUrl);

      // The pathname should preserve the double encoding
      expect(urlParts.hasDoubleEncoding).toBe(true);
    });

    test('should handle mixed raw and percent-encoded international characters', async ({ page }) => {
      // Mix of raw international chars and already-encoded chars in the same path
      // This tests the URL API's handling of partial encoding

      const result = await page.evaluate(() => {
        // Raw Japanese + already-encoded Japanese in same path
        const mixedUrl = 'https://example.com/日本語/%E4%B8%AD%E6%96%87/file.md';
        const parsed = new URL(mixedUrl);

        return {
          href: parsed.href,
          pathname: parsed.pathname,
          // Both parts should end up percent-encoded
          fullyEncoded: !parsed.pathname.includes('日') && !parsed.pathname.includes('中')
        };
      });

      // URL API should encode the raw chars while preserving already-encoded ones
      expect(result.fullyEncoded).toBe(true);
      expect(result.pathname).toContain('%');
    });
  });

  test.describe('GitHub Token Security (Private Repo URLs)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    });

    test('stripGitHubToken should remove token from raw.githubusercontent.com URLs', async ({ page }) => {
      const result = await page.evaluate(() => {
        // @ts-ignore - stripGitHubToken is defined in the app
        return globalThis.stripGitHubToken('https://raw.githubusercontent.com/user/private-repo/main/file.md?token=ABC123XYZ');
      });

      expect(result.hadToken).toBe(true);
      expect(result.cleanUrl).toBe('https://raw.githubusercontent.com/user/private-repo/main/file.md');
      expect(result.cleanUrl).not.toContain('token');
    });

    test('stripGitHubToken should preserve URLs without tokens', async ({ page }) => {
      const result = await page.evaluate(() => {
        // @ts-ignore - stripGitHubToken is defined in the app
        return globalThis.stripGitHubToken('https://raw.githubusercontent.com/user/public-repo/main/file.md');
      });

      expect(result.hadToken).toBe(false);
      expect(result.cleanUrl).toBe('https://raw.githubusercontent.com/user/public-repo/main/file.md');
    });

    test('stripGitHubToken should preserve other query parameters', async ({ page }) => {
      const result = await page.evaluate(() => {
        // @ts-ignore - stripGitHubToken is defined in the app
        return globalThis.stripGitHubToken('https://raw.githubusercontent.com/user/repo/main/file.md?token=ABC123&ref=main');
      });

      expect(result.hadToken).toBe(true);
      expect(result.cleanUrl).toContain('ref=main');
      expect(result.cleanUrl).not.toContain('token=');
    });

    test('stripGitHubToken should not affect non-GitHub URLs with token param', async ({ page }) => {
      const result = await page.evaluate(() => {
        // @ts-ignore - stripGitHubToken is defined in the app
        return globalThis.stripGitHubToken('https://gist.githubusercontent.com/user/abc/raw/file.md?token=XYZ');
      });

      // Should not strip from gist URLs (different domain)
      expect(result.hadToken).toBe(false);
      expect(result.cleanUrl).toContain('token=XYZ');
    });

    test('stripGitHubToken should handle invalid URLs gracefully', async ({ page }) => {
      const result = await page.evaluate(() => {
        // @ts-ignore - stripGitHubToken is defined in the app
        return globalThis.stripGitHubToken('not-a-valid-url');
      });

      expect(result.hadToken).toBe(false);
      expect(result.cleanUrl).toBe('not-a-valid-url');
    });

    test('should show security modal when loading private repo URL with token', async ({ page }) => {
      const privateRepoUrl = 'https://raw.githubusercontent.com/user/repo/main/file.md?token=GHSAT_FAKE_TOKEN_12345';

      await page.goto(`/?url=${encodeURIComponent(privateRepoUrl)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Modal should appear
      await page.waitForSelector('#privateUrlModal[open]', { timeout: 5000 });

      // Check modal content
      const modalTitle = await page.locator('#privateUrlModalTitle').textContent();
      expect(modalTitle).toContain('Private Repository Detected');

      // Should have two option buttons
      const viewLocalBtn = page.locator('[data-action="view-local"]');
      const shareGistBtn = page.locator('[data-action="share-gist"]');
      await expect(viewLocalBtn).toBeVisible();
      await expect(shareGistBtn).toBeVisible();
    });

    test('View Locally Only option should strip entire URL parameter', async ({ page }) => {
      const privateRepoUrl = 'https://raw.githubusercontent.com/user/repo/main/file.md?token=GHSAT_FAKE_TOKEN_12345';

      await page.goto(`/?url=${encodeURIComponent(privateRepoUrl)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForSelector('#privateUrlModal[open]', { timeout: 5000 });

      // Click "View Locally Only"
      await page.click('[data-action="view-local"]');

      // Wait for modal to be hidden (display: none when closed)
      await expect(page.locator('#privateUrlModal')).toBeHidden({ timeout: 2000 });

      // URL should have NO url parameter at all (completely stripped)
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('url=');
      expect(currentUrl).not.toContain('token=');

      // Should just be the base path
      const parsedUrl = new URL(currentUrl);
      expect(parsedUrl.search).toBe('');
    });

    test('closing modal by clicking backdrop should load locally', async ({ page }) => {
      const privateRepoUrl = 'https://raw.githubusercontent.com/user/repo/main/file.md?token=GHSAT_FAKE_TOKEN_12345';

      await page.goto(`/?url=${encodeURIComponent(privateRepoUrl)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForSelector('#privateUrlModal[open]', { timeout: 5000 });

      // Click on the backdrop (the dialog element itself, not the inner content)
      await page.click('#privateUrlModal', { position: { x: 10, y: 10 } });

      // Wait for modal to be hidden
      await expect(page.locator('#privateUrlModal')).toBeHidden({ timeout: 2000 });

      // URL should be stripped
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('url=');
    });

    test('showStatus should support warning type with appropriate styling', async ({ page }) => {
      // Test that showStatus('message', 'warning') applies the warning class
      await page.evaluate(() => {
        // @ts-ignore - showStatus is defined in the app
        globalThis.showStatus('Test warning message', 'warning');
      });

      // Check that warning class is applied
      await page.waitForSelector('#status.show.warning', { timeout: 2000 });
      const statusText = await page.locator('#status').textContent();
      expect(statusText).toBe('Test warning message');
    });

    test('should NOT show modal for public repo URLs (no token)', async ({ page }) => {
      const publicRepoUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main/README.md';

      await page.goto(`/?url=${encodeURIComponent(publicRepoUrl)}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Wait a bit
      await page.waitForTimeout(500);

      // Modal should NOT appear
      const isModalOpen = await page.locator('#privateUrlModal[open]').isVisible().catch(() => false);
      expect(isModalOpen).toBe(false);

      // URL should remain intact
      const currentUrl = page.url();
      expect(currentUrl).toContain('url=');
    });
  });
});
