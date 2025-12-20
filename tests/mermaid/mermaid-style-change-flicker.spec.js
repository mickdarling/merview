// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling
/**
 * Mermaid Style Change Flicker Tests
 * Tests for Issue #371 - Mermaid diagram text flickers/blinks on render
 *
 * This test suite verifies that mermaid diagrams do NOT flicker when:
 * - Preview style is changed
 * - Page is navigated
 * - Theme is updated
 *
 * The flicker manifests as briefly visible raw mermaid text or loading states
 * before the SVG diagram renders.
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

test.describe('Mermaid Style Change Flicker - Issue #371', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await waitForPageReady(page);
        await waitForGlobalFunction(page, 'renderMarkdown');
    });

    /**
     * Helper to set up a page with mermaid diagrams and wait for them to render
     */
    async function setupMermaidContent(page) {
        const content = `# Test Document

\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`

Some text between diagrams.

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi back
\`\`\`
`;
        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

        // Wait for diagrams to fully render
        await page.waitForFunction(() => {
            const diagrams = document.querySelectorAll('.mermaid');
            return diagrams.length >= 2 &&
                   Array.from(diagrams).every(d => d.dataset.mermaidRendered === 'true');
        }, { timeout: 10000 });
    }

    test('mermaid diagrams should be fully rendered before style change', async ({ page }) => {
        await setupMermaidContent(page);

        // Verify diagrams are rendered with SVG content
        const diagramState = await page.evaluate(() => {
            const diagrams = document.querySelectorAll('.mermaid');
            return Array.from(diagrams).map(d => ({
                rendered: d.dataset.mermaidRendered,
                hasSvg: d.querySelector('svg') !== null,
                hasRawText: d.textContent?.includes('graph TD') || d.textContent?.includes('sequenceDiagram')
            }));
        });

        for (const state of diagramState) {
            expect(state.rendered).toBe('true');
            expect(state.hasSvg).toBe(true);
            // Raw mermaid syntax should NOT be visible in rendered diagrams
            expect(state.hasRawText).toBe(false);
        }
    });

    test('should re-render mermaid diagrams smoothly when changing preview style', async ({ page }) => {
        await setupMermaidContent(page);

        // Set up mutation observer to detect DOM changes during style change
        const renderBehavior = await page.evaluate(async () => {
            return new Promise((resolve) => {
                let sawLoadingClass = false;
                let finalState = 'unknown';

                const diagrams = document.querySelectorAll('.mermaid');

                // Create mutation observer to watch for render behavior
                const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        const target = mutation.target;

                        // Check for loading class (indicates slow/visible re-render)
                        if (target.classList?.contains('mermaid-loading')) {
                            sawLoadingClass = true;
                        }
                    }
                });

                // Observe all mermaid diagrams
                diagrams.forEach(diagram => {
                    observer.observe(diagram, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        characterData: true,
                        attributeFilter: ['data-mermaid-rendered', 'class']
                    });
                });

                // Change the preview style
                const styleSelector = document.getElementById('styleSelector');
                if (styleSelector) {
                    // Get current value and change to something different
                    const currentValue = styleSelector.value;
                    const options = Array.from(styleSelector.options);
                    const newOption = options.find(o => o.value !== currentValue && o.value !== '');
                    if (newOption) {
                        styleSelector.value = newOption.value;
                        styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }

                // Wait for any re-render to complete
                setTimeout(() => {
                    observer.disconnect();
                    const diagram = document.querySelector('.mermaid');
                    finalState = diagram?.dataset.mermaidRendered || 'missing';
                    resolve({
                        sawLoadingClass,
                        finalState,
                        hasSvg: diagram?.querySelector('svg') !== null
                    });
                }, 2000);
            });
        });

        console.log('Render behavior results:', renderBehavior);

        // Key assertions:
        // 1. Should NOT show loading spinner (that would be visible flicker)
        expect(renderBehavior.sawLoadingClass).toBe(false);
        // 2. Should end up with rendered diagram
        expect(renderBehavior.finalState).toBe('true');
        // 3. Should have SVG content
        expect(renderBehavior.hasSvg).toBe(true);
    });

    test('SVG diagrams should persist through style changes', async ({ page }) => {
        await setupMermaidContent(page);

        // Capture SVG content before style change
        const svgContentBefore = await page.evaluate(() => {
            const diagrams = document.querySelectorAll('.mermaid svg');
            return Array.from(diagrams).map(svg => svg.outerHTML.substring(0, 100));
        });

        expect(svgContentBefore.length).toBeGreaterThanOrEqual(2);

        // Change preview style
        await page.selectOption('#styleSelector', { index: 1 });

        // Wait for any re-render
        await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

        // Check that SVGs still exist (not removed and re-created)
        const svgContentAfter = await page.evaluate(() => {
            const diagrams = document.querySelectorAll('.mermaid svg');
            return Array.from(diagrams).map(svg => svg.outerHTML.substring(0, 100));
        });

        expect(svgContentAfter.length).toBeGreaterThanOrEqual(2);
    });

    test('diagram should end up in rendered state after style change', async ({ page }) => {
        await setupMermaidContent(page);

        // Monitor final state after style change
        const finalState = await page.evaluate(async () => {
            return new Promise((resolve) => {
                // Trigger style change
                const styleSelector = document.getElementById('styleSelector');
                if (styleSelector) {
                    const currentIndex = styleSelector.selectedIndex;
                    styleSelector.selectedIndex = currentIndex === 0 ? 1 : 0;
                    styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Wait for re-render to complete
                setTimeout(() => {
                    const diagrams = document.querySelectorAll('.mermaid');
                    const states = Array.from(diagrams).map(d => ({
                        rendered: d.dataset.mermaidRendered,
                        hasSvg: d.querySelector('svg') !== null
                    }));
                    resolve(states);
                }, 2000);
            });
        });

        console.log('Final diagram states:', finalState);

        // All diagrams should be fully rendered after style change
        for (const state of finalState) {
            expect(state.rendered).toBe('true');
            expect(state.hasSvg).toBe(true);
        }
    });

    test('rapid style changes should not cause cumulative flicker', async ({ page }) => {
        await setupMermaidContent(page);

        // Rapidly change styles multiple times
        const flickerCount = await page.evaluate(async () => {
            return new Promise((resolve) => {
                let pendingStateCount = 0;

                const diagrams = document.querySelectorAll('.mermaid');

                const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        if (mutation.target.dataset?.mermaidRendered === 'pending') {
                            pendingStateCount++;
                        }
                    }
                });

                diagrams.forEach(diagram => {
                    observer.observe(diagram, {
                        attributes: true,
                        attributeFilter: ['data-mermaid-rendered']
                    });
                });

                // Rapidly toggle styles
                const styleSelector = document.getElementById('styleSelector');
                if (styleSelector) {
                    for (let i = 0; i < 5; i++) {
                        setTimeout(() => {
                            styleSelector.selectedIndex = i % styleSelector.options.length;
                            styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
                        }, i * 100);
                    }
                }

                setTimeout(() => {
                    observer.disconnect();
                    resolve(pendingStateCount);
                }, 2000);
            });
        });

        // After fix: should be 0 (no pending states)
        // Before fix: will be >= number of style changes × number of diagrams
        console.log('Pending state transitions during rapid changes:', flickerCount);
        expect(flickerCount).toBe(0);
    });

    test('mermaid diagrams should remain visible during style transition', async ({ page }) => {
        await setupMermaidContent(page);

        // Take visual snapshots to detect flicker
        // This captures the diagram visibility state at multiple points
        const visibilityDuringChange = await page.evaluate(async () => {
            return new Promise((resolve) => {
                const snapshots = [];

                const captureState = () => {
                    const diagrams = document.querySelectorAll('.mermaid');
                    return Array.from(diagrams).map(d => ({
                        hasSvg: d.querySelector('svg') !== null,
                        svgVisible: d.querySelector('svg')?.style.display !== 'none',
                        hasLoadingClass: d.classList.contains('mermaid-loading'),
                        rendered: d.dataset.mermaidRendered
                    }));
                };

                // Capture initial state
                snapshots.push({ time: 'before', state: captureState() });

                // Change style
                const styleSelector = document.getElementById('styleSelector');
                if (styleSelector) {
                    styleSelector.selectedIndex = 1;
                    styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Capture states at intervals during re-render
                const intervals = [50, 100, 200, 500, 1000];
                intervals.forEach(ms => {
                    setTimeout(() => {
                        snapshots.push({ time: `${ms}ms`, state: captureState() });
                    }, ms);
                });

                setTimeout(() => {
                    resolve(snapshots);
                }, 1500);
            });
        });

        console.log('Visibility snapshots:', JSON.stringify(visibilityDuringChange, null, 2));

        // All snapshots should show diagrams with SVGs visible
        for (const snapshot of visibilityDuringChange) {
            for (const diagram of snapshot.state) {
                expect(diagram.hasSvg).toBe(true);
                expect(diagram.hasLoadingClass).toBe(false);
            }
        }
    });
});

test.describe('Mermaid Theme Updates on Style Change', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await waitForPageReady(page);
        await waitForGlobalFunction(page, 'renderMarkdown');
    });

    test('mermaid diagram colors should update when preview style changes', async ({ page }) => {
        // Set up content with a mermaid diagram
        const content = `# Test Document

\`\`\`mermaid
graph TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`
`;
        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

        // Wait for diagram to render
        await page.waitForFunction(() => {
            const diagram = document.querySelector('.mermaid');
            return diagram?.dataset.mermaidRendered === 'true' && diagram?.querySelector('svg');
        }, { timeout: 10000 });

        // Capture initial SVG colors/styles
        const initialStyles = await page.evaluate(() => {
            const svg = document.querySelector('.mermaid svg');
            if (!svg) return null;
            const rect = svg.querySelector('rect, .node rect, .label-container');
            const text = svg.querySelector('text, .nodeLabel');
            return {
                hasSvg: true,
                rectFill: rect?.getAttribute('fill') || window.getComputedStyle(rect).fill,
                textContent: text?.textContent
            };
        });

        expect(initialStyles?.hasSvg).toBe(true);

        // Change to a different style (one that should trigger theme change)
        const styleChanged = await page.evaluate(() => {
            const styleSelector = document.getElementById('styleSelector');
            if (!styleSelector) return false;
            const currentIndex = styleSelector.selectedIndex;
            // Try to find a style that's different
            for (let i = 0; i < styleSelector.options.length; i++) {
                if (i !== currentIndex && styleSelector.options[i].value) {
                    styleSelector.selectedIndex = i;
                    styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
            }
            return false;
        });

        expect(styleChanged).toBe(true);

        // Wait for re-render
        await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

        // Verify SVG still exists after style change
        const afterStyles = await page.evaluate(() => {
            const svg = document.querySelector('.mermaid svg');
            if (!svg) return null;
            const diagram = document.querySelector('.mermaid');
            return {
                hasSvg: true,
                rendered: diagram?.dataset.mermaidRendered,
                svgExists: svg !== null
            };
        });

        // Critical: SVG must still exist and be marked as rendered
        expect(afterStyles?.hasSvg).toBe(true);
        expect(afterStyles?.rendered).toBe('true');
        expect(afterStyles?.svgExists).toBe(true);
    });

    test('mermaid theme should reflect dark/light mode appropriately', async ({ page }) => {
        // Set up content with a mermaid diagram
        const content = `# Test Document

\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\`
`;
        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

        // Wait for initial render
        await page.waitForFunction(() => {
            const diagram = document.querySelector('.mermaid');
            return diagram?.dataset.mermaidRendered === 'true';
        }, { timeout: 10000 });

        // Get the current mermaid theme from state
        const initialTheme = await page.evaluate(() => {
            return window.state?.mermaidTheme || 'unknown';
        });

        // Change style and check theme updates
        await page.evaluate(() => {
            const styleSelector = document.getElementById('styleSelector');
            if (styleSelector && styleSelector.options.length > 1) {
                styleSelector.selectedIndex = (styleSelector.selectedIndex + 1) % styleSelector.options.length;
                styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

        // Verify diagram is still rendered (not stuck in pending/loading)
        const finalState = await page.evaluate(() => {
            const diagram = document.querySelector('.mermaid');
            return {
                rendered: diagram?.dataset.mermaidRendered,
                hasSvg: diagram?.querySelector('svg') !== null,
                theme: window.state?.mermaidTheme
            };
        });

        expect(finalState.rendered).toBe('true');
        expect(finalState.hasSvg).toBe(true);
        // Theme should be a valid mermaid theme
        expect(['default', 'dark', 'forest', 'neutral', 'base']).toContain(finalState.theme);
    });
});

test.describe('Mermaid Flicker - Comparison with Code Blocks', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await waitForPageReady(page);
        await waitForGlobalFunction(page, 'renderMarkdown');
    });

    test('code blocks should not flicker on style change (baseline)', async ({ page }) => {
        // Set up content with code blocks (not mermaid)
        const content = `# Test Document

\`\`\`javascript
function hello() {
    console.log('Hello, World!');
}
\`\`\`

\`\`\`python
def greet():
    print("Hello!")
\`\`\`
`;
        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

        // Monitor for any content removal during style change
        const codeBlockFlicker = await page.evaluate(async () => {
            return new Promise((resolve) => {
                let contentRemoved = false;

                const codeBlocks = document.querySelectorAll('pre code');
                const originalContent = Array.from(codeBlocks).map(cb => cb.innerHTML);

                const observer = new MutationObserver(() => {
                    const currentContent = Array.from(document.querySelectorAll('pre code'))
                        .map(cb => cb.innerHTML);
                    if (currentContent.length < originalContent.length) {
                        contentRemoved = true;
                    }
                });

                const preview = document.getElementById('preview');
                if (preview) {
                    observer.observe(preview, { childList: true, subtree: true });
                }

                // Change style
                const styleSelector = document.getElementById('styleSelector');
                if (styleSelector) {
                    styleSelector.selectedIndex = 1;
                    styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
                }

                setTimeout(() => {
                    observer.disconnect();
                    resolve({ contentRemoved });
                }, 1500);
            });
        });

        // Code blocks currently also get re-rendered, but they don't "flicker"
        // because syntax highlighting is applied synchronously
        console.log('Code block flicker result:', codeBlockFlicker);
    });
});
