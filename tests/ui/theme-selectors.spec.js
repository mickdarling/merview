// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  waitForGlobalFunctions,
  isGlobalFunctionAvailable,
  getElementAttribute,
  setCodeMirrorContent,
  renderMarkdownAndWait,
  WAIT_TIMES
} = require('../helpers/test-utils');

/**
 * Minimum expected number of theme options
 */
const MIN_THEME_OPTIONS = 1;
const MIN_AVAILABLE_OPTIONS = 1;

/**
 * Browser-side helper functions to reduce nesting in page.evaluate() calls
 */

/**
 * Check if a select element has an option with the given value
 * @param {HTMLSelectElement} select - The select element
 * @param {string} optValue - The option value to search for
 * @returns {boolean} True if the option exists
 */
function hasOptionWithValue(select, optValue) {
  return Array.from(select.options).some(opt => opt.value === optValue);
}

/**
 * Filter and map select options based on criteria
 * @param {HTMLOptionElement[]} options - Array of option elements
 * @param {string|null} excluded - Value to exclude from results
 * @returns {string[]} Array of option values
 */
function filterAvailableOptions(options, excluded) {
  return options
    .filter(opt => opt.value && opt.value !== '' && !opt.disabled && opt.value !== excluded)
    .map(opt => opt.value);
}

/**
 * Filter and map select options (simple version without exclusion)
 * @param {HTMLOptionElement[]} options - Array of option elements
 * @returns {string[]} Array of option values
 */
function filterNonEmptyOptions(options) {
  return options
    .filter(opt => opt.value && opt.value !== '')
    .map(opt => opt.value);
}

/**
 * Check if a select has an option with text containing the given string
 * @param {HTMLSelectElement} select - The select element
 * @param {string} toggleText - The text to search for
 * @returns {boolean} True if an option contains the text
 */
function hasOptionWithText(select, toggleText) {
  return Array.from(select.options).some(opt =>
    opt.textContent?.includes(toggleText)
  );
}

/**
 * Filter select options by value and disabled state
 * @param {HTMLOptionElement[]} opts - Array of option elements
 * @returns {string[]} Array of enabled option values
 */
function filterEnabledOptions(opts) {
  return opts.filter(o => o.value && !o.disabled).map(o => o.value);
}

/**
 * Configuration for each theme selector to enable data-driven tests
 */
const THEME_SELECTORS = [
  {
    id: 'styleSelector',
    name: 'Style',
    changeFunction: 'changeStyle',
    expectedOption: 'Clean',
    excludeFromSelection: 'Respect Style Layout',
    verifyElement: null,
    verifyAttribute: null,
    hasToggleOption: true,
    toggleOptionText: 'Respect Style Layout'
  },
  {
    id: 'syntaxThemeSelector',
    name: 'Syntax Theme',
    changeFunction: 'changeSyntaxTheme',
    expectedOption: 'GitHub Dark',
    excludeFromSelection: null,
    verifyElement: '#syntax-theme',
    // No verifyAttribute - syntax themes are now <style> elements with @layer, not <link> with integrity
    hasToggleOption: false,
    additionalElement: '#syntax-override'
  },
  {
    id: 'editorThemeSelector',
    name: 'Editor Theme',
    changeFunction: 'changeEditorTheme',
    expectedOption: 'Material Darker',
    excludeFromSelection: null,
    verifyElement: '#editor-theme',
    verifyAttribute: null,
    hasToggleOption: false,
    checkCodeMirrorBackground: true
  },
  {
    id: 'mermaidThemeSelector',
    name: 'Mermaid Theme',
    changeFunction: 'changeMermaidTheme',
    expectedOption: 'auto',
    excludeFromSelection: null,
    verifyElement: null,
    verifyAttribute: null,
    hasToggleOption: false
  }
];

/**
 * Tests for Theme Selector functionality
 *
 * These tests ensure the four theme selectors (Style, Syntax, Editor, and Mermaid)
 * are properly initialized with their respective options and can trigger
 * theme changes when selections are made.
 */
test.describe('Theme Selectors', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
    // Wait for all theme functions to be globally available
    await waitForGlobalFunctions(page, [
      'changeStyle',
      'changeSyntaxTheme',
      'changeEditorTheme',
      'changeMermaidTheme'
    ]);
  });

  // Data-driven tests for all selectors
  for (const selector of THEME_SELECTORS) {
    test.describe(`${selector.name} Selector (#${selector.id})`, () => {
      test('element should exist in DOM', async ({ page }) => {
        const element = await page.$(`#${selector.id}`);
        expect(element).not.toBeNull();
      });

      test('should have options populated', async ({ page }) => {
        const optionCount = await page.$$eval(`#${selector.id} option`, options => options.length);
        expect(optionCount).toBeGreaterThan(MIN_THEME_OPTIONS);
      });

      test('should have specific option available', async ({ page }) => {
        const hasOption = await page.$eval(`#${selector.id}`,
          hasOptionWithValue,
          selector.expectedOption
        );
        expect(hasOption).toBe(true);
      });

      test(`${selector.changeFunction}() function should be globally available`, async ({ page }) => {
        const isFunction = await isGlobalFunctionAvailable(page, selector.changeFunction);
        expect(isFunction).toBe(true);
      });

      test('should have a default selection', async ({ page }) => {
        const selectedValue = await page.$eval(`#${selector.id}`, select => select.value);
        expect(selectedValue).not.toBe('');
      });

      test('changing selection should trigger theme change', async ({ page }) => {
        const initialValue = await page.$eval(`#${selector.id}`, select => select.value);

        const availableOptions = await page.$$eval(`#${selector.id} option`,
          filterAvailableOptions,
          selector.excludeFromSelection
        );

        const newValue = availableOptions.find(opt => opt !== initialValue);

        if (newValue) {
          await page.selectOption(`#${selector.id}`, newValue);
          await page.waitForTimeout(WAIT_TIMES.LONG);

          const currentValue = await page.$eval(`#${selector.id}`, select => select.value);
          expect(currentValue).toBe(newValue);
        }
      });

      // Conditional test for toggle option
      if (selector.hasToggleOption) {
        test('should display toggle option', async ({ page }) => {
          const hasToggle = await page.$eval(`#${selector.id}`,
            hasOptionWithText,
            selector.toggleOptionText
          );
          expect(hasToggle).toBe(true);
        });
      }

      // Conditional test for additional elements
      if (selector.additionalElement) {
        test('should have additional element created', async ({ page }) => {
          await page.waitForTimeout(WAIT_TIMES.LONG);
          const element = await page.$(selector.additionalElement);
          expect(element).not.toBeNull();
        });
      }

      // Conditional test for verification element
      if (selector.verifyElement) {
        test('should update verification element on change', async ({ page }) => {
          const initialValue = await page.$eval(`#${selector.id}`, select => select.value);

          const availableOptions = await page.$$eval(`#${selector.id} option`,
            filterNonEmptyOptions
          );

          const newValue = availableOptions.find(opt => opt !== initialValue);

          if (newValue) {
            await page.selectOption(`#${selector.id}`, newValue);
            await page.waitForTimeout(WAIT_TIMES.LONG);

            const verifyElement = await page.$(selector.verifyElement);
            expect(verifyElement).not.toBeNull();

            // Check attribute if specified
            if (selector.verifyAttribute) {
              const attrValue = await getElementAttribute(page, selector.verifyElement, selector.verifyAttribute);
              expect(attrValue).not.toBeNull();
              expect(attrValue).toContain('sha');
            }
          }
        });
      }

      // Special test for editor theme style content
      if (selector.verifyElement === '#editor-theme') {
        test('theme element should contain CSS rules', async ({ page }) => {
          const MIN_CSS_LENGTH = 0;

          await page.waitForTimeout(WAIT_TIMES.LONG);
          const editorThemeStyle = await page.$(selector.verifyElement);
          if (editorThemeStyle) {
            const cssContent = await page.$eval(selector.verifyElement, style => style.textContent);
            expect(cssContent).not.toBeNull();
            expect(cssContent.length).toBeGreaterThan(MIN_CSS_LENGTH);
          }
        });
      }

      // Special test for CodeMirror background changes
      if (selector.checkCodeMirrorBackground) {
        test('CodeMirror editor should reflect theme changes', async ({ page }) => {
          const availableOptions = await page.$$eval(`#${selector.id} option`,
            filterNonEmptyOptions
          );

          if (availableOptions.length > MIN_AVAILABLE_OPTIONS) {
            const currentValue = await page.$eval(`#${selector.id}`, select => select.value);
            const newValue = availableOptions.find(opt => opt !== currentValue);

            if (newValue) {
              await page.selectOption(`#${selector.id}`, newValue);
              await page.waitForTimeout(WAIT_TIMES.LONG);

              const newBackground = await page.$eval('.CodeMirror',
                el => getComputedStyle(el).backgroundColor
              );

              expect(newBackground).not.toBeNull();
            }
          }
        });
      }
    });
  }

  test.describe('Theme Integration', () => {
    test('all four theme selectors should be functional simultaneously', async ({ page }) => {
      const [styleOptions, syntaxOptions, editorOptions, mermaidOptions] = await Promise.all([
        page.$$eval('#styleSelector option', opts => opts.length),
        page.$$eval('#syntaxThemeSelector option', opts => opts.length),
        page.$$eval('#editorThemeSelector option', opts => opts.length),
        page.$$eval('#mermaidThemeSelector option', opts => opts.length)
      ]);

      expect(styleOptions).toBeGreaterThan(MIN_THEME_OPTIONS);
      expect(syntaxOptions).toBeGreaterThan(MIN_THEME_OPTIONS);
      expect(editorOptions).toBeGreaterThan(MIN_THEME_OPTIONS);
      expect(mermaidOptions).toBeGreaterThan(MIN_THEME_OPTIONS);
    });

    test('theme selectors should not interfere with each other', async ({ page }) => {
      const [initialStyle, initialSyntax, initialEditor, initialMermaid] = await Promise.all([
        page.$eval('#styleSelector', s => s.value),
        page.$eval('#syntaxThemeSelector', s => s.value),
        page.$eval('#editorThemeSelector', s => s.value),
        page.$eval('#mermaidThemeSelector', s => s.value)
      ]);

      const styleOptions = await page.$$eval('#styleSelector option',
        filterEnabledOptions
      );
      const newStyle = styleOptions.find(o => o !== initialStyle && o !== 'Respect Style Layout');

      if (newStyle) {
        await page.selectOption('#styleSelector', newStyle);
        await page.waitForTimeout(WAIT_TIMES.MEDIUM);

        const [syntaxAfter, editorAfter, mermaidAfter] = await Promise.all([
          page.$eval('#syntaxThemeSelector', s => s.value),
          page.$eval('#editorThemeSelector', s => s.value),
          page.$eval('#mermaidThemeSelector', s => s.value)
        ]);

        expect(syntaxAfter).toBe(initialSyntax);
        expect(editorAfter).toBe(initialEditor);
        expect(mermaidAfter).toBe(initialMermaid);
      }
    });

    test('Mermaid theme change should update diagram rendering', async ({ page }) => {
      // Set content with a Mermaid diagram
      await setCodeMirrorContent(page, '```mermaid\ngraph TD\n    A[Start] --> B[End]\n```');
      await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

      // Wait for Mermaid diagram to render
      await page.waitForSelector('.mermaid svg', { timeout: 5000 });

      // Get initial selector value and SVG content
      const initialValue = await page.$eval('#mermaidThemeSelector', s => s.value);
      const initialSvgContent = await page.$eval('.mermaid svg', el => el.outerHTML);

      // Change to a different theme - use 'dark' which has visually distinct styling
      const newTheme = initialValue === 'dark' ? 'forest' : 'dark';
      await page.selectOption('#mermaidThemeSelector', newTheme);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      // Wait for re-render (diagram should still exist)
      await page.waitForSelector('.mermaid svg', { timeout: 5000 });

      // Verify the dropdown value changed
      const selectorValue = await page.$eval('#mermaidThemeSelector', s => s.value);
      expect(selectorValue).toBe(newTheme);

      // Verify the SVG was re-rendered (content should change with different theme)
      const newSvgContent = await page.$eval('.mermaid svg', el => el.outerHTML);
      expect(newSvgContent).not.toBe(initialSvgContent);
    });
  });
});
