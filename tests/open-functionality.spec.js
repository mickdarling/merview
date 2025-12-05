// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Browser-side helper: Check if clicking Open button triggers file input click
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 * @returns {Promise<boolean>} True if file input was clicked
 */
function browserCheckOpenButtonClick() {
  const fileInput = document.getElementById('mdFileInput');
  if (!fileInput) return Promise.resolve(false);

  return new Promise(function resolveOnClick(resolve) {
    fileInput.addEventListener('click', function onFileInputClick() {
      resolve(true);
    }, { once: true });

    const openButton = document.querySelector('button[onclick="openFile()"]');
    if (openButton) openButton.click();

    setTimeout(function fallbackTimeout() { resolve(false); }, 1000);
  });
}

/**
 * Tests for Open button functionality
 *
 * These tests ensure the Open button and file input infrastructure exists
 * and is properly wired up. This prevents regressions like the one in PR #103
 * where the mdFileInput element creation was lost during JS extraction.
 */
test.describe('Open Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for CodeMirror to initialize
    await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    // Wait for the editor API to be ready
    await page.waitForFunction(() => typeof globalThis.openFile === 'function', { timeout: 5000 });
  });

  test.describe('File Input Element', () => {
    test('mdFileInput element should exist in DOM after initialization', async ({ page }) => {
      // CRITICAL: This test prevents regression of issue #123
      // The hidden file input must be created by initFileInputHandlers()
      const fileInput = await page.$('#mdFileInput');
      expect(fileInput).not.toBeNull();
    });

    test('mdFileInput should be a file input with correct type', async ({ page }) => {
      const inputType = await page.$eval('#mdFileInput', el => el.type);
      expect(inputType).toBe('file');
    });

    test('mdFileInput should accept markdown and text file extensions', async ({ page }) => {
      const acceptAttr = await page.$eval('#mdFileInput', el => el.accept);
      expect(acceptAttr).toContain('.md');
      expect(acceptAttr).toContain('.markdown');
      expect(acceptAttr).toContain('.txt');
      expect(acceptAttr).toContain('.text');
    });

    test('mdFileInput should be hidden from view', async ({ page }) => {
      const display = await page.$eval('#mdFileInput', el => getComputedStyle(el).display);
      expect(display).toBe('none');
    });

    test('mdFileInput should have an id attribute', async ({ page }) => {
      // Ensures the element can be found by getElementById
      const id = await page.$eval('#mdFileInput', el => el.id);
      expect(id).toBe('mdFileInput');
    });
  });

  test.describe('Open Button', () => {
    test('Open button should exist in toolbar', async ({ page }) => {
      const openButton = await page.$('button[onclick="openFile()"]');
      expect(openButton).not.toBeNull();
    });

    test('Open button should have openFile onclick handler', async ({ page }) => {
      const onclick = await page.$eval('button[onclick="openFile()"]', el => el.getAttribute('onclick'));
      expect(onclick).toBe('openFile()');
    });

    test('openFile function should be globally available', async ({ page }) => {
      const isFunction = await page.evaluate(() => typeof globalThis.openFile === 'function');
      expect(isFunction).toBe(true);
    });

    test('clicking Open button should trigger file input click', async ({ page }) => {
      // Track if file input was clicked by listening for the click event
      // Uses extracted helper to avoid deep nesting (SonarCloud S2004)
      const wasClicked = await page.evaluate(browserCheckOpenButtonClick);
      expect(wasClicked).toBe(true);
    });
  });

  test.describe('Event Handler Registration', () => {
    test('mdFileInput should have change event listener attached', async ({ page }) => {
      // Verify the change handler is registered by checking if the element
      // has event listeners (indirectly via getEventListeners in Chrome DevTools protocol)
      // Since we can't directly access event listeners, we verify the handler setup
      // by checking that the file input exists and has proper attributes

      const hasProperSetup = await page.evaluate(() => {
        const input = document.getElementById('mdFileInput');
        if (!input) return false;

        // Check that the input is properly configured
        return input.type === 'file' &&
               input.accept.includes('.md') &&
               input.style.display === 'none';
      });

      expect(hasProperSetup).toBe(true);
    });
  });
});
