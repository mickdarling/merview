// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  waitForGlobalFunctions,
  isGlobalFunctionAvailable,
  loadSampleContent
} = require('./helpers/test-utils');

/**
 * Timeout for checking export results
 */
const EXPORT_CHECK_TIMEOUT_MS = 200;

/**
 * Browser-side helper: Test export function with mock
 * @param {Object} opts - Configuration
 * @param {'print'|'open'} opts.mockType - Which global to mock
 * @param {string} opts.exportFn - Export function name to call
 * @param {boolean} opts.clearContent - Whether to clear wrapper first
 */
function browserTestExport({ mockType, exportFn, clearContent }) {
  const checkTimeout = 200;
  return new Promise(function resolveAfterTest(resolve) {
    const state = { functionCalled: false, errorStatus: null };
    let originalContent = null;

    const wrapper = document.getElementById('wrapper');
    if (clearContent) {
      originalContent = wrapper.innerHTML;
      wrapper.innerHTML = '';
    }

    const originalFn = globalThis[mockType];
    if (mockType === 'print') {
      globalThis.print = function mockPrintFn() { state.functionCalled = true; };
    } else {
      globalThis.open = function mockOpenFn() {
        state.functionCalled = true;
        return { document: { open() {}, write() {}, close() {} }, onload: null };
      };
    }

    const statusElement = document.getElementById('status');
    const observer = new MutationObserver(function onStatusChange() {
      const statusText = statusElement.textContent;
      if (statusText?.includes('Error')) state.errorStatus = statusText;
    });
    observer.observe(statusElement, { childList: true, subtree: true, characterData: true });

    globalThis[exportFn]();

    setTimeout(function checkResults() {
      observer.disconnect();
      globalThis[mockType] = originalFn;
      if (clearContent && originalContent !== null) wrapper.innerHTML = originalContent;
      resolve({ functionCalled: state.functionCalled, errorStatus: state.errorStatus });
    }, checkTimeout);
  });
}

/**
 * Browser-side helper: Validate content before print export
 */
function browserValidatePrintContent() {
  const wrapper = document.getElementById('wrapper');
  const originalContent = wrapper.innerHTML;
  wrapper.innerHTML = '   ';

  const state = { printCalled: false };
  const originalPrint = globalThis.print;

  function mockPrintValidation() {
    state.printCalled = true;
  }

  globalThis.print = mockPrintValidation;
  globalThis.exportToPDF();
  globalThis.print = originalPrint;
  wrapper.innerHTML = originalContent;

  return !state.printCalled;
}

/**
 * Browser-side helper: Validate content before open export
 */
function browserValidateOpenContent() {
  const wrapper = document.getElementById('wrapper');
  const originalContent = wrapper.innerHTML;
  wrapper.innerHTML = '   ';

  const state = { openCalled: false };
  const originalOpen = globalThis.open;

  function mockOpenValidation() {
    state.openCalled = true;
    return { document: { open() {}, write() {}, close() {} }, onload: null };
  }

  globalThis.open = mockOpenValidation;
  globalThis.exportToPDFDirect();
  globalThis.open = originalOpen;
  wrapper.innerHTML = originalContent;

  return !state.openCalled;
}

/**
 * Browser-side helper: Test style element access during export
 */
function browserTestStyleAccess() {
  globalThis.loadSample();

  try {
    const wrapper = document.getElementById('wrapper');
    if (!wrapper?.innerHTML.trim()) {
      return { success: false, error: 'No content in wrapper' };
    }

    const originalOpen = globalThis.open;

    function mockOpenStyleTest() {
      return { document: { open() {}, write() {}, close() {} }, onload: null };
    }

    globalThis.open = mockOpenStyleTest;
    globalThis.exportToPDFDirect();
    globalThis.open = originalOpen;

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Browser-side helper: Observe status message during export
 * @param {Object} opts - Configuration
 * @param {'print'|'open'} opts.mockType - Which function to mock
 * @param {string} opts.searchText - Text to search for in status
 * @param {string} opts.exportFn - Export function to call
 */
function browserObserveStatusMessage({ mockType, searchText, exportFn }) {
  const checkTimeout = 200;

  return new Promise(function resolveAfterStatusCheck(resolve) {
    const statusRef = { statusMessage: null };
    const statusElement = document.getElementById('status');

    function observeStatusChange() {
      const text = statusElement.textContent;
      if (text?.includes(searchText)) {
        statusRef.statusMessage = text;
      }
    }

    const observer = new MutationObserver(observeStatusChange);
    observer.observe(statusElement, { childList: true, subtree: true, characterData: true });

    const originalFn = globalThis[mockType];

    function mockGlobalFn() {
      if (mockType === 'open') {
        return { document: { open() {}, write() {}, close() {} }, onload: null };
      }
    }

    globalThis[mockType] = mockGlobalFn;
    globalThis[exportFn]();

    function checkStatus() {
      observer.disconnect();
      globalThis[mockType] = originalFn;
      resolve(statusRef.statusMessage);
    }

    setTimeout(checkStatus, checkTimeout);
  });
}

/**
 * Tests for Export to PDF functionality
 */
test.describe('Export PDF Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
    await waitForGlobalFunctions(page, ['exportToPDF', 'exportToPDFDirect']);
  });

  test.describe('Export Buttons', () => {
    const buttons = [
      { selector: 'button[onclick="exportToPDF()"]', handler: 'exportToPDF()', name: 'Print/PDF' },
      { selector: 'button[onclick="exportToPDFDirect()"]', handler: 'exportToPDFDirect()', name: 'Print (New Tab)' }
    ];

    for (const btn of buttons) {
      test(`${btn.name} button should exist in toolbar`, async ({ page }) => {
        expect(await page.$(btn.selector)).not.toBeNull();
      });

      test(`${btn.name} button should have correct onclick handler`, async ({ page }) => {
        const onclick = await page.$eval(btn.selector, el => el.getAttribute('onclick'));
        expect(onclick).toBe(btn.handler);
      });
    }
  });

  test.describe('Global Functions', () => {
    for (const fnName of ['exportToPDF', 'exportToPDFDirect']) {
      test(`${fnName} function should be globally available`, async ({ page }) => {
        expect(await isGlobalFunctionAvailable(page, fnName)).toBe(true);
      });
    }
  });

  test.describe('Dependencies', () => {
    test('wrapper element should exist for export content', async ({ page }) => {
      expect(await page.$('#wrapper')).not.toBeNull();
    });

    test('wrapper element should be inside preview container', async ({ page }) => {
      const wrapperInPreview = await page.evaluate(() => {
        const preview = document.getElementById('preview');
        const wrapper = document.getElementById('wrapper');
        return preview && wrapper && preview.contains(wrapper);
      });
      expect(wrapperInPreview).toBe(true);
    });

    test('status element should exist for error messages', async ({ page }) => {
      expect(await page.$('#status')).not.toBeNull();
    });
  });

  test.describe('exportToPDF() Behavior', () => {
    test('exportToPDF should trigger window.print when content exists', async ({ page }) => {
      await loadSampleContent(page);
      const result = await page.evaluate(browserTestExport, { mockType: 'print', exportFn: 'exportToPDF', clearContent: false });
      expect(result.functionCalled).toBe(true);
      expect(result.errorStatus).toBeNull();
    });

    test('exportToPDF should show error when no content exists', async ({ page }) => {
      const result = await page.evaluate(browserTestExport, { mockType: 'print', exportFn: 'exportToPDF', clearContent: true });
      expect(result.functionCalled).toBe(false);
      expect(result.errorStatus).toContain('Error');
      expect(result.errorStatus).toContain('No content');
    });

    test('exportToPDF should validate wrapper content before proceeding', async ({ page }) => {
      const validatesContent = await page.evaluate(browserValidatePrintContent);
      expect(validatesContent).toBe(true);
    });
  });

  test.describe('exportToPDFDirect() Behavior', () => {
    test('exportToPDFDirect should open new window when content exists', async ({ page }) => {
      await loadSampleContent(page);
      const result = await page.evaluate(browserTestExport, { mockType: 'open', exportFn: 'exportToPDFDirect', clearContent: false });
      expect(result.functionCalled).toBe(true);
      expect(result.errorStatus).toBeNull();
    });

    test('exportToPDFDirect should show error when no content exists', async ({ page }) => {
      const result = await page.evaluate(browserTestExport, { mockType: 'open', exportFn: 'exportToPDFDirect', clearContent: true });
      expect(result.functionCalled).toBe(false);
      expect(result.errorStatus).toContain('Error');
      expect(result.errorStatus).toContain('No content');
    });

    test('exportToPDFDirect should validate wrapper content before proceeding', async ({ page }) => {
      const validatesContent = await page.evaluate(browserValidateOpenContent);
      expect(validatesContent).toBe(true);
    });

    test('exportToPDFDirect should access current style and syntax theme elements', async ({ page }) => {
      const result = await page.evaluate(browserTestStyleAccess);
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  test.describe('Status Messages', () => {
    test('exportToPDF should show status message before opening print dialog', async ({ page }) => {
      await loadSampleContent(page);
      const statusShown = await page.evaluate(
        browserObserveStatusMessage,
        { mockType: 'print', searchText: 'print', exportFn: 'exportToPDF' }
      );
      expect(statusShown).not.toBeNull();
      expect(statusShown.toLowerCase()).toContain('print');
    });

    test('exportToPDFDirect should show status message when generating PDF', async ({ page }) => {
      await loadSampleContent(page);
      const statusShown = await page.evaluate(
        browserObserveStatusMessage,
        { mockType: 'open', searchText: 'PDF', exportFn: 'exportToPDFDirect' }
      );
      expect(statusShown).not.toBeNull();
    });
  });
});
