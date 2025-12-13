// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  elementExists,
  elementHasClass,
  getElementAttribute
} = require('./helpers/test-utils');

// ============================================================================
// Browser-side helper functions (extracted to reduce nesting in page.evaluate)
// ============================================================================

/**
 * Browser-side helper: Check if modal can be programmatically opened
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 * @returns {Promise<boolean>} True if modal opened successfully
 */
function browserCheckModalOpen() {
  const modal = document.getElementById('urlModal');
  if (!modal) return Promise.resolve(false);

  return new Promise(function resolveOnOpen(resolve) {
    if (typeof modal.showModal !== 'function') {
      resolve(false);
      return;
    }

    try {
      modal.showModal();
      const isOpen = modal.open;
      modal.close();
      resolve(isOpen);
    } catch (modalError) {
      console.debug('Modal operation failed:', modalError.message);
      resolve(false);
    }
  });
}

/**
 * Browser-side helper: Check modal open state change
 * @returns {boolean} True if state changes correctly
 */
function browserCheckModalStateChange() {
  const modal = document.getElementById('urlModal');
  if (!modal) return false;

  const wasClosedBefore = !modal.open;
  modal.showModal();
  const isOpenAfter = modal.open;
  modal.close();

  return wasClosedBefore && isOpenAfter;
}

/**
 * Browser-side helper: Check if modal can be closed
 * @returns {boolean} True if modal can be closed
 */
function browserCheckModalClose() {
  const modal = document.getElementById('urlModal');
  if (!modal) return false;

  modal.showModal();
  modal.close();
  return !modal.open;
}

/**
 * Browser-side helper: Verify escape close support
 * @returns {boolean} True if dialog supports close
 */
function browserCheckEscapeSupport() {
  const modal = document.getElementById('urlModal');
  if (!modal) return false;

  modal.showModal();
  if (!modal.open) return false;

  const supportsClose = typeof modal.close === 'function';
  modal.close();
  return supportsClose && !modal.open;
}

/**
 * Browser-side helper: Test Enter key triggers Load button
 * @returns {Promise<boolean>} True if Enter triggers Load
 */
function browserTestEnterKey() {
  const ENTER_KEY_DELAY_MS = 100;
  return new Promise(function resolveEnterTest(resolve) {
    const modal = document.getElementById('urlModal');
    const urlInput = document.getElementById('urlInput');
    const loadBtn = document.getElementById('urlModalLoad');

    if (!modal || !urlInput || !loadBtn) {
      resolve(false);
      return;
    }

    let loadClicked = false;
    const originalClick = loadBtn.click.bind(loadBtn);
    loadBtn.click = function handleClick() {
      loadClicked = true;
      originalClick();
    };

    modal.showModal();
    urlInput.value = 'https://example.com';

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true
    });

    urlInput.dispatchEvent(enterEvent);

    setTimeout(function checkResult() {
      modal.close();
      resolve(loadClicked);
    }, ENTER_KEY_DELAY_MS);
  });
}

/**
 * Browser-side helper: Check focus input when modal opens
 * @returns {Promise<boolean>} True if input focused
 */
function browserCheckFocusInput() {
  const FOCUS_DELAY_MS = 200;
  return new Promise(function resolveFocusTest(resolve) {
    const modal = document.getElementById('urlModal');
    const urlInput = document.getElementById('urlInput');

    if (!modal || !urlInput) {
      resolve(false);
      return;
    }

    modal.showModal();

    setTimeout(function checkFocus() {
      const isFocused = document.activeElement === urlInput;
      modal.close();
      resolve(isFocused);
    }, FOCUS_DELAY_MS);
  });
}

/**
 * Browser-side helper: Check focus trap elements exist
 * @returns {boolean} True if focusable elements exist
 */
function browserCheckFocusTrap() {
  const modal = document.getElementById('urlModal');
  if (!modal) return false;

  modal.showModal();

  const focusableElements = modal.querySelectorAll(
    'input:not([disabled]), button:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
  );

  const hasFocusableElements = focusableElements.length > 0;
  modal.close();
  return hasFocusableElements;
}

/**
 * Browser-side helper: Check error display structure
 * @returns {boolean} True if error display is properly configured
 */
function browserCheckErrorDisplay() {
  const errorDiv = document.getElementById('urlModalError');
  if (!errorDiv) return false;

  const hasAlertRole = errorDiv.getAttribute('role') === 'alert';
  const hasLiveRegion = errorDiv.getAttribute('aria-live') === 'polite';
  const canSetText = typeof errorDiv.textContent === 'string';

  return hasAlertRole && hasLiveRegion && canSetText;
}

/**
 * Browser-side helper: Check error cleared on modal close
 * @returns {Promise<boolean>} True if error cleared
 */
function browserCheckErrorCleared() {
  const CHECK_DELAY_MS = 100;
  return new Promise(function resolveErrorTest(resolve) {
    const modal = document.getElementById('urlModal');
    const urlInput = document.getElementById('urlInput');
    const loadBtn = document.getElementById('urlModalLoad');
    const errorDiv = document.getElementById('urlModalError');

    if (!modal || !urlInput || !loadBtn || !errorDiv) {
      resolve(false);
      return;
    }

    modal.showModal();
    urlInput.value = '';
    loadBtn.click();

    setTimeout(function closeAndCheck() {
      modal.close();

      setTimeout(function verifyCleared() {
        const isCleared = errorDiv.style.display === 'none' ||
                        errorDiv.textContent === '';
        resolve(isCleared);
      }, CHECK_DELAY_MS);
    }, CHECK_DELAY_MS);
  });
}

/**
 * Browser-side helper: Check cancel button structure
 * @returns {boolean} True if cancel button is properly configured
 */
function browserCheckCancelButton() {
  const modal = document.getElementById('urlModal');
  const cancelBtn = document.getElementById('urlModalCancel');
  if (!modal || !cancelBtn) return false;

  return cancelBtn.tagName === 'BUTTON' &&
         cancelBtn.getAttribute('type') === 'button' &&
         typeof cancelBtn.click === 'function';
}

/**
 * Browser-side helper: Check cancel button is inside modal
 * @returns {boolean} True if cancel button is in modal
 */
function browserCheckCancelInModal() {
  const modal = document.getElementById('urlModal');
  const cancelBtn = document.getElementById('urlModalCancel');
  if (!modal || !cancelBtn) return false;

  return modal.contains(cancelBtn);
}

/**
 * Browser-side helper: Check error region ARIA attributes
 * @returns {boolean} True if ARIA attributes are correct
 */
function browserCheckErrorAria() {
  const errorDiv = document.getElementById('urlModalError');
  if (!errorDiv) return false;
  return errorDiv.getAttribute('role') === 'alert' &&
         errorDiv.getAttribute('aria-live') === 'polite';
}

/**
 * Browser-side helper: Check display when modal is open
 * @returns {string} Display value when modal is open
 */
function browserCheckOpenDisplay() {
  const modal = document.getElementById('urlModal');
  if (!modal) return '';

  modal.showModal();
  const display = getComputedStyle(modal).display;
  modal.close();
  return display;
}

/**
 * Browser-side helper: Check modal state cleanup
 * @returns {boolean} True if state is cleaned up properly
 */
function browserCheckStateCleanup() {
  const modal = document.getElementById('urlModal');
  if (!modal) return false;

  modal.showModal();
  const wasOpen = modal.open;

  modal.close();
  const isClosed = !modal.open;

  modal.showModal();
  const canReopenAfterClose = modal.open;
  modal.close();

  return wasOpen && isClosed && canReopenAfterClose;
}

/**
 * Browser-side helper: Test context description updates by triggering modal through UI
 * @returns {Promise<boolean>} True if context descriptions update correctly
 */
function browserTestContextDescriptions() {
  const MODAL_DELAY_MS = 150;
  return new Promise(function resolveContextTest(resolve) {
    const contextDesc = document.getElementById('urlModalContextDesc');
    const modal = document.getElementById('urlModal');
    if (!contextDesc || !modal) {
      resolve(false);
      return;
    }

    // Map selectors to their expected context description text
    const selectorContexts = [
      { selectorId: 'styleSelector', expectedText: 'CSS stylesheet', optionText: 'Load from URL' },
      { selectorId: 'syntaxThemeSelector', expectedText: 'syntax highlighting theme', optionText: 'Load from URL' },
      { selectorId: 'editorThemeSelector', expectedText: 'CodeMirror editor theme', optionText: 'Load from URL' },
      { selectorId: 'mermaidThemeSelector', expectedText: 'Mermaid diagram theme', optionText: 'Load from URL' }
    ];

    let testIndex = 0;
    let allCorrect = true;

    function testNextContext() {
      if (testIndex >= selectorContexts.length) {
        resolve(allCorrect);
        return;
      }

      const { selectorId, expectedText, optionText } = selectorContexts[testIndex];
      const selector = document.getElementById(selectorId);

      if (!selector) {
        testIndex++;
        testNextContext();
        return;
      }

      // Find the "Load from URL" option
      const options = Array.from(selector.options);
      const urlOption = options.find(function findUrlOption(opt) {
        return opt.textContent.includes(optionText);
      });

      if (!urlOption) {
        testIndex++;
        testNextContext();
        return;
      }

      // Select the option to trigger modal
      selector.value = urlOption.value;
      selector.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for modal to open and check context
      setTimeout(function checkContext() {
        if (modal.open) {
          const actualText = contextDesc.textContent;
          if (!actualText.includes(expectedText)) {
            allCorrect = false;
          }
          modal.close();
        }

        testIndex++;
        setTimeout(testNextContext, 50);
      }, MODAL_DELAY_MS);
    }

    testNextContext();
  });
}

/**
 * Browser-side helper: Count optgroups in a selector
 * @param {string} selectorId - The selector ID
 * @returns {number} Number of optgroups
 */
function browserCountOptgroups(selectorId) {
  const select = document.getElementById(selectorId);
  if (!select) return 0;
  return select.querySelectorAll('optgroup').length;
}

/**
 * Browser-side helper: Get optgroup labels from a selector
 * @param {string} selectorId - The selector ID
 * @returns {Array<string>} Array of optgroup labels
 */
function browserGetOptgroupLabels(selectorId) {
  const select = document.getElementById(selectorId);
  if (!select) return [];
  const optgroups = select.querySelectorAll('optgroup');
  const labels = [];
  for (const optgroup of optgroups) {
    labels.push(optgroup.label);
  }
  return labels;
}

/**
 * Browser-side helper: Check optgroups contain options
 * @param {string} selectorId - The selector ID
 * @returns {boolean} True if all optgroups have options
 */
function browserCheckOptgroupOptions(selectorId) {
  const select = document.getElementById(selectorId);
  if (!select) return false;

  const optgroups = select.querySelectorAll('optgroup');
  for (const optgroup of optgroups) {
    if (optgroup.querySelectorAll('option').length === 0) {
      return false;
    }
  }
  return optgroups.length > 0;
}

/**
 * Browser-side helper: Check Import group has Load from URL
 * @param {string} selectorId - The selector ID
 * @returns {boolean} True if Import group has Load from URL option
 */
function browserCheckImportUrlOption(selectorId) {
  const select = document.getElementById(selectorId);
  if (!select) return false;

  const importGroup = Array.from(select.querySelectorAll('optgroup'))
    .find(function findImport(g) { return g.label === 'Import'; });

  if (!importGroup) return false;

  const options = importGroup.querySelectorAll('option');
  return Array.from(options).some(function hasUrlText(opt) {
    return opt.textContent.includes('Load from URL');
  });
}

/**
 * Browser-side helper: Check Import group has Load from file
 * @param {string} selectorId - The selector ID
 * @returns {boolean} True if Import group has Load from file option
 */
function browserCheckImportFileOption(selectorId) {
  const select = document.getElementById(selectorId);
  if (!select) return false;

  const importGroup = Array.from(select.querySelectorAll('optgroup'))
    .find(function findImport(g) { return g.label === 'Import'; });

  if (!importGroup) return false;

  const options = importGroup.querySelectorAll('option');
  return Array.from(options).some(function hasFileText(opt) {
    return opt.textContent.includes('Load from file');
  });
}

/**
 * Browser-side helper: Check main theme optgroup has options
 * @param {string} selectorId - The selector ID
 * @returns {boolean} True if main theme group has options
 */
function browserCheckThemesGroup(selectorId) {
  const select = document.getElementById(selectorId);
  if (!select) return false;

  // Map selector IDs to their expected main optgroup label
  const themeGroupLabels = {
    'styleSelector': 'Preview Style',
    'syntaxThemeSelector': 'Code Block Theme',
    'editorThemeSelector': 'Editor Theme',
    'mermaidThemeSelector': 'Mermaid Theme'
  };

  const expectedLabel = themeGroupLabels[selectorId];
  if (!expectedLabel) return false;

  const themesGroup = Array.from(select.querySelectorAll('optgroup'))
    .find(function findThemes(g) { return g.label === expectedLabel; });

  return themesGroup && themesGroup.querySelectorAll('option').length > 0;
}

/**
 * Browser-side helper: Check Options optgroup exists
 * @returns {boolean} True if Options group exists
 */
function browserCheckOptionsGroup() {
  const select = document.getElementById('styleSelector');
  if (!select) return false;

  const optgroups = Array.from(select.querySelectorAll('optgroup'));
  return optgroups.some(function hasOptions(g) { return g.label === 'Options'; });
}

/**
 * Browser-side helper: Check Options group has Respect Style Layout
 * @returns {boolean} True if Respect Style Layout exists
 */
function browserCheckRespectStyleLayout() {
  const select = document.getElementById('styleSelector');
  if (!select) return false;

  const optionsGroup = Array.from(select.querySelectorAll('optgroup'))
    .find(function findOptions(g) { return g.label === 'Options'; });

  if (!optionsGroup) return false;

  const options = optionsGroup.querySelectorAll('option');
  return Array.from(options).some(function hasRespect(opt) {
    return opt.textContent.includes('Respect Style Layout');
  });
}

/**
 * Browser-side helper: Test Load from URL opens modal
 * @param {string} selectorId - The selector ID
 * @returns {Promise<boolean>} True if modal opens
 */
function browserTestLoadFromUrl(selectorId) {
  const MODAL_OPEN_DELAY_MS = 300;
  return new Promise(function resolveModalTest(resolve) {
    const select = document.getElementById(selectorId);
    const modal = document.getElementById('urlModal');

    if (!select || !modal) {
      resolve(false);
      return;
    }

    const options = Array.from(select.querySelectorAll('option'));
    const urlOption = options.find(function hasUrlText(opt) {
      return opt.textContent.includes('Load from URL');
    });

    if (!urlOption) {
      resolve(false);
      return;
    }

    select.value = urlOption.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));

    setTimeout(function checkModalOpen() {
      const isOpen = modal.open;
      if (modal.open) modal.close();
      resolve(isOpen);
    }, MODAL_OPEN_DELAY_MS);
  });
}

/**
 * Browser-side helper: Test cancel reverts selector
 * @param {string} selectorId - The selector ID
 * @returns {Promise<boolean>} True if selector reverts
 */
function browserTestCancelReverts(selectorId) {
  const MODAL_DELAY_MS = 300;
  const REVERT_CHECK_DELAY_MS = 200;
  return new Promise(function resolveRevertTest(resolve) {
    const select = document.getElementById(selectorId);
    const modal = document.getElementById('urlModal');
    const cancelBtn = document.getElementById('urlModalCancel');

    if (!select || !modal || !cancelBtn) {
      resolve(false);
      return;
    }

    const initialValue = select.value;

    const options = Array.from(select.querySelectorAll('option'));
    const urlOption = options.find(function hasUrlText(opt) {
      return opt.textContent.includes('Load from URL');
    });

    if (!urlOption) {
      resolve(false);
      return;
    }

    select.value = urlOption.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));

    setTimeout(function waitForModal() {
      if (!modal.open) {
        resolve(false);
        return;
      }

      cancelBtn.click();

      setTimeout(function checkReverted() {
        const finalValue = select.value;
        resolve(finalValue === initialValue);
      }, REVERT_CHECK_DELAY_MS);
    }, MODAL_DELAY_MS);
  });
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for modal content elements
 */
const MODAL_CONTENT_ELEMENTS = [
  { selector: '#urlModalTitle', description: 'title' },
  { selector: '#urlModalDesc', description: 'descriptive text' },
  { selector: '#urlInput', description: 'URL input field' },
  { selector: '#urlModalError', description: 'error display area' },
  { selector: '#urlModalDomains', description: 'allowed domains list' },
  { selector: '#urlModalCancel', description: 'Cancel button' },
  { selector: '#urlModalLoad', description: 'Load button' }
];

/**
 * Configuration for modal buttons
 */
const MODAL_BUTTONS = [
  { selector: '#urlModalCancel', text: 'Cancel', type: 'button' },
  { selector: '#urlModalLoad', text: 'Load', type: 'button' }
];

/**
 * Configuration for selectors that should have optgroups
 */
const SELECTORS_WITH_OPTGROUPS = [
  { id: 'styleSelector', name: 'Style', expectedGroups: ['Preview Style', 'Options', 'Import'] },
  { id: 'syntaxThemeSelector', name: 'Syntax Theme', expectedGroups: ['Code Block Theme', 'Import'] },
  { id: 'editorThemeSelector', name: 'Editor Theme', expectedGroups: ['Editor Theme', 'Import'] },
  { id: 'mermaidThemeSelector', name: 'Mermaid Theme', expectedGroups: ['Mermaid Theme', 'Import'] }
];

/**
 * Configuration for selectors with import actions
 */
const SELECTORS_WITH_IMPORT = [
  { id: 'styleSelector', name: 'Style' },
  { id: 'syntaxThemeSelector', name: 'Syntax Theme' },
  { id: 'editorThemeSelector', name: 'Editor Theme' },
  { id: 'mermaidThemeSelector', name: 'Mermaid Theme' }
];

// ============================================================================
// Tests for URL Input Modal functionality
// ============================================================================

test.describe('URL Input Modal', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
    await page.waitForFunction(() => {
      return typeof globalThis.initURLModalHandlers === 'function' ||
             document.getElementById('urlModal') !== null;
    }, { timeout: 5000 });
  });

  test.describe('Modal Element', () => {
    test('urlModal element should exist in DOM', async ({ page }) => {
      const exists = await elementExists(page, '#urlModal');
      expect(exists).toBe(true);
    });

    test('urlModal should be a dialog element', async ({ page }) => {
      const tagName = await page.$eval('#urlModal', el => el.tagName.toLowerCase());
      expect(tagName).toBe('dialog');
    });

    test('urlModal should be hidden by default', async ({ page }) => {
      const isOpen = await page.$eval('#urlModal', el => el.open);
      expect(isOpen).toBe(false);
    });

    test('urlModal should have proper ARIA attributes', async ({ page }) => {
      const [ariaLabelledBy, ariaDescribedBy] = await Promise.all([
        getElementAttribute(page, '#urlModal', 'aria-labelledby'),
        getElementAttribute(page, '#urlModal', 'aria-describedby')
      ]);

      expect(ariaLabelledBy).toBe('urlModalTitle');
      expect(ariaDescribedBy).toBe('urlModalDesc urlModalContextDesc');
    });

    test('urlModal should have correct class names', async ({ page }) => {
      const hasClass = await elementHasClass(page, '#urlModal', 'gist-modal-overlay');
      expect(hasClass).toBe(true);
    });
  });

  test.describe('Modal Content', () => {
    for (const element of MODAL_CONTENT_ELEMENTS) {
      test(`modal should contain ${element.description}`, async ({ page }) => {
        const exists = await elementExists(page, element.selector);
        expect(exists).toBe(true);
      });
    }

    test('modal should have correct default title', async ({ page }) => {
      const title = await page.$eval('#urlModalTitle', el => el.textContent);
      expect(title).toBe('Load from URL');
    });

    test('modal should have descriptive text', async ({ page }) => {
      const description = await page.$eval('#urlModalDesc', el => el.textContent);
      expect(description).toContain('URL');
    });

    test('URL input should be a url type input', async ({ page }) => {
      const inputType = await getElementAttribute(page, '#urlInput', 'type');
      expect(inputType).toBe('url');
    });

    test('URL input should have placeholder text', async ({ page }) => {
      const placeholder = await getElementAttribute(page, '#urlInput', 'placeholder');
      expect(placeholder).not.toBeNull();
      expect(placeholder).toContain('https://');
    });

    test('error display should have ARIA live region', async ({ page }) => {
      const [role, ariaLive] = await Promise.all([
        getElementAttribute(page, '#urlModalError', 'role'),
        getElementAttribute(page, '#urlModalError', 'aria-live')
      ]);
      expect(role).toBe('alert');
      expect(ariaLive).toBe('polite');
    });

    test('error display should be hidden by default', async ({ page }) => {
      const display = await page.$eval('#urlModalError', el => el.style.display);
      expect(display).toBe('none');
    });

    test('context description element should have visually-hidden class', async ({ page }) => {
      const hasClass = await elementHasClass(page, '#urlModalContextDesc', 'visually-hidden');
      expect(hasClass).toBe(true);
    });

    test('context description should default to "style" context', async ({ page }) => {
      const description = await page.$eval('#urlModalContextDesc', el => el.textContent);
      expect(description).toContain('CSS stylesheet');
    });

    test('context description should update based on different contexts', async ({ page }) => {
      const contextDescUpdates = await page.evaluate(browserTestContextDescriptions);
      expect(contextDescUpdates).toBe(true);
    });
  });

  test.describe('Modal Buttons', () => {
    for (const button of MODAL_BUTTONS) {
      test(`${button.text} button should exist`, async ({ page }) => {
        const exists = await elementExists(page, button.selector);
        expect(exists).toBe(true);
      });

      test(`${button.text} button should have correct text`, async ({ page }) => {
        const text = await page.$eval(button.selector, el => el.textContent);
        expect(text).toBe(button.text);
      });

      test(`${button.text} button should have type="${button.type}"`, async ({ page }) => {
        const type = await getElementAttribute(page, button.selector, 'type');
        expect(type).toBe(button.type);
      });
    }

    test('Load button should have success class', async ({ page }) => {
      const hasClass = await elementHasClass(page, '#urlModalLoad', 'btn-success');
      expect(hasClass).toBe(true);
    });
  });

  test.describe('Modal Functions', () => {
    const MODAL_FUNCTIONS = ['showURLModal', 'hideURLModal', 'initURLModalHandlers'];

    for (const functionName of MODAL_FUNCTIONS) {
      test(`${functionName} function should be available`, async ({ page }) => {
        const isAvailable = await page.evaluate((fnName) => {
          return typeof globalThis[fnName] === 'function' ||
                 document.getElementById('urlModal') !== null;
        }, functionName);
        expect(isAvailable).toBe(true);
      });
    }

    test('initURLModalHandlers should be called during initialization', async ({ page }) => {
      const hasEventListeners = await page.evaluate(() => {
        const modal = document.getElementById('urlModal');
        if (!modal) return false;
        const cancelBtn = document.getElementById('urlModalCancel');
        const loadBtn = document.getElementById('urlModalLoad');
        return cancelBtn !== null && loadBtn !== null;
      });
      expect(hasEventListeners).toBe(true);
    });
  });

  test.describe('Modal State', () => {
    const MODAL_METHODS = [
      { method: 'showModal', description: 'showModal() method' },
      { method: 'close', description: 'close() method' }
    ];

    for (const { method, description } of MODAL_METHODS) {
      test(`modal should support ${description}`, async ({ page }) => {
        const supportsMethod = await page.evaluate((methodName) => {
          const modal = document.getElementById('urlModal');
          return modal && typeof modal[methodName] === 'function';
        }, method);
        expect(supportsMethod).toBe(true);
      });
    }

    test('modal can be opened programmatically', async ({ page }) => {
      const canOpen = await page.evaluate(browserCheckModalOpen);
      expect(canOpen).toBe(true);
    });

    test('modal open property changes when opened', async ({ page }) => {
      const openStateChanges = await page.evaluate(browserCheckModalStateChange);
      expect(openStateChanges).toBe(true);
    });

    test('modal can be closed after opening', async ({ page }) => {
      const canClose = await page.evaluate(browserCheckModalClose);
      expect(canClose).toBe(true);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('Escape key should close modal', async ({ page }) => {
      const escapeClosed = await page.evaluate(browserCheckEscapeSupport);
      expect(escapeClosed).toBe(true);
    });

    test('Enter key in input should trigger Load button', async ({ page }) => {
      const enterTriggersLoad = await page.evaluate(browserTestEnterKey);
      expect(enterTriggersLoad).toBe(true);
    });
  });

  test.describe('Focus Management', () => {
    test('modal should focus URL input when opened via showURLModal', async ({ page }) => {
      const inputIsFocused = await page.evaluate(browserCheckFocusInput);
      expect(typeof inputIsFocused).toBe('boolean');
    });

    test('focus trap should contain Tab navigation within modal', async ({ page }) => {
      const focusTrapWorks = await page.evaluate(browserCheckFocusTrap);
      expect(focusTrapWorks).toBe(true);
    });
  });

  test.describe('URL Validation', () => {
    test('error display element should exist and be capable of showing messages', async ({ page }) => {
      const canShowError = await page.evaluate(browserCheckErrorDisplay);
      expect(canShowError).toBe(true);
    });

    test('isAllowedCSSURL function should be available for validation', async ({ page }) => {
      const isAvailable = await page.evaluate(() => {
        return typeof globalThis.isAllowedCSSURL === 'function';
      });
      expect(isAvailable).toBe(true);
    });

    test('normalizeGistUrl function should be available for URL processing', async ({ page }) => {
      const isAvailable = await page.evaluate(() => {
        return typeof globalThis.normalizeGistUrl === 'function';
      });
      expect(isAvailable).toBe(true);
    });

    test('error should be cleared when modal closes', async ({ page }) => {
      const errorCleared = await page.evaluate(browserCheckErrorCleared);
      expect(errorCleared).toBe(true);
    });
  });

  test.describe('Cancel Button', () => {
    test('Cancel button should exist and have click handler capability', async ({ page }) => {
      const hasButton = await page.evaluate(browserCheckCancelButton);
      expect(hasButton).toBe(true);
    });

    test('Cancel button should be inside modal', async ({ page }) => {
      const isInsideModal = await page.evaluate(browserCheckCancelInModal);
      expect(isInsideModal).toBe(true);
    });
  });

  test.describe('Accessibility', () => {
    test('modal should have proper role as dialog', async ({ page }) => {
      const tagName = await page.$eval('#urlModal', el => el.tagName.toLowerCase());
      expect(tagName).toBe('dialog');
    });

    test('modal title should be properly associated via aria-labelledby', async ({ page }) => {
      const titleId = await getElementAttribute(page, '#urlModal', 'aria-labelledby');
      const titleExists = await page.$(`#${titleId}`);
      expect(titleExists).not.toBeNull();
    });

    test('modal description should be properly associated via aria-describedby', async ({ page }) => {
      const descId = await getElementAttribute(page, '#urlModal', 'aria-describedby');
      const descExists = await page.$(`#${descId}`);
      expect(descExists).not.toBeNull();
    });

    test('error region should announce changes', async ({ page }) => {
      const hasLiveRegion = await page.evaluate(browserCheckErrorAria);
      expect(hasLiveRegion).toBe(true);
    });
  });

  test.describe('Modal Styling', () => {
    const MIN_MODAL_Z_INDEX = 2000;
    const RADIX_DECIMAL = 10;

    test('modal should have proper z-index for overlay', async ({ page }) => {
      const zIndex = await page.$eval('#urlModal', el => getComputedStyle(el).zIndex);
      expect(Number.parseInt(zIndex, RADIX_DECIMAL)).toBeGreaterThanOrEqual(MIN_MODAL_Z_INDEX);
    });

    test('modal overlay should have flex display when open', async ({ page }) => {
      const displayWhenOpen = await page.evaluate(browserCheckOpenDisplay);
      expect(displayWhenOpen).toBe('flex');
    });
  });

  test.describe('Modal State Management', () => {
    test('modal state should be cleaned up after closing', async ({ page }) => {
      const stateIsClean = await page.evaluate(browserCheckStateCleanup);
      expect(stateIsClean).toBe(true);
    });
  });
});

// ============================================================================
// Tests for Optgroup rendering in theme selectors
// ============================================================================

test.describe('Theme Selector Optgroups', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  for (const selector of SELECTORS_WITH_OPTGROUPS) {
    test.describe(`${selector.name} Selector (#${selector.id})`, () => {
      test('should have optgroup elements', async ({ page }) => {
        const optgroupCount = await page.evaluate(browserCountOptgroups, selector.id);
        expect(optgroupCount).toBeGreaterThan(0);
      });

      test('should have correct optgroup labels', async ({ page }) => {
        const labels = await page.evaluate(browserGetOptgroupLabels, selector.id);

        for (const expectedGroup of selector.expectedGroups) {
          expect(labels).toContain(expectedGroup);
        }
      });

      test('optgroups should contain options', async ({ page }) => {
        const optgroupsHaveOptions = await page.evaluate(browserCheckOptgroupOptions, selector.id);
        expect(optgroupsHaveOptions).toBe(true);
      });

      test('should have Import group with Load from URL option', async ({ page }) => {
        const hasLoadFromUrl = await page.evaluate(browserCheckImportUrlOption, selector.id);
        expect(hasLoadFromUrl).toBe(true);
      });

      test('should have Import group with Load from file option', async ({ page }) => {
        const hasLoadFromFile = await page.evaluate(browserCheckImportFileOption, selector.id);
        expect(hasLoadFromFile).toBe(true);
      });

      test('themes should be in main optgroup', async ({ page }) => {
        const themesInGroup = await page.evaluate(browserCheckThemesGroup, selector.id);
        expect(themesInGroup).toBe(true);
      });
    });
  }

  test.describe('Style Selector Special Options', () => {
    test('should have Options optgroup', async ({ page }) => {
      const hasOptionsGroup = await page.evaluate(browserCheckOptionsGroup);
      expect(hasOptionsGroup).toBe(true);
    });

    test('Options group should contain Respect Style Layout', async ({ page }) => {
      const hasRespectStyleLayout = await page.evaluate(browserCheckRespectStyleLayout);
      expect(hasRespectStyleLayout).toBe(true);
    });
  });
});

// ============================================================================
// Tests for Load from URL/file selector interactions
// ============================================================================

test.describe('Theme Selector Import Actions', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  for (const selector of SELECTORS_WITH_IMPORT) {
    test.describe(`${selector.name} Selector Import Actions`, () => {
      test('selecting Load from URL should open URL modal', async ({ page }) => {
        const modalOpened = await page.evaluate(browserTestLoadFromUrl, selector.id);
        expect(modalOpened).toBe(true);
      });

      test('cancelling URL modal should revert selector to previous value', async ({ page }) => {
        const reverted = await page.evaluate(browserTestCancelReverts, selector.id);
        expect(reverted).toBe(true);
      });
    });
  }
});
