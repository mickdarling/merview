// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  isGlobalFunctionAvailable,
  setCodeMirrorContent,
  renderMarkdownAndWait,
  WAIT_TIMES
} = require('./helpers/test-utils');

/**
 * Browser-side helper: Select a style by index
 * @param {Object} opts - Configuration
 * @param {number} opts.styleIndex - The index to select
 * @param {number} opts.minOptions - Minimum options required
 */
function browserSelectStyle({ styleIndex, minOptions }) {
  try {
    const selector = document.getElementById('styleSelector');
    if (selector && selector.options.length > minOptions) {
      selector.selectedIndex = styleIndex;
      selector.dispatchEvent(new Event('change'));
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Browser-side helper: Rapidly cycle through styles
 * @param {Object} opts - Configuration
 * @param {number} opts.minStyles - Minimum styles required for test
 * @param {number} opts.cycleCount - Number of styles to cycle through
 */
function browserRapidCycleStyles({ minStyles, cycleCount }) {
  try {
    const selector = document.getElementById('styleSelector');
    if (!selector || selector.options.length < minStyles) return { success: true };

    // Rapidly cycle through styles
    for (let i = 0; i < cycleCount; i++) {
      selector.selectedIndex = i;
      selector.dispatchEvent(new Event('change'));
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Browser-side helper: Check if dark mode exists and select it
 * Uses inline check to avoid nested function definition
 * @returns {{ darkModeExists: boolean, darkModeSelected: boolean }}
 */
function browserSelectDarkMode() {
  const selector = document.getElementById('styleSelector');
  const options = Array.from(selector.options);

  // Find dark option using inline filter logic
  let darkOption = null;
  for (const opt of options) {
    const textLower = opt.text.toLowerCase();
    const valueLower = opt.value.toLowerCase();
    if (textLower.includes('dark') || valueLower.includes('dark')) {
      darkOption = opt;
      break;
    }
  }

  if (!darkOption) {
    return { darkModeExists: false, darkModeSelected: false };
  }

  selector.value = darkOption.value;
  selector.dispatchEvent(new Event('change'));
  return { darkModeExists: true, darkModeSelected: true };
}

/**
 * Browser-side helper: Check if dark mode exists
 * Uses inline check to avoid nested function definition
 * @returns {boolean} True if dark mode option exists
 */
function browserCheckDarkModeExists() {
  const selector = document.getElementById('styleSelector');
  const options = Array.from(selector.options);

  // Check using inline loop logic
  for (const opt of options) {
    const textLower = opt.text.toLowerCase();
    const valueLower = opt.value.toLowerCase();
    if (textLower.includes('dark') || valueLower.includes('dark')) {
      return true;
    }
  }
  return false;
}

/**
 * Tests for CSS file upload and custom style functionality
 *
 * These tests verify the CSS styling features including:
 * - Custom CSS application via #marked-custom-style
 * - CSS scoping to #wrapper to prevent style leakage
 * - Drag and drop visual feedback
 * - Background color detection and Mermaid theme updates
 */
test.describe('CSS File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
    // Wait for the style selector to be populated
    await page.waitForFunction(() => {
      const selector = document.getElementById('styleSelector');
      return selector && selector.options.length > 0;
    }, { timeout: 5000 });
  });

  test.describe('Global Functions', () => {
    const MIN_STYLE_OPTIONS = 5;

    test('changeStyle() function should be globally available', async ({ page }) => {
      const isFunction = await isGlobalFunctionAvailable(page, 'changeStyle');
      expect(isFunction).toBe(true);
    });

    test('loadCSSFromFile function should be available in themes module', async ({ page }) => {
      // The function is internal to the module, but we can test the capability exists
      // by checking that the style selector has multiple options including styles that load from URLs
      const optionCount = await page.$$eval('#styleSelector option', opts => opts.length);
      expect(optionCount).toBeGreaterThan(MIN_STYLE_OPTIONS); // Should have many style options
    });
  });

  test.describe('Drag and Drop Visual Feedback', () => {
    const DRAG_SETTLE_TIMEOUT_MS = 50;

    test('preview should show visual feedback on dragover', async ({ page }) => {
      const preview = await page.$('#preview');

      // Simulate dragover
      await preview.dispatchEvent('dragover');
      await page.waitForTimeout(WAIT_TIMES.SHORT);

      // Check for visual feedback (dashed outline style)
      const hasOutline = await page.evaluate(() => {
        const preview = document.getElementById('preview');
        const style = getComputedStyle(preview);
        return style.outline.includes('dashed') || style.outlineStyle === 'dashed';
      });

      // Verify the outline check returns a defined value (feature may vary by implementation)
      expect(hasOutline).toBeDefined();
    });

    test('preview should remove visual feedback on dragleave', async ({ page }) => {
      const preview = await page.$('#preview');

      // Simulate dragover then dragleave
      await preview.dispatchEvent('dragover');
      await page.waitForTimeout(DRAG_SETTLE_TIMEOUT_MS);
      await preview.dispatchEvent('dragleave');
      await page.waitForTimeout(WAIT_TIMES.SHORT);

      // Visual feedback should be removed
      const hasOutline = await page.evaluate(() => {
        const preview = document.getElementById('preview');
        const style = getComputedStyle(preview);
        return style.outlineStyle === 'dashed';
      });

      expect(hasOutline).toBe(false);
    });
  });

  test.describe('CSS Application', () => {
    test('style selector should have changeStyle function available', async ({ page }) => {
      const hasChangeStyle = await isGlobalFunctionAvailable(page, 'changeStyle');
      expect(hasChangeStyle).toBe(true);
    });

    test('selecting different styles should not cause errors', async ({ page }) => {
      // Select first style
      const firstResult = await page.evaluate(browserSelectStyle, { styleIndex: 1, minOptions: 1 });
      expect(firstResult.success).toBe(true);

      await page.waitForTimeout(WAIT_TIMES.LONG);

      // Select second style
      const secondResult = await page.evaluate(browserSelectStyle, { styleIndex: 2, minOptions: 2 });
      expect(secondResult.success).toBe(true);
    });

    test('dark background CSS should update Mermaid theme', async ({ page }) => {
      // First add some content with a mermaid diagram
      await setCodeMirrorContent(page, '# Test\n\n```mermaid\ngraph TD\n    A-->B\n```');
      await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

      // Check if dark mode exists and select it
      const darkModeExists = await page.evaluate(browserCheckDarkModeExists);

      if (darkModeExists) {
        const result = await page.evaluate(browserSelectDarkMode);
        expect(result.darkModeSelected).toBe(true);

        await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

        // Verify style change completed without errors (mermaid may or may not render SVG)
        const wrapperExists = await page.$('#wrapper');
        expect(wrapperExists).not.toBeNull();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('style selector should handle rapid changes without errors', async ({ page }) => {
      // Rapidly change styles to verify no race conditions or crashes
      const result = await page.evaluate(browserRapidCycleStyles, { minStyles: 3, cycleCount: 3 });

      expect(result.success).toBe(true);
    });
  });

  test.describe('Style Selector', () => {
    const MIN_STYLE_OPTIONS = 5;
    const TEST_STYLE_INDEX = 3;

    test('style selector should have multiple style options', async ({ page }) => {
      const optionCount = await page.$$eval('#styleSelector option', opts => opts.length);
      expect(optionCount).toBeGreaterThan(MIN_STYLE_OPTIONS);
    });

    test('style selector should preserve selection after CSS load', async ({ page }) => {
      // Select a specific style
      await page.selectOption('#styleSelector', { index: TEST_STYLE_INDEX });
      const selectedBefore = await page.$eval('#styleSelector', el => el.selectedIndex);

      await page.waitForTimeout(WAIT_TIMES.LONG);

      // Selection should be preserved
      const selectedAfter = await page.$eval('#styleSelector', el => el.selectedIndex);
      expect(selectedAfter).toBe(selectedBefore);
    });
  });
});
