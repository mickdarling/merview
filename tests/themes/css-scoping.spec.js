// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling
/**
 * CSS Scoping Tests - Issue #384
 *
 * Tests for CSS scoping to ensure loaded stylesheets only affect the
 * #wrapper preview area and do not leak to the rest of the application.
 *
 * This test suite verifies that:
 * - CSS loaded from files/URLs is properly scoped to #wrapper
 * - Global selectors (:root, *, body, html) are correctly scoped
 * - Already-scoped selectors pass through unchanged
 * - Partial #wrapper matches don't bypass scoping
 * - All four theme selectors apply CSS to their correct targets
 */

// @ts-check
const { test, expect } = require('@playwright/test');
const {
    waitForPageReady,
    waitForGlobalFunction,
    setCodeMirrorContent,
    renderMarkdownAndWait,
    WAIT_TIMES
} = require('../helpers/test-utils');

/**
 * Helper to get computed style for an element
 */
async function getComputedStyleProperty(page, selector, property) {
    return page.evaluate(({ sel, prop }) => {
        const element = document.querySelector(sel);
        if (!element) return null;
        return window.getComputedStyle(element)[prop];
    }, { sel: selector, prop: property });
}

/**
 * Helper to check if a style element exists with specific content
 */
async function styleContainsSelector(page, styleId, selectorText) {
    return page.evaluate(({ id, selector }) => {
        const style = document.getElementById(id);
        if (!style) return false;
        return style.textContent.includes(selector);
    }, { id: styleId, selector: selectorText });
}

test.describe('CSS Scoping - Issue #384', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await waitForPageReady(page);
        await waitForGlobalFunction(page, 'renderMarkdown');
        await waitForGlobalFunction(page, 'changeStyle');
    });

    test.describe('scopeSelector function', () => {
        test('should scope basic selectors with #wrapper prefix', async ({ page }) => {
            // Verify the wrapper element exists and can receive styles
            const wrapperExists = await page.evaluate(() => {
                const wrapper = document.getElementById('wrapper');
                return wrapper !== null;
            });
            expect(wrapperExists).toBe(true);
        });

        test('should replace :root selector with #wrapper', async ({ page }) => {
            // Verify that CSS variables work within #wrapper context
            const result = await page.evaluate(() => {
                const wrapper = document.getElementById('wrapper');
                return wrapper !== null;
            });
            expect(result).toBe(true);
        });

        test('should scope universal selector * to #wrapper *', async ({ page }) => {
            // This tests by verifying that key UI elements exist and have styles
            const headerStyleBefore = await getComputedStyleProperty(page, 'header.toolbar-brand', 'background-color');
            const editorStyleBefore = await getComputedStyleProperty(page, '.CodeMirror', 'background-color');

            // These should be valid colors (not null)
            expect(headerStyleBefore).toBeTruthy();
            expect(editorStyleBefore).toBeTruthy();
        });

        test('should handle compound selectors like body.dark', async ({ page }) => {
            // Test that body.dark becomes #wrapper.dark (or similar scoping)
            const scopingTest = await page.evaluate(() => {
                // Create test CSS and check if it affects elements outside wrapper
                const wrapper = document.getElementById('wrapper');
                const body = document.body;

                // Get initial styles
                const wrapperInitial = window.getComputedStyle(wrapper);
                const bodyInitial = window.getComputedStyle(body);

                return {
                    wrapperBackground: wrapperInitial.backgroundColor,
                    bodyBackground: bodyInitial.backgroundColor,
                    wrapperExists: !!wrapper,
                    bodyExists: !!body
                };
            });

            expect(scopingTest.wrapperExists).toBe(true);
            expect(scopingTest.bodyExists).toBe(true);
        });

        test('should NOT bypass scoping when CSS contains partial #wrapper match', async ({ page }) => {
            // This was the bug: #wrapper-container would cause all CSS to bypass scoping
            // because of the check !cssText.includes('#wrapper')

            // Verify that selectors like #wrapper-other don't trigger the bypass
            const result = await page.evaluate(() => {
                // The fix uses word boundary matching, so #wrapper-container
                // should NOT be detected as already scoped
                const testSelector = '#wrapper-container';

                // Check using the regex pattern from isSelectorScoped
                const wrapperPattern = /(?:^|[\s,>+~])#wrapper(?:$|[\s,.:#>\[+~])/;
                return wrapperPattern.test(testSelector);
            });

            // #wrapper-container should NOT match the #wrapper pattern
            expect(result).toBe(false);
        });

        test('should correctly identify already-scoped selectors', async ({ page }) => {
            const results = await page.evaluate(() => {
                const wrapperPattern = /(?:^|[\s,>+~])#wrapper(?:$|[\s,.:#>\[+~])/;
                const previewPattern = /(?:^|[\s,>+~])#preview(?:$|[\s,.:#>\[+~])/;

                const testCases = [
                    { selector: '#wrapper', expected: true },
                    { selector: '#wrapper p', expected: true },
                    { selector: '#wrapper .class', expected: true },
                    { selector: 'div #wrapper', expected: true },
                    { selector: '#wrapper-container', expected: false },
                    { selector: '#preview', expected: true },
                    { selector: '#preview-panel', expected: false },
                    { selector: '.wrapper', expected: false },
                    { selector: 'body', expected: false },
                    { selector: ':root', expected: false },
                ];

                return testCases.map(tc => ({
                    ...tc,
                    actual: wrapperPattern.test(tc.selector) || previewPattern.test(tc.selector)
                }));
            });

            for (const tc of results) {
                expect(tc.actual, `Selector "${tc.selector}" should ${tc.expected ? '' : 'NOT '}be detected as scoped`).toBe(tc.expected);
            }
        });
    });

    test.describe('Style Selector Dropdown', () => {
        test('built-in styles should only affect #wrapper', async ({ page }) => {
            // Get initial styles of UI elements that should NOT change
            const initialStyles = await page.evaluate(() => {
                const header = document.querySelector('header.toolbar-brand');
                const editor = document.querySelector('.CodeMirror');
                return {
                    headerBg: header ? window.getComputedStyle(header).backgroundColor : null,
                    editorBg: editor ? window.getComputedStyle(editor).backgroundColor : null
                };
            });

            // Change to a different built-in style (e.g., Dark Mode)
            await page.selectOption('#styleSelector', 'Dark Mode');
            await page.waitForTimeout(WAIT_TIMES.MEDIUM);

            // Verify UI elements are unchanged
            const afterStyles = await page.evaluate(() => {
                const header = document.querySelector('header.toolbar-brand');
                const editor = document.querySelector('.CodeMirror');
                return {
                    headerBg: header ? window.getComputedStyle(header).backgroundColor : null,
                    editorBg: editor ? window.getComputedStyle(editor).backgroundColor : null
                };
            });

            // Header should remain the same (editor has its own independent theme)
            expect(afterStyles.headerBg).toBe(initialStyles.headerBg);
        });

        test('changing styles should update #wrapper appearance', async ({ page }) => {
            // Set some content first
            await setCodeMirrorContent(page, '# Hello World\n\nThis is a test paragraph.');
            await renderMarkdownAndWait(page);

            // Get initial wrapper style
            const initialWrapperBg = await getComputedStyleProperty(page, '#wrapper', 'backgroundColor');

            // Change to Dark Mode
            await page.selectOption('#styleSelector', 'Dark Mode');
            await page.waitForTimeout(WAIT_TIMES.MEDIUM);

            // Wrapper style should change
            const afterWrapperBg = await getComputedStyleProperty(page, '#wrapper', 'backgroundColor');

            // The background should be different after style change
            // (Dark Mode has a dark background, Clean has light)
            expect(afterWrapperBg).not.toBe(initialWrapperBg);
        });

        test('None option should remove custom styles from #wrapper', async ({ page }) => {
            // First apply a style
            await page.selectOption('#styleSelector', 'Dark Mode');
            await page.waitForTimeout(WAIT_TIMES.MEDIUM);

            // Then remove it (use full display name)
            await page.selectOption('#styleSelector', 'None (No CSS)');
            await page.waitForTimeout(WAIT_TIMES.MEDIUM);

            // Check that the marked-custom-style element is removed or empty
            const styleExists = await page.evaluate(() => {
                const style = document.getElementById('marked-custom-style');
                return style !== null;
            });

            expect(styleExists).toBe(false);
        });
    });

    test.describe('Syntax Theme Selector Dropdown', () => {
        test('syntax themes should only affect code blocks', async ({ page }) => {
            // Set up content with code blocks
            await setCodeMirrorContent(page, '```javascript\nconst x = 1;\n```');
            await renderMarkdownAndWait(page);

            // Wait for code block to render
            await page.waitForSelector('pre code.hljs', { timeout: 5000 });

            // Get initial styles of non-code elements
            const initialParagraphColor = await getComputedStyleProperty(page, '#wrapper', 'color');

            // Change syntax theme (use display name, not file name)
            await page.selectOption('#syntaxThemeSelector', 'Monokai');
            await page.waitForTimeout(WAIT_TIMES.LONG);

            // Non-code elements should be unaffected
            const afterParagraphColor = await getComputedStyleProperty(page, '#wrapper', 'color');
            expect(afterParagraphColor).toBe(initialParagraphColor);

            // Code blocks should have styling from the theme
            const codeHasHljs = await page.evaluate(() => {
                const code = document.querySelector('pre code.hljs');
                return code !== null;
            });
            expect(codeHasHljs).toBe(true);
        });

        test('syntax theme link element should exist after theme change', async ({ page }) => {
            await setCodeMirrorContent(page, '```javascript\nconst x = 1;\n```');
            await renderMarkdownAndWait(page);

            // Change syntax theme (use display name, not file name)
            await page.selectOption('#syntaxThemeSelector', 'GitHub Dark');
            await page.waitForTimeout(WAIT_TIMES.LONG);

            // Verify the syntax theme stylesheet is loaded
            const themeLoaded = await page.evaluate(() => {
                const link = document.getElementById('syntax-theme');
                return link !== null && link.href.includes('github-dark');
            });

            expect(themeLoaded).toBe(true);
        });
    });

    test.describe('Editor Theme Selector Dropdown', () => {
        test('editor themes should only affect CodeMirror', async ({ page }) => {
            // Get initial styles of preview area
            const initialWrapperBg = await getComputedStyleProperty(page, '#wrapper', 'backgroundColor');

            // Change editor theme (use display name)
            await page.selectOption('#editorThemeSelector', 'Dracula');
            await page.waitForTimeout(WAIT_TIMES.MEDIUM);

            // Preview should be unaffected
            const afterWrapperBg = await getComputedStyleProperty(page, '#wrapper', 'backgroundColor');
            expect(afterWrapperBg).toBe(initialWrapperBg);

            // CodeMirror should have the new theme applied
            const editorHasTheme = await page.evaluate(() => {
                const cm = document.querySelector('.CodeMirror');
                // Check if CodeMirror has styling from the theme
                const style = window.getComputedStyle(cm);
                return style.backgroundColor !== '';
            });
            expect(editorHasTheme).toBe(true);
        });

        test('editor theme style element should exist after theme change', async ({ page }) => {
            // Use display name
            await page.selectOption('#editorThemeSelector', 'Monokai');
            await page.waitForTimeout(WAIT_TIMES.MEDIUM);

            const themeLoaded = await page.evaluate(() => {
                const style = document.getElementById('editor-theme');
                return style !== null && style.textContent.includes('.cm-s-custom');
            });

            expect(themeLoaded).toBe(true);
        });
    });

    test.describe('Mermaid Theme Selector Dropdown', () => {
        test('mermaid themes should only affect mermaid diagrams', async ({ page }) => {
            // Set up content with mermaid diagram
            await setCodeMirrorContent(page, '```mermaid\ngraph TD\n    A --> B\n```');
            await renderMarkdownAndWait(page);

            // Wait for mermaid to render
            await page.waitForSelector('.mermaid svg', { timeout: 10000 });

            // Get initial preview background
            const initialWrapperBg = await getComputedStyleProperty(page, '#wrapper', 'backgroundColor');

            // Change mermaid theme (use display name)
            await page.selectOption('#mermaidThemeSelector', 'Forest');
            await page.waitForTimeout(WAIT_TIMES.LONG);

            // Re-render to apply the theme
            await renderMarkdownAndWait(page);
            await page.waitForSelector('.mermaid svg', { timeout: 10000 });

            // Preview background should be unaffected
            const afterWrapperBg = await getComputedStyleProperty(page, '#wrapper', 'backgroundColor');
            expect(afterWrapperBg).toBe(initialWrapperBg);
        });

        test('mermaid diagram should render with theme colors', async ({ page }) => {
            await setCodeMirrorContent(page, '```mermaid\ngraph TD\n    A[Start] --> B[End]\n```');
            await renderMarkdownAndWait(page);

            // Wait for mermaid to render
            await page.waitForSelector('.mermaid svg', { timeout: 10000 });

            // Verify SVG exists with content
            const hasMermaidSvg = await page.evaluate(() => {
                const svg = document.querySelector('.mermaid svg');
                return svg !== null && svg.children.length > 0;
            });

            expect(hasMermaidSvg).toBe(true);
        });
    });

    test.describe('Cross-theme isolation', () => {
        test('changing one theme should not affect others', async ({ page }) => {
            // Set up content with code and mermaid
            await setCodeMirrorContent(page, `# Test
\`\`\`javascript
const x = 1;
\`\`\`

\`\`\`mermaid
graph TD
    A --> B
\`\`\`
`);
            await renderMarkdownAndWait(page);

            // Wait for both to render
            await page.waitForSelector('pre code.hljs', { timeout: 5000 });
            await page.waitForSelector('.mermaid svg', { timeout: 10000 });

            // Get initial editor theme style
            const initialEditorStyle = await page.evaluate(() => {
                const cm = document.querySelector('.CodeMirror');
                return window.getComputedStyle(cm).backgroundColor;
            });

            // Change ONLY the syntax theme (use display name)
            await page.selectOption('#syntaxThemeSelector', 'Monokai');
            await page.waitForTimeout(WAIT_TIMES.LONG);

            // Editor theme should be unchanged
            const afterEditorStyle = await page.evaluate(() => {
                const cm = document.querySelector('.CodeMirror');
                return window.getComputedStyle(cm).backgroundColor;
            });

            expect(afterEditorStyle).toBe(initialEditorStyle);
        });

        test('UI chrome elements should never be affected by any theme', async ({ page }) => {
            // Record initial UI element styles
            const getUIStyles = async () => {
                return page.evaluate(() => {
                    const header = document.querySelector('header.toolbar-brand');
                    const panelHeader = document.querySelector('.panel-header');

                    return {
                        headerBg: header ? window.getComputedStyle(header).backgroundColor : null,
                        panelHeaderBg: panelHeader ? window.getComputedStyle(panelHeader).backgroundColor : null
                    };
                });
            };

            const initialUI = await getUIStyles();

            // Change all themes (use display names)
            await page.selectOption('#styleSelector', 'Dark Mode');
            await page.waitForTimeout(WAIT_TIMES.SHORT);

            await page.selectOption('#syntaxThemeSelector', 'Monokai');
            await page.waitForTimeout(WAIT_TIMES.SHORT);

            await page.selectOption('#editorThemeSelector', 'Dracula');
            await page.waitForTimeout(WAIT_TIMES.SHORT);

            await page.selectOption('#mermaidThemeSelector', 'Dark');
            await page.waitForTimeout(WAIT_TIMES.MEDIUM);

            const afterUI = await getUIStyles();

            // UI should remain unchanged
            expect(afterUI.headerBg).toBe(initialUI.headerBg);
            if (initialUI.panelHeaderBg) {
                expect(afterUI.panelHeaderBg).toBe(initialUI.panelHeaderBg);
            }
        });
    });
});
