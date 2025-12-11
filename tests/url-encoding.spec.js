// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests for readable URL encoding in address bar
 *
 * When URLs are displayed in the address bar ?url= parameter, they should be
 * minimally encoded to remain readable while still being functional.
 * Common URL characters like / : . should NOT be percent-encoded.
 */

test.describe('URL Parameter Encoding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.CodeMirror', { timeout: 15000 });
  });

  test('should keep slashes and colons readable in address bar', async ({ page }) => {
    const testUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main/docs/developer-kit.md';

    // Load via URL parameter
    await page.goto(`/?url=${testUrl}`);
    await page.waitForSelector('.CodeMirror', { timeout: 15000 });

    // Wait for content to load
    await page.waitForFunction(() => {
      const status = document.getElementById('status');
      return status?.textContent?.includes('Loaded') || status?.textContent?.includes('Error');
    }, { timeout: 15000 });

    // Get the current browser URL
    const currentUrl = page.url();

    // The URL should contain the readable version (not encoded)
    expect(currentUrl).toContain('https://raw.githubusercontent.com');
    expect(currentUrl).toContain('/mickdarling/merview/main/docs/developer-kit.md');

    // Should NOT contain percent-encoded slashes or colons
    expect(currentUrl).not.toContain('%2F'); // encoded /
    expect(currentUrl).not.toContain('%3A'); // encoded :
    expect(currentUrl).not.toContain('%2E'); // encoded .
  });

  test('should still encode special characters that break query strings', async ({ page }) => {
    // Test a URL with query parameters (which contain & and =)
    const testUrl = 'https://example.com/file.md?param1=value1&param2=value2';

    // Use setURLParameter directly
    await page.evaluate((url) => {
      // @ts-ignore - setURLParameter is defined in the app
      globalThis.setURLParameter(url);
    }, testUrl);

    // Wait for URL to update
    await page.waitForTimeout(500);

    const currentUrl = page.url();

    // Should encode & and = since they break query string parsing
    expect(currentUrl).toContain('%26'); // encoded &
    expect(currentUrl).toContain('%3D'); // encoded =

    // But should still keep the base URL readable
    expect(currentUrl).toContain('https://example.com/file.md');
    expect(currentUrl).not.toContain('%2F'); // / should not be encoded
    expect(currentUrl).not.toContain('%3A'); // : should not be encoded
  });

  test('should encode spaces and other special characters', async ({ page }) => {
    const testUrl = 'https://example.com/my file.md';

    await page.evaluate((url) => {
      // @ts-ignore
      globalThis.setURLParameter(url);
    }, testUrl);

    await page.waitForTimeout(500);
    const currentUrl = page.url();

    // Space should be encoded
    expect(currentUrl).toContain('%20'); // encoded space
    // But the rest should be readable
    expect(currentUrl).toContain('https://example.com/my');
    expect(currentUrl).toContain('.md');
  });

  test('should produce a working URL that can be copy-pasted', async ({ page }) => {
    const testUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main/README.md';

    // Load with the URL parameter
    await page.goto(`/?url=${testUrl}`);
    await page.waitForSelector('.CodeMirror', { timeout: 15000 });

    // Wait for load to complete
    await page.waitForFunction(() => {
      const status = document.getElementById('status');
      return status?.textContent?.includes('Loaded');
    }, { timeout: 15000 });

    // Get the current URL (this will have our minimal encoding)
    const currentUrl = page.url();

    // Extract the URL parameter to verify it's correctly encoded
    const urlObj = new URL(currentUrl);
    const urlParam = urlObj.searchParams.get('url');

    // The parameter value should be correctly decoded by URLSearchParams
    expect(urlParam).toBe(testUrl);

    // The raw URL string should be readable (not over-encoded)
    expect(currentUrl).toContain('https://raw.githubusercontent.com');
    expect(currentUrl).not.toContain('%2F'); // Should not have encoded slashes
    expect(currentUrl).not.toContain('%3A'); // Should not have encoded colons

    // The URL should work when parsed - verify by checking if it would load correctly
    // We don't need to actually load it again (that causes issues with test timing)
    // Just verify the URL is well-formed and parseable
    const reparsed = new URL(currentUrl);
    expect(reparsed.searchParams.get('url')).toBe(testUrl);
  });

  test('should handle URLs with hash fragments correctly', async ({ page }) => {
    const testUrl = 'https://example.com/file.md#section';

    await page.evaluate((url) => {
      // @ts-ignore
      globalThis.setURLParameter(url);
    }, testUrl);

    await page.waitForTimeout(500);
    const currentUrl = page.url();

    // Hash should be encoded since it would conflict with URL structure
    expect(currentUrl).toContain('%23'); // encoded #
    // But the base should be readable
    expect(currentUrl).toContain('https://example.com/file.md');
  });

  test('should be significantly more readable than full encodeURIComponent', async ({ page }) => {
    const testUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main/docs/developer-kit.md';

    await page.evaluate((url) => {
      // @ts-ignore
      globalThis.setURLParameter(url);
    }, testUrl);

    await page.waitForTimeout(500);
    const currentUrl = page.url();

    // The full encoded version would be:
    // https%3A%2F%2Fraw.githubusercontent.com%2Fmickdarling%2Fmerview%2Fmain%2Fdocs%2Fdeveloper-kit.md
    // Our version keeps slashes, colons, dots, and hyphens readable

    // Count percent-encoded characters in our URL
    const matches = currentUrl.match(/%[0-9A-F]{2}/gi) || [];
    const encodedCount = matches.length;

    // Should have very few encoded characters (only special ones if any)
    // For a standard GitHub URL, should be 0
    expect(encodedCount).toBeLessThan(5);
  });

  test('should handle loading from URL modal with readable encoding', async ({ page }) => {
    const testUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main/README.md';

    // Open the "Load from URL" modal
    await page.selectOption('#documentSelector', '__load_url__');
    await page.waitForSelector('#urlModal[open]', { timeout: 5000 });

    // Enter URL and submit
    await page.fill('#urlInput', testUrl);
    await page.click('#urlModalLoad');

    // Wait for load
    await page.waitForFunction(() => {
      const status = document.getElementById('status');
      return status?.textContent?.includes('Loaded');
    }, { timeout: 15000 });

    // Check that the address bar has readable encoding
    const currentUrl = page.url();
    expect(currentUrl).toContain('https://raw.githubusercontent.com');
    expect(currentUrl).not.toContain('%2F');
    expect(currentUrl).not.toContain('%3A');
  });

  test('setURLParameter function should handle edge cases gracefully', async ({ page }) => {
    // Test with empty string
    await page.evaluate(() => {
      // @ts-ignore
      globalThis.setURLParameter('');
    });
    await page.waitForTimeout(500);
    let currentUrl = page.url();
    expect(currentUrl).toContain('url=');

    // Test with URL containing Unicode characters (should be encoded)
    await page.evaluate(() => {
      // @ts-ignore
      globalThis.setURLParameter('https://example.com/файл.md');
    });
    await page.waitForTimeout(500);
    currentUrl = page.url();
    expect(currentUrl).toContain('https://example.com/');
    // Unicode should be encoded
    expect(currentUrl).toMatch(/%[0-9A-F]{2}/);
  });

  test('should preserve readability when updating URL parameter', async ({ page }) => {
    const url1 = 'https://raw.githubusercontent.com/mickdarling/merview/main/README.md';
    const url2 = 'https://raw.githubusercontent.com/mickdarling/merview/main/docs/about.md';

    // Load first URL
    await page.goto(`/?url=${url1}`);
    await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    await page.waitForFunction(() => {
      const status = document.getElementById('status');
      return status?.textContent?.includes('Loaded');
    }, { timeout: 15000 });

    // Load second URL via modal
    await page.selectOption('#documentSelector', '__load_url__');
    await page.waitForSelector('#urlModal[open]', { timeout: 5000 });
    await page.fill('#urlInput', url2);
    await page.click('#urlModalLoad');

    await page.waitForFunction(() => {
      const status = document.getElementById('status');
      return status?.textContent?.includes('Loaded');
    }, { timeout: 15000 });

    // Second URL should also be readable
    const currentUrl = page.url();
    expect(currentUrl).toContain('https://raw.githubusercontent.com');
    expect(currentUrl).toContain('/docs/about.md');
    expect(currentUrl).not.toContain('%2F');
    expect(currentUrl).not.toContain('%3A');
  });
});
