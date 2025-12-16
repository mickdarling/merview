// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  waitForGlobalFunction,
  waitForElementClass,
  waitForElementClassRemoved,
  elementHasClass,
  isGlobalFunctionAvailable,
  getElementAttribute
} = require('./helpers/test-utils');

/**
 * Browser-side helper: Toggle lint panel and wait for transition
 * Extracted to avoid deep function nesting (SonarCloud S2004)
 * @returns {Promise<boolean>} True if panel has 'show' class after toggle
 */
function browserToggleLintPanel() {
  const transitionTime = 350; // Must be defined inside browser context
  return new Promise(function resolveAfterToggle(resolve) {
    const lintPanel = document.getElementById('lintPanel');
    if (!lintPanel) {
      resolve(false);
      return;
    }

    if (typeof globalThis.toggleLintPanel === 'function') {
      globalThis.toggleLintPanel();
    }

    setTimeout(function checkAfterTransition() {
      resolve(lintPanel.classList.contains('show'));
    }, transitionTime);
  });
}

/**
 * DOM elements configuration for lint panel
 */
const LINT_PANEL_ELEMENTS = [
  { id: 'lintPanel', description: 'Lint panel container' },
  { id: 'lintToggle', description: 'Toggle button in toolbar' },
  { id: 'lintContent', description: 'Content area for lint results' }
];

/**
 * Tests for Lint Panel Toggle Functionality
 *
 * These tests ensure the lint panel toggle functionality works correctly,
 * including the panel visibility, toggle button, close button, and state management.
 * The lint panel provides code validation feedback for JSON, HTML, CSS, and JavaScript.
 */
test.describe('Lint Panel Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
    await waitForGlobalFunction(page, 'toggleLintPanel');
  });

  test.describe('DOM Elements', () => {
    // Data-driven tests for element existence
    for (const element of LINT_PANEL_ELEMENTS) {
      test(`${element.description} should exist in DOM after initialization`, async ({ page }) => {
        const el = await page.$(`#${element.id}`);
        expect(el).not.toBeNull();
      });
    }

    test('lintToggle button should have correct onclick handler', async ({ page }) => {
      const onclick = await getElementAttribute(page, '#lintToggle', 'onclick');
      expect(onclick).toBe('toggleLintPanel()');
    });

    test('lintPanel should have lint-header with close button', async ({ page }) => {
      const [lintHeader, closeButton] = await Promise.all([
        page.$('#lintPanel .lint-header'),
        page.$('#lintPanel .lint-close')
      ]);

      expect(lintHeader).not.toBeNull();
      expect(closeButton).not.toBeNull();
    });

    test('lint close button should have correct onclick handler', async ({ page }) => {
      const onclick = await getElementAttribute(page, '#lintPanel .lint-close', 'onclick');
      expect(onclick).toBe('toggleLintPanel()');
    });
  });

  test.describe('Global Function Availability', () => {
    test('toggleLintPanel function should be globally available', async ({ page }) => {
      const isFunction = await isGlobalFunctionAvailable(page, 'toggleLintPanel');
      expect(isFunction).toBe(true);
    });
  });

  test.describe('Panel Visibility Toggle', () => {
    const FIRST_CLICK = 1;
    const SECOND_CLICK = 2;
    const EVEN_CLICK_INDEX = 0;

    /**
     * Test sequence for panel visibility
     */
    const TOGGLE_SEQUENCES = [
      { clicks: FIRST_CLICK, expectedState: true, description: 'clicking toggle button should show the lint panel' },
      { clicks: SECOND_CLICK, expectedState: false, description: 'clicking toggle button twice should hide the lint panel again' }
    ];

    test('lint panel should be hidden by default', async ({ page }) => {
      const hasShowClass = await elementHasClass(page, '#lintPanel', 'show');
      expect(hasShowClass).toBe(false);
    });

    for (const sequence of TOGGLE_SEQUENCES) {
      test(sequence.description, async ({ page }) => {
        // Initial state check
        let hasShowClass = await elementHasClass(page, '#lintPanel', 'show');
        expect(hasShowClass).toBe(false);

        // Perform clicks
        for (let i = 0; i < sequence.clicks; i++) {
          await page.click('#lintToggle');

          if (i % 2 === EVEN_CLICK_INDEX) {
            await waitForElementClass(page, '#lintPanel', 'show');
          } else {
            await waitForElementClassRemoved(page, '#lintPanel', 'show');
          }
        }

        // Verify final state
        hasShowClass = await elementHasClass(page, '#lintPanel', 'show');
        expect(hasShowClass).toBe(sequence.expectedState);
      });
    }
  });

  test.describe('Close Button Functionality', () => {
    test('clicking close button (X) should hide the lint panel', async ({ page }) => {
      await page.click('#lintToggle');
      await waitForElementClass(page, '#lintPanel', 'show');

      let hasShowClass = await elementHasClass(page, '#lintPanel', 'show');
      expect(hasShowClass).toBe(true);

      await page.click('#lintPanel .lint-close');
      await waitForElementClassRemoved(page, '#lintPanel', 'show');

      hasShowClass = await elementHasClass(page, '#lintPanel', 'show');
      expect(hasShowClass).toBe(false);
    });
  });

  test.describe('Panel State Toggle Sequence', () => {
    test('panel state should toggle correctly: visible -> hidden -> visible', async ({ page }) => {
      const EXPECTED_STATES = [false, true, false, true];

      for (let i = 0; i < EXPECTED_STATES.length; i++) {
        const hasShowClass = await elementHasClass(page, '#lintPanel', 'show');
        expect(hasShowClass).toBe(EXPECTED_STATES[i]);

        if (i < EXPECTED_STATES.length - 1) {
          await page.click('#lintToggle');
          if (EXPECTED_STATES[i + 1]) {
            await waitForElementClass(page, '#lintPanel', 'show');
          } else {
            await waitForElementClassRemoved(page, '#lintPanel', 'show');
          }
        }
      }
    });

    test('toggle button should have active class when panel is shown', async ({ page }) => {
      const TEST_SEQUENCE = [
        { action: 'show', expectedActive: true },
        { action: 'hide', expectedActive: false }
      ];

      // Initial state
      let hasActiveClass = await elementHasClass(page, '#lintToggle', 'active');
      expect(hasActiveClass).toBe(false);

      for (const step of TEST_SEQUENCE) {
        await page.click('#lintToggle');

        if (step.expectedActive) {
          await waitForElementClass(page, '#lintPanel', 'show');
        } else {
          await waitForElementClassRemoved(page, '#lintPanel', 'show');
        }

        hasActiveClass = await elementHasClass(page, '#lintToggle', 'active');
        expect(hasActiveClass).toBe(step.expectedActive);
      }
    });
  });

  test.describe('Lint Content Display', () => {
    test('lintContent should show default empty message when validation is disabled', async ({ page }) => {
      const contentText = await page.$eval('#lintContent', el => el.textContent);
      expect(contentText).toContain('No issues found or validation disabled');
    });

    test('lintContent element should be scrollable', async ({ page }) => {
      const overflowY = await page.$eval('.lint-content', el => getComputedStyle(el).overflowY);
      expect(overflowY).toBe('auto');
    });
  });

  test.describe('Panel Styling and Layout', () => {
    const EXPECTED_PANEL_HEIGHT = '300px';
    const EXPECTED_EDGE_POSITION = '0px';

    const EXPECTED_STYLES = [
      { property: 'position', value: 'fixed', description: 'correct CSS positioning' },
      { property: 'height', value: EXPECTED_PANEL_HEIGHT, description: 'correct height' }
    ];

    for (const style of EXPECTED_STYLES) {
      test(`lint panel should have ${style.description}`, async ({ page }) => {
        const value = await page.$eval('#lintPanel', (el, prop) => getComputedStyle(el)[prop], style.property);
        expect(value).toBe(style.value);
      });
    }

    test('lint panel should span full width', async ({ page }) => {
      const [left, right] = await Promise.all([
        page.$eval('#lintPanel', el => getComputedStyle(el).left),
        page.$eval('#lintPanel', el => getComputedStyle(el).right)
      ]);

      expect(left).toBe(EXPECTED_EDGE_POSITION);
      expect(right).toBe(EXPECTED_EDGE_POSITION);
    });
  });

  test.describe('Integration with toggleLintPanel()', () => {
    test('programmatically calling toggleLintPanel() should show panel', async ({ page }) => {
      const isShown = await page.evaluate(browserToggleLintPanel);
      expect(isShown).toBe(true);
    });

    test('calling toggleLintPanel() twice should return to hidden state', async ({ page }) => {
      // First call: show
      await page.evaluate(() => {
        if (typeof globalThis.toggleLintPanel === 'function') {
          globalThis.toggleLintPanel();
        }
      });
      await waitForElementClass(page, '#lintPanel', 'show');

      let hasShowClass = await elementHasClass(page, '#lintPanel', 'show');
      expect(hasShowClass).toBe(true);

      // Second call: hide
      await page.evaluate(() => {
        if (typeof globalThis.toggleLintPanel === 'function') {
          globalThis.toggleLintPanel();
        }
      });
      await waitForElementClassRemoved(page, '#lintPanel', 'show');

      hasShowClass = await elementHasClass(page, '#lintPanel', 'show');
      expect(hasShowClass).toBe(false);
    });
  });
});
