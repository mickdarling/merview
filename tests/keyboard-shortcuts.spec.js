// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForPageReady } = require('./helpers/test-utils');

/**
 * Helper function to test if file input click is triggered by keyboard shortcut
 * @param {boolean} useMetaKey - Use Meta key (Cmd) instead of Ctrl
 * @returns {Promise<boolean>} - Whether the file input was clicked
 */
function testFileInputClick(useMetaKey = false) {
  const fileInput = document.getElementById('mdFileInput');
  if (!fileInput) {
    return Promise.resolve(false);
  }

  let clicked = false;
  const originalClick = fileInput.click.bind(fileInput);
  fileInput.click = function() {
    clicked = true;
    // Don't actually trigger the file picker in tests
  };

  // Wait a bit for keyboard shortcut to execute
  setTimeout(() => {
    fileInput.click = originalClick;
  }, 500);

  // Trigger keyboard shortcut
  const event = new KeyboardEvent('keydown', {
    key: 'o',
    ...(useMetaKey ? { metaKey: true } : { ctrlKey: true }),
    bubbles: true
  });
  document.dispatchEvent(event);

  return new Promise(resolve => {
    setTimeout(() => resolve(clicked), 500);
  });
}

/**
 * Helper function to test if print is triggered by keyboard shortcut
 * @param {boolean} useMetaKey - Use Meta key (Cmd) instead of Ctrl
 * @returns {Promise<boolean>} - Whether print was called
 */
function testPrintCalled(useMetaKey = false) {
  const originalPrint = globalThis.print;
  let wasCalled = false;

  globalThis.print = function() {
    wasCalled = true;
  };

  // Trigger keyboard shortcut
  const event = new KeyboardEvent('keydown', {
    key: 'p',
    ...(useMetaKey ? { metaKey: true } : { ctrlKey: true }),
    bubbles: true
  });
  document.dispatchEvent(event);

  return new Promise(resolve => {
    setTimeout(() => {
      globalThis.print = originalPrint;
      resolve(wasCalled);
    }, 300);
  });
}

/**
 * Helper function to test export PDF with no content
 * @returns {Promise<{printCalled: boolean, errorStatus: string|null}>}
 */
function testExportWithNoContent() {
  const originalPrint = globalThis.print;
  let printCalled = false;
  let errorStatus = null;

  globalThis.print = function() {
    printCalled = true;
  };

  // Watch for error status
  const statusElement = document.getElementById('status');
  const observer = new MutationObserver(() => {
    const text = statusElement.textContent;
    if (text?.includes('Error')) {
      errorStatus = text;
    }
  });
  observer.observe(statusElement, { childList: true, subtree: true, characterData: true });

  // Trigger keyboard shortcut
  const event = new KeyboardEvent('keydown', {
    key: 'p',
    ctrlKey: true,
    bubbles: true
  });
  document.dispatchEvent(event);

  return new Promise(resolve => {
    setTimeout(() => {
      observer.disconnect();
      globalThis.print = originalPrint;
      resolve({ printCalled, errorStatus });
    }, 300);
  });
}

/**
 * Tests for keyboard shortcuts functionality
 *
 * Keyboard shortcuts defined in js/main.js:
 * - Ctrl/Cmd + S: Save file
 * - Ctrl/Cmd + O: Open file
 * - Ctrl/Cmd + Shift + O: Open from URL
 * - Ctrl/Cmd + P: Print/Export PDF
 */
test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test.describe('Save File Shortcut (Ctrl/Cmd + S)', () => {
    test('Ctrl+S should trigger saveFile() on non-Mac', async ({ page }) => {
      // Clear the filename first and set content
      await page.evaluate(() => {
        globalThis.state.currentFilename = null;
        globalThis.setEditorContent('# Test Content');
      });

      // Set up dialog to provide filename
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('keyboard-test.md');
      });

      const downloadPromise = page.waitForEvent('download');

      // Focus editor and trigger keyboard shortcut
      await page.focus('#editor');
      await page.keyboard.press('Control+s');

      // Wait for download and verify
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('keyboard-test.md');
    });

    test('Cmd+S should trigger saveFile() on Mac', async ({ page }) => {
      // Clear the filename first and set content
      await page.evaluate(() => {
        globalThis.state.currentFilename = null;
        globalThis.setEditorContent('# Test Content');
      });

      page.once('dialog', async dialog => {
        await dialog.accept('keyboard-mac-test.md');
      });

      const downloadPromise = page.waitForEvent('download');

      // Focus editor and trigger keyboard shortcut
      await page.focus('#editor');
      await page.keyboard.press('Meta+s');

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('keyboard-mac-test.md');
    });

    test('keyboard shortcut should save with existing filename without prompting', async ({ page }) => {
      // Set filename in state and content
      await page.evaluate(() => {
        globalThis.state.currentFilename = 'existing-file.md';
        globalThis.setEditorContent('# Content');
      });

      const downloadPromise = page.waitForEvent('download');

      // Focus editor and press Ctrl+S
      await page.focus('#editor');
      await page.keyboard.press('Control+s');

      // Should download without prompt
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('existing-file.md');
    });
  });

  test.describe('Open File Shortcut (Ctrl/Cmd + O)', () => {
    test('Ctrl+O should trigger file picker', async ({ page }) => {
      // Create a spy to check if file input was clicked
      const fileInputClicked = await page.evaluate(testFileInputClick, false);

      expect(fileInputClicked).toBe(true);
    });

    test('Cmd+O should trigger file picker on Mac', async ({ page }) => {
      const fileInputClicked = await page.evaluate(testFileInputClick, true);

      expect(fileInputClicked).toBe(true);
    });
  });

  test.describe('Open from URL Shortcut (Ctrl/Cmd + Shift + O)', () => {
    test('Ctrl+Shift+O should open URL modal', async ({ page }) => {
      // Focus editor first
      await page.focus('#editor');

      // Press keyboard shortcut
      await page.keyboard.press('Control+Shift+O');

      // Wait for modal to appear
      await page.waitForSelector('#urlModal[open]', { timeout: 2000 });

      // Verify modal is visible
      const modalVisible = await page.isVisible('#urlModal[open]');
      expect(modalVisible).toBe(true);
    });

    test('Cmd+Shift+O should open URL modal on Mac', async ({ page }) => {
      // Focus editor first
      await page.focus('#editor');

      await page.keyboard.press('Meta+Shift+O');
      await page.waitForSelector('#urlModal[open]', { timeout: 2000 });

      const modalVisible = await page.isVisible('#urlModal[open]');
      expect(modalVisible).toBe(true);
    });
  });

  test.describe('Export PDF Shortcut (Ctrl/Cmd + P)', () => {
    test('Ctrl+P should trigger exportToPDF()', async ({ page }) => {
      // Set up content
      await page.evaluate(() => {
        globalThis.loadWelcomePage();
      });

      // Mock window.print to verify it gets called
      const printCalled = await page.evaluate(testPrintCalled, false);

      expect(printCalled).toBe(true);
    });

    test('Cmd+P should trigger exportToPDF() on Mac', async ({ page }) => {
      if (process.platform !== 'darwin') {
        test.skip();
      }

      await page.evaluate(() => {
        globalThis.loadWelcomePage();
      });

      const printCalled = await page.evaluate(testPrintCalled, true);

      expect(printCalled).toBe(true);
    });

    test('Ctrl+P should show error when no content exists', async ({ page }) => {
      // Clear content
      await page.evaluate(() => {
        const wrapper = document.getElementById('wrapper');
        if (wrapper) {
          wrapper.innerHTML = '';
        }
      });

      // Mock window.print to verify it doesn't get called
      const result = await page.evaluate(testExportWithNoContent);

      expect(result.printCalled).toBe(false);
      expect(result.errorStatus).toContain('Error');
      expect(result.errorStatus).toContain('No content');
    });
  });

  test.describe('Keyboard Shortcut Event Prevention', () => {
    test('Ctrl+S should prevent default browser save dialog', async ({ page }) => {
      // Clear filename to trigger prompt dialog
      await page.evaluate(() => {
        globalThis.state.currentFilename = null;
        globalThis.setEditorContent('# Test');
      });

      page.once('dialog', async dialog => {
        // This should be our custom prompt, not browser's save dialog
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('test.md');
      });

      const downloadPromise = page.waitForEvent('download');

      // Focus and press Ctrl+S
      await page.focus('#editor');
      await page.keyboard.press('Control+s');

      // If we get a download, preventDefault worked
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('test.md');
    });
  });
});
