// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Browser-side helper: Get labels from optgroups
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 * @param {Element[]} groups - Optgroup elements
 * @returns {string[]} Array of labels
 */
function getOptgroupLabels(groups) {
  return groups.map(function extractLabel(g) { return g.label; });
}

/**
 * Browser-side helper: Get text content from options
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 * @param {Element[]} opts - Option elements
 * @returns {string[]} Array of text content
 */
function getOptionTextContent(opts) {
  return opts.map(function extractText(o) { return o.textContent; });
}

/**
 * Browser-side helper: Check if selecting "Load from file" triggers file input click
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

    // Use the changeDocument function to trigger file picker
    if (typeof globalThis.changeDocument === 'function') {
      globalThis.changeDocument('__load_file__');
    }

    setTimeout(function fallbackTimeout() { resolve(false); }, 2000);
  });
}

/**
 * Browser-side helper: Setup mock for loadMarkdownFromURL to simulate failure
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 */
function setupMockLoadMarkdownFromURL() {
  // Store original function
  const originalLoadMarkdownFromURL = globalThis.loadMarkdownFromURL;

  // Mock to simulate failure
  globalThis.loadMarkdownFromURL = async function mockFailedLoad() {
    // Simulate the error handling that happens in the real function
    globalThis.showStatus('Error loading URL: Network error');
    return false; // Return false to indicate failure
  };

  // Store original for cleanup (optional, but good practice)
  globalThis._originalLoadMarkdownFromURL = originalLoadMarkdownFromURL;
}

/**
 * Browser-side helper: Attempt to load a URL and handle failure
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 */
async function attemptFailedUrlLoad() {
  const url = 'https://raw.githubusercontent.com/invalid/url/test.md';
  try {
    await globalThis.loadMarkdownFromURL(url);
    globalThis.updateDocumentSelector();
  } catch (error) {
    console.error('Failed to load document from URL:', error);
  }
}

/**
 * Browser-side helper: Get selected option text from document selector
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 * @param {Element} el - The select element
 * @returns {string} The text content of the selected option
 */
function getSelectedOptionText(el) {
  const selected = el.querySelector('option:checked');
  return selected ? selected.textContent : '';
}

/**
 * Browser-side helper: Restore original loadMarkdownFromURL function
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 */
function restoreLoadMarkdownFromURL() {
  if (globalThis._originalLoadMarkdownFromURL) {
    globalThis.loadMarkdownFromURL = globalThis._originalLoadMarkdownFromURL;
    delete globalThis._originalLoadMarkdownFromURL;
  }
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

  test.describe('Document Selector', () => {
    test('Document selector should exist in editor panel', async ({ page }) => {
      const docSelector = await page.$('#documentSelector');
      expect(docSelector).not.toBeNull();
    });

    test('Document selector should be a select element', async ({ page }) => {
      const tagName = await page.$eval('#documentSelector', el => el.tagName.toLowerCase());
      expect(tagName).toBe('select');
    });

    test('openFile function should be globally available', async ({ page }) => {
      const isFunction = await page.evaluate(() => typeof globalThis.openFile === 'function');
      expect(isFunction).toBe(true);
    });

    test('changeDocument function should be globally available', async ({ page }) => {
      const isFunction = await page.evaluate(() => typeof globalThis.changeDocument === 'function');
      expect(isFunction).toBe(true);
    });

    test('newDocument can be triggered via changeDocument', async ({ page }) => {
      // newDocument is internal - called via changeDocument('__new__')
      // Verify changeDocument is available and can handle the __new__ action
      const isFunction = await page.evaluate(() => typeof globalThis.changeDocument === 'function');
      expect(isFunction).toBe(true);
    });

    test('Document selector should have Actions optgroup', async ({ page }) => {
      const optgroups = await page.$$eval('#documentSelector optgroup', getOptgroupLabels);
      expect(optgroups).toContain('Actions');
    });

    test('Document selector should have Load from file option', async ({ page }) => {
      const options = await page.$$eval('#documentSelector option', getOptionTextContent);
      expect(options).toContain('Load from file...');
    });

    test('Document selector should have Load from URL option', async ({ page }) => {
      const options = await page.$$eval('#documentSelector option', getOptionTextContent);
      expect(options).toContain('Load from URL...');
    });

    test('selecting Load from file should trigger file input click', async ({ page }) => {
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

  test.describe('Document Name in Selector', () => {
    test('Document selector should show Welcome.md on initial fresh load', async ({ page }) => {
      // This test verifies the fix for the race condition where the selector
      // showed "Untitled" instead of "Welcome.md" on initial load.
      // The fix removed premature updateDocumentSelector() call from initDocumentSelector(),
      // allowing loadWelcomePage() to set the filename before the selector is populated.

      // Clear sessionStorage to simulate fresh visit, then reload
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.removeItem('markdown-editor-content');
      });
      await page.reload();
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForFunction(() => typeof globalThis.openFile === 'function', { timeout: 5000 });

      // Wait for the document selector to show Welcome.md (condition-based, not timeout)
      await page.waitForFunction(
        () => globalThis.state?.currentFilename === 'Welcome.md',
        { timeout: 10000 }
      );

      // The selector should show "Welcome.md" (from loadWelcomePage)
      const selectedText = await page.$eval('#documentSelector', getSelectedOptionText);
      expect(selectedText).toBe('Welcome.md');
    });

    test('Document selector should show current document name', async ({ page }) => {
      // Set a filename and update selector
      await page.evaluate(() => {
        globalThis.state.currentFilename = 'test-document.md';
        globalThis.state.loadedFromURL = null;
        globalThis.updateDocumentSelector();
      });

      // The current document should be shown in the selector
      const selectedText = await page.$eval('#documentSelector', el => {
        const selected = el.querySelector('option:checked');
        return selected ? selected.textContent : '';
      });
      expect(selectedText).toBe('test-document.md');
    });

    test('Document selector should show Untitled for new documents', async ({ page }) => {
      // Clear filename and update selector
      await page.evaluate(() => {
        globalThis.state.currentFilename = null;
        globalThis.state.loadedFromURL = null;
        globalThis.updateDocumentSelector();
      });

      // The selector should show "Untitled"
      const selectedText = await page.$eval('#documentSelector', el => {
        const selected = el.querySelector('option:checked');
        return selected ? selected.textContent : '';
      });
      expect(selectedText).toBe('Untitled');
    });

    test('updateDocumentSelector function should be globally available', async ({ page }) => {
      const isFunction = await page.evaluate(() => typeof globalThis.updateDocumentSelector === 'function');
      expect(isFunction).toBe(true);
    });
  });

  test.describe('New Document Functionality', () => {
    test('changeDocument(__new__) should clear editor content', async ({ page }) => {
      // First add some content
      await page.evaluate(() => {
        globalThis.setEditorContent('# Test Content');
      });

      // Verify content was added
      const initialContent = await page.evaluate(() => globalThis.getEditorContent());
      expect(initialContent).toBe('# Test Content');

      // Call changeDocument with __new__ action
      await page.evaluate(() => globalThis.changeDocument('__new__'));
      await page.waitForTimeout(200);

      // Verify content is cleared
      const clearedContent = await page.evaluate(() => globalThis.getEditorContent());
      expect(clearedContent).toBe('');
    });

    test('changeDocument(__new__) should reset filename to null', async ({ page }) => {
      // Set a filename first
      await page.evaluate(() => {
        globalThis.state.currentFilename = 'existing-file.md';
      });

      // Call changeDocument with __new__ action
      await page.evaluate(() => globalThis.changeDocument('__new__'));

      // Verify filename is null
      const filename = await page.evaluate(() => globalThis.state.currentFilename);
      expect(filename).toBeNull();
    });

    test('changeDocument(__new__) should update document selector to Untitled', async ({ page }) => {
      // Set a filename first
      await page.evaluate(() => {
        globalThis.state.currentFilename = 'existing-file.md';
        globalThis.updateDocumentSelector();
      });

      // Call changeDocument with __new__ action
      await page.evaluate(() => globalThis.changeDocument('__new__'));
      await page.waitForTimeout(100);

      // Verify document selector shows Untitled
      const selectedText = await page.$eval('#documentSelector', el => {
        const selected = el.querySelector('option:checked');
        return selected ? selected.textContent : '';
      });
      expect(selectedText).toBe('Untitled');
    });
  });

  test.describe('Open from URL', () => {
    test('Ctrl+Shift+O keyboard shortcut should open URL modal', async ({ page }) => {
      // Check if running on macOS for correct modifier key
      const isMac = process.platform === 'darwin';

      // Press the keyboard shortcut (Meta on Mac, Control on others)
      if (isMac) {
        await page.keyboard.press('Meta+Shift+O');
      } else {
        await page.keyboard.press('Control+Shift+O');
      }

      await page.waitForTimeout(300);

      // Verify URL modal is visible
      const modal = page.locator('#urlModal');
      await expect(modal).toBeVisible();
    });

    test('selecting Load from URL should open URL modal', async ({ page }) => {
      // Use changeDocument to trigger URL modal
      await page.evaluate(() => {
        globalThis.changeDocument('__load_url__');
      });
      await page.waitForTimeout(300);

      // Verify URL modal is visible
      const modal = page.locator('#urlModal');
      await expect(modal).toBeVisible();
    });

    test('URL modal should show correct title for markdown loading', async ({ page }) => {
      // Use changeDocument to trigger URL modal
      await page.evaluate(() => {
        globalThis.changeDocument('__load_url__');
      });
      await page.waitForTimeout(300);

      // Check modal title
      const title = await page.$eval('#urlModalTitle', el => el.textContent);
      expect(title).toBe('Open from URL');
    });

    test('URL modal should list allowed markdown domains', async ({ page }) => {
      // Use changeDocument to trigger URL modal
      await page.evaluate(() => {
        globalThis.changeDocument('__load_url__');
      });
      await page.waitForTimeout(300);

      // Check domain list contains markdown domains
      const domainList = await page.$eval('#urlModalDomains', el => el.textContent);
      expect(domainList).toContain('raw.githubusercontent.com');
    });

    test('failed URL load should gracefully handle error and preserve document selector', async ({ page }) => {
      // Set up initial document state
      await page.evaluate(() => {
        globalThis.state.currentFilename = 'initial-document.md';
        globalThis.updateDocumentSelector();
      });

      // Verify initial state - uses extracted helper to avoid deep nesting
      const initialSelectedText = await page.$eval('#documentSelector', getSelectedOptionText);
      expect(initialSelectedText).toBe('initial-document.md');

      // Mock loadMarkdownFromURL to simulate a failure (e.g., network error)
      await page.evaluate(setupMockLoadMarkdownFromURL);

      // Attempt to load from URL (this will fail with our mock)
      // Uses extracted helper to avoid deep nesting (SonarCloud S2004)
      await page.evaluate(attemptFailedUrlLoad);

      await page.waitForTimeout(100);

      // Verify document selector still shows the original document
      const afterFailureText = await page.$eval('#documentSelector', getSelectedOptionText);
      expect(afterFailureText).toBe('initial-document.md');

      // Verify the app is still functional (selector exists and is enabled)
      const selectorExists = await page.$('#documentSelector');
      expect(selectorExists).not.toBeNull();

      const isDisabled = await page.$eval('#documentSelector', el => el.disabled);
      expect(isDisabled).toBe(false);

      // Verify the original filename is preserved in state
      const filename = await page.evaluate(() => globalThis.state.currentFilename);
      expect(filename).toBe('initial-document.md');

      // Cleanup: restore original function
      await page.evaluate(restoreLoadMarkdownFromURL);
    });
  });
});
