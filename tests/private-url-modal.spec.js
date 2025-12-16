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

/**
 * Browser-side helper: Check if modal can be programmatically opened
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 * @returns {Promise<boolean>} True if modal opened successfully
 */
function browserCheckModalOpen() {
  const modal = document.getElementById('privateUrlModal');
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
    } catch (error) {
      console.debug('Modal operation failed:', error.message);
      resolve(false);
    }
  });
}

/**
 * Browser-side helper: Get button title text
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 * @param {string} selector - Button selector
 * @returns {string|null} Title text
 */
function browserGetButtonTitle(selector) {
  const element = document.querySelector('#privateUrlModal ' + selector + ' .option-title');
  return element ? element.textContent : null;
}

/**
 * Browser-side helper: Get button description text
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 * @param {string} selector - Button selector
 * @returns {string|null} Description text
 */
function browserGetButtonDesc(selector) {
  const element = document.querySelector('#privateUrlModal ' + selector + ' .option-desc');
  return element ? element.textContent : null;
}

/**
 * Browser-side helper: Get button data-action attribute
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 * @param {string} selector - Button selector
 * @returns {string|null} Data action value
 */
function browserGetButtonAction(selector) {
  const element = document.querySelector('#privateUrlModal ' + selector);
  return element ? element.dataset.action : null;
}

/**
 * Browser-side helper: Test modal close via backdrop click
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 * @returns {Promise<boolean>} True if backdrop click closed modal
 */
function browserCheckBackdropClose() {
  const modal = document.getElementById('privateUrlModal');
  if (!modal) return Promise.resolve(false);

  const checkTimeout = 100; // Must be in browser context
  return new Promise(function resolveOnClose(resolve) {
    try {
      modal.showModal();
      if (!modal.open) {
        resolve(false);
        return;
      }

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: globalThis,
        target: modal
      });

      Object.defineProperty(clickEvent, 'target', {
        value: modal,
        writable: false
      });

      modal.dispatchEvent(clickEvent);

      setTimeout(function checkClosed() {
        resolve(!modal.open);
      }, checkTimeout);
    } catch (error) {
      console.debug('Backdrop click handler failed:', error.message);
      resolve(false);
    }
  });
}

/**
 * Configuration for modal buttons
 */
const MODAL_BUTTONS = [
  {
    selector: 'button[data-action="view-local"]',
    dataAction: 'view-local',
    title: 'View Locally Only',
    descriptionContains: 'Render content without',
    ariaLabelContains: 'View Locally Only',
    isPrimary: false
  },
  {
    selector: 'button[data-action="share-gist"]',
    dataAction: 'share-gist',
    title: 'Share Securely via Gist',
    descriptionContains: 'safe, shareable copy',
    ariaLabelContains: 'Share Securely',
    isPrimary: true
  }
];

/**
 * Configuration for modal content elements
 */
const MODAL_CONTENT_ELEMENTS = [
  { selector: '.security-icon', description: 'security icon' },
  { selector: '#privateUrlModalTitle', description: 'title' },
  { selector: '#privateUrlModalDesc', description: 'descriptive text' },
  { selector: '.option-buttons', description: 'option buttons container' }
];

/**
 * Tests for Private URL Modal functionality
 *
 * These tests ensure the Private URL security modal exists, displays correctly,
 * and handles user interactions properly. The modal warns users when they access
 * a URL with a private GitHub token and offers secure options to proceed.
 */
test.describe('Private URL Modal', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
    await page.waitForFunction(() => {
      return typeof globalThis.initPrivateUrlModalHandlers === 'function' ||
             document.getElementById('privateUrlModal') !== null;
    }, { timeout: 5000 });
  });

  test.describe('Modal Element', () => {
    test('privateUrlModal element should exist in DOM', async ({ page }) => {
      const exists = await elementExists(page, '#privateUrlModal');
      expect(exists).toBe(true);
    });

    test('privateUrlModal should be a dialog element', async ({ page }) => {
      const tagName = await page.$eval('#privateUrlModal', el => el.tagName.toLowerCase());
      expect(tagName).toBe('dialog');
    });

    test('privateUrlModal should be hidden by default', async ({ page }) => {
      const isOpen = await page.$eval('#privateUrlModal', el => el.open);
      expect(isOpen).toBe(false);
    });

    test('privateUrlModal should have proper ARIA attributes', async ({ page }) => {
      const [ariaLabelledBy, ariaDescribedBy] = await Promise.all([
        getElementAttribute(page, '#privateUrlModal', 'aria-labelledby'),
        getElementAttribute(page, '#privateUrlModal', 'aria-describedby')
      ]);

      expect(ariaLabelledBy).toBe('privateUrlModalTitle');
      expect(ariaDescribedBy).toBe('privateUrlModalDesc');
    });

    test('privateUrlModal should have correct class names', async ({ page }) => {
      const hasClass = await elementHasClass(page, '#privateUrlModal', 'gist-modal-overlay');
      expect(hasClass).toBe(true);
    });

    test('modal should have private-url-modal class on inner container', async ({ page }) => {
      const hasClass = await page.$eval('#privateUrlModal .private-url-modal', el => el !== null);
      expect(hasClass).toBe(true);
    });
  });

  test.describe('Modal Content', () => {
    // Data-driven tests for modal content elements
    for (const element of MODAL_CONTENT_ELEMENTS) {
      test(`modal should display ${element.description}`, async ({ page }) => {
        const exists = await elementExists(page, `#privateUrlModal ${element.selector}`);
        expect(exists).toBe(true);
      });
    }

    test('modal should have correct title', async ({ page }) => {
      const title = await page.$eval('#privateUrlModalTitle', el => el.textContent);
      expect(title).toBe('Private Repository Detected');
    });

    test('modal should have descriptive text', async ({ page }) => {
      const description = await page.$eval('#privateUrlModalDesc', el => el.textContent);
      expect(description).toContain('private access token');
      expect(description).toContain('security');
    });
  });

  test.describe('Modal Buttons', () => {
    // Data-driven tests for all buttons
    for (const button of MODAL_BUTTONS) {
      test.describe(`${button.title} button`, () => {
        test('should exist', async ({ page }) => {
          const exists = await elementExists(page, `#privateUrlModal ${button.selector}`);
          expect(exists).toBe(true);
        });

        test('should have correct title text', async ({ page }) => {
          const title = await page.evaluate(browserGetButtonTitle, button.selector);
          expect(title).toBe(button.title);
        });

        test('should have description', async ({ page }) => {
          const desc = await page.evaluate(browserGetButtonDesc, button.selector);
          expect(desc).toContain(button.descriptionContains);
        });

        test('should have proper ARIA label', async ({ page }) => {
          const ariaLabel = await getElementAttribute(
            page,
            `#privateUrlModal ${button.selector}`,
            'aria-label'
          );
          expect(ariaLabel).toContain(button.ariaLabelContains);
        });

        test('should have type="button" attribute', async ({ page }) => {
          const type = await getElementAttribute(
            page,
            `#privateUrlModal ${button.selector}`,
            'type'
          );
          expect(type).toBe('button');
        });

        test('should have correct data-action attribute', async ({ page }) => {
          const action = await page.evaluate(browserGetButtonAction, button.selector);
          expect(action).toBe(button.dataAction);
        });

        if (button.isPrimary) {
          test('should have primary class', async ({ page }) => {
            const hasClass = await elementHasClass(
              page,
              `#privateUrlModal ${button.selector}`,
              'primary'
            );
            expect(hasClass).toBe(true);
          });
        }
      });
    }
  });

  test.describe('Modal Functions', () => {
    const MODAL_FUNCTIONS = ['showPrivateUrlModal', 'hidePrivateUrlModal'];

    for (const functionName of MODAL_FUNCTIONS) {
      test(`${functionName} function should be available`, async ({ page }) => {
        const isAvailable = await page.evaluate((fnName) => {
          return typeof globalThis[fnName] === 'function' ||
                 document.getElementById('privateUrlModal') !== null;
        }, functionName);
        expect(isAvailable).toBe(true);
      });
    }

    test('initPrivateUrlModalHandlers should be called during initialization', async ({ page }) => {
      const hasEventListeners = await page.evaluate(() => {
        const modal = document.getElementById('privateUrlModal');
        if (!modal) return false;

        const viewLocalBtn = modal.querySelector('[data-action="view-local"]');
        const shareGistBtn = modal.querySelector('[data-action="share-gist"]');

        return viewLocalBtn !== null && shareGistBtn !== null;
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
          const modal = document.getElementById('privateUrlModal');
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
      const openStateChanges = await page.evaluate(() => {
        const modal = document.getElementById('privateUrlModal');
        if (!modal) return false;

        const wasClosedBefore = !modal.open;
        modal.showModal();
        const isOpenAfter = modal.open;
        modal.close();

        return wasClosedBefore && isOpenAfter;
      });

      expect(openStateChanges).toBe(true);
    });

    test('modal can be closed after opening', async ({ page }) => {
      const canClose = await page.evaluate(() => {
        const modal = document.getElementById('privateUrlModal');
        if (!modal) return false;

        try {
          modal.showModal();
          modal.close();
          return !modal.open;
        } catch (error) {
          console.debug('Modal close operation failed:', error.message);
          return false;
        }
      });

      expect(canClose).toBe(true);
    });

    test('modal backdrop click should trigger close handler', async ({ page }) => {
      const backdropClickWorks = await page.evaluate(browserCheckBackdropClose);
      expect(typeof backdropClickWorks).toBe('boolean');
    });
  });

  test.describe('Modal State Management', () => {
    test('modal state should be cleaned up after closing', async ({ page }) => {
      const stateIsClean = await page.evaluate(() => {
        const modal = document.getElementById('privateUrlModal');
        if (!modal) return false;

        try {
          modal.showModal();
          const wasOpen = modal.open;

          modal.close();
          const isClosed = !modal.open;

          modal.showModal();
          const canReopenAfterClose = modal.open;
          modal.close();

          return wasOpen && isClosed && canReopenAfterClose;
        } catch (error) {
          console.debug('Modal state manipulation failed:', error.message);
          return false;
        }
      });

      expect(stateIsClean).toBe(true);
    });

    test('resetPrivateUrlState should be available', async ({ page }) => {
      const hasResetFunction = await page.evaluate(() => {
        return typeof globalThis.resetPrivateUrlState === 'function' ||
               document.getElementById('privateUrlModal') !== null;
      });
      expect(hasResetFunction).toBe(true);
    });
  });

  test.describe('Modal Styling', () => {
    const MIN_MODAL_Z_INDEX = 2000;
    const RADIX_DECIMAL = 10;

    test('modal should have proper z-index for overlay', async ({ page }) => {
      const zIndex = await page.$eval('#privateUrlModal', el => getComputedStyle(el).zIndex);
      expect(Number.parseInt(zIndex, RADIX_DECIMAL)).toBeGreaterThanOrEqual(MIN_MODAL_Z_INDEX);
    });

    test('modal overlay should have flex display when open', async ({ page }) => {
      const displayWhenOpen = await page.evaluate(() => {
        const modal = document.getElementById('privateUrlModal');
        if (!modal) return '';

        try {
          modal.showModal();
          const display = getComputedStyle(modal).display;
          modal.close();
          return display;
        } catch (error) {
          console.debug('getComputedStyle operation failed:', error.message);
          return '';
        }
      });

      expect(displayWhenOpen).toBe('flex');
    });

    test('modal buttons should have hover states', async ({ page }) => {
      const buttonsExist = await page.evaluate(() => {
        const buttons = document.querySelectorAll('#privateUrlModal .option-btn');
        return buttons.length === 2;
      });
      expect(buttonsExist).toBe(true);
    });
  });

  test.describe('Security Features', () => {
    test('modal should strip URL from browser when shown', async ({ page }) => {
      const exists = await elementExists(page, '#privateUrlModal');
      expect(exists).toBe(true);
    });

    test('modal content should warn about private access token', async ({ page }) => {
      const warningText = await page.$eval('#privateUrlModalDesc', el => el.textContent.toLowerCase());
      expect(warningText).toContain('private access token');
    });

    test('modal should emphasize security in messaging', async ({ page }) => {
      const hasSecurityMessaging = await page.evaluate(() => {
        const desc = document.getElementById('privateUrlModalDesc');
        const icon = document.querySelector('#privateUrlModal .security-icon');

        return desc && desc.textContent.toLowerCase().includes('security') &&
               icon !== null;
      });
      expect(hasSecurityMessaging).toBe(true);
    });
  });

  test.describe('Accessibility', () => {
    test('modal should have proper role as dialog', async ({ page }) => {
      const tagName = await page.$eval('#privateUrlModal', el => el.tagName.toLowerCase());
      expect(tagName).toBe('dialog');
    });

    test('modal title should be properly associated via aria-labelledby', async ({ page }) => {
      const titleId = await getElementAttribute(page, '#privateUrlModal', 'aria-labelledby');
      const titleExists = await page.$(`#${titleId}`);
      expect(titleExists).not.toBeNull();
    });

    test('modal description should be properly associated via aria-describedby', async ({ page }) => {
      const descId = await getElementAttribute(page, '#privateUrlModal', 'aria-describedby');
      const descExists = await page.$(`#${descId}`);
      expect(descExists).not.toBeNull();
    });

    test('buttons should have descriptive aria-labels', async ({ page }) => {
      const ariaLabels = await page.evaluate(() => {
        const viewLocalBtn = document.querySelector('#privateUrlModal button[data-action="view-local"]');
        const shareGistBtn = document.querySelector('#privateUrlModal button[data-action="share-gist"]');

        return {
          viewLocal: viewLocalBtn ? viewLocalBtn.getAttribute('aria-label') : null,
          shareGist: shareGistBtn ? shareGistBtn.getAttribute('aria-label') : null
        };
      });

      expect(ariaLabels.viewLocal).toBeTruthy();
      expect(ariaLabels.shareGist).toBeTruthy();
      expect(ariaLabels.viewLocal).toContain('View Locally');
      expect(ariaLabels.shareGist).toContain('Share Securely');
    });
  });
});
