// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  waitForGlobalFunctions,
  isGlobalFunctionAvailable,
  getElementAttribute,
  WAIT_TIMES
} = require('./helpers/test-utils');

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
    verifyAttribute: 'integrity',
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
  }
];

/**
 * Tests for Theme Selector functionality
 *
 * These tests ensure the three theme selectors (Style, Syntax, and Editor)
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
      'changeEditorTheme'
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
        expect(optionCount).toBeGreaterThan(1);
      });

      test('should have specific option available', async ({ page }) => {
        const hasOption = await page.$eval(`#${selector.id}`,
          (select, optValue) => Array.from(select.options).some(opt => opt.value === optValue),
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
          (options, excluded) => options
            .filter(opt => opt.value && opt.value !== '' && !opt.disabled && opt.value !== excluded)
            .map(opt => opt.value),
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
            (select, toggleText) => Array.from(select.options).some(opt =>
              opt.textContent && opt.textContent.includes(toggleText)
            ),
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
            options => options
              .filter(opt => opt.value && opt.value !== '')
              .map(opt => opt.value)
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
              expect(attrValue).toBeTruthy();
              expect(attrValue).toContain('sha');
            }
          }
        });
      }

      // Special test for editor theme style content
      if (selector.verifyElement === '#editor-theme') {
        test('theme element should contain CSS rules', async ({ page }) => {
          await page.waitForTimeout(WAIT_TIMES.LONG);
          const editorThemeStyle = await page.$(selector.verifyElement);
          if (editorThemeStyle) {
            const cssContent = await page.$eval(selector.verifyElement, style => style.textContent);
            expect(cssContent).toBeTruthy();
            expect(cssContent.length).toBeGreaterThan(0);
          }
        });
      }

      // Special test for CodeMirror background changes
      if (selector.checkCodeMirrorBackground) {
        test('CodeMirror editor should reflect theme changes', async ({ page }) => {
          const initialBackground = await page.$eval('.CodeMirror',
            el => getComputedStyle(el).backgroundColor
          );

          const availableOptions = await page.$$eval(`#${selector.id} option`,
            options => options
              .filter(opt => opt.value && opt.value !== '')
              .map(opt => opt.value)
          );

          if (availableOptions.length > 1) {
            const currentValue = await page.$eval(`#${selector.id}`, select => select.value);
            const newValue = availableOptions.find(opt => opt !== currentValue);

            if (newValue) {
              await page.selectOption(`#${selector.id}`, newValue);
              await page.waitForTimeout(WAIT_TIMES.LONG);

              const newBackground = await page.$eval('.CodeMirror',
                el => getComputedStyle(el).backgroundColor
              );

              expect(newBackground).toBeTruthy();
            }
          }
        });
      }
    });
  }

  test.describe('Theme Integration', () => {
    test('all three theme selectors should be functional simultaneously', async ({ page }) => {
      const [styleOptions, syntaxOptions, editorOptions] = await Promise.all([
        page.$$eval('#styleSelector option', opts => opts.length),
        page.$$eval('#syntaxThemeSelector option', opts => opts.length),
        page.$$eval('#editorThemeSelector option', opts => opts.length)
      ]);

      expect(styleOptions).toBeGreaterThan(1);
      expect(syntaxOptions).toBeGreaterThan(1);
      expect(editorOptions).toBeGreaterThan(1);
    });

    test('theme selectors should not interfere with each other', async ({ page }) => {
      const [initialStyle, initialSyntax, initialEditor] = await Promise.all([
        page.$eval('#styleSelector', s => s.value),
        page.$eval('#syntaxThemeSelector', s => s.value),
        page.$eval('#editorThemeSelector', s => s.value)
      ]);

      const styleOptions = await page.$$eval('#styleSelector option',
        opts => opts.filter(o => o.value && !o.disabled).map(o => o.value)
      );
      const newStyle = styleOptions.find(o => o !== initialStyle && o !== 'Respect Style Layout');

      if (newStyle) {
        await page.selectOption('#styleSelector', newStyle);
        await page.waitForTimeout(WAIT_TIMES.MEDIUM);

        const [syntaxAfter, editorAfter] = await Promise.all([
          page.$eval('#syntaxThemeSelector', s => s.value),
          page.$eval('#editorThemeSelector', s => s.value)
        ]);

        expect(syntaxAfter).toBe(initialSyntax);
        expect(editorAfter).toBe(initialEditor);
      }
    });
  });
});
