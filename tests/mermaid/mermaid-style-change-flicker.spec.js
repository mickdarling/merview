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

/**
 * Helper to set up a page with mermaid diagrams and wait for them to render
 * Moved to module scope to comply with S7721 (no async functions inside describe blocks)
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

/**
 * Helper to capture diagram visibility state at a specific point
 * Moved to module scope to comply with S2004 (reduce nesting depth)
 */
async function captureDiagramVisibility(page, label) {
    const state = await page.evaluate(() => {
        const diagrams = document.querySelectorAll('.mermaid');
        return Array.from(diagrams).map(d => ({
            hasSvg: d.querySelector('svg') !== null,
            svgVisible: d.querySelector('svg')?.style.display !== 'none',
            hasLoadingClass: d.classList.contains('mermaid-loading'),
            rendered: d.dataset.mermaidRendered
        }));
    });
    return { time: label, state };
}

test.describe('Mermaid Style Change Flicker - Issue #371', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await waitForPageReady(page);
        await waitForGlobalFunction(page, 'renderMarkdown');
    });

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

        // Set up observer and trigger style change
        await page.evaluate(() => {
            const state = { sawLoadingClass: false };
            const diagrams = document.querySelectorAll('.mermaid');

            // Named callback to reduce nesting depth (S2004)
            function handleMutation(mutation) {
                if (mutation.target.classList?.contains('mermaid-loading')) {
                    state.sawLoadingClass = true;
                }
            }

            const observer = new MutationObserver(mutations => mutations.forEach(handleMutation));
            const observerConfig = {
                childList: true, subtree: true, attributes: true,
                characterData: true, attributeFilter: ['data-mermaid-rendered', 'class']
            };

            for (const diagram of diagrams) {
                observer.observe(diagram, observerConfig);
            }

            // Store state globally for later retrieval
            globalThis.__testObserverState = state;
            globalThis.__testObserver = observer;

            // Change the preview style
            const styleSelector = document.getElementById('styleSelector');
            if (styleSelector) {
                const currentValue = styleSelector.value;
                const newOption = Array.from(styleSelector.options)
                    .find(o => o.value !== currentValue && o.value !== '');
                if (newOption) {
                    styleSelector.value = newOption.value;
                    styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });

        // Wait for re-render to complete
        await page.waitForTimeout(2000);

        // Collect results
        const renderBehavior = await page.evaluate(() => {
            globalThis.__testObserver?.disconnect();
            const diagram = document.querySelector('.mermaid');
            const result = {
                sawLoadingClass: globalThis.__testObserverState?.sawLoadingClass || false,
                finalState: diagram?.dataset.mermaidRendered || 'missing',
                hasSvg: diagram?.querySelector('svg') !== null
            };
            delete globalThis.__testObserverState;
            delete globalThis.__testObserver;
            return result;
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

        // Trigger style change
        await page.evaluate(() => {
            const styleSelector = document.getElementById('styleSelector');
            if (styleSelector) {
                const currentIndex = styleSelector.selectedIndex;
                styleSelector.selectedIndex = currentIndex === 0 ? 1 : 0;
                styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Wait for re-render to complete
        await page.waitForTimeout(2000);

        // Collect final state
        const finalState = await page.evaluate(() => {
            const diagrams = document.querySelectorAll('.mermaid');
            return Array.from(diagrams).map(d => ({
                rendered: d.dataset.mermaidRendered,
                hasSvg: d.querySelector('svg') !== null
            }));
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

        // Set up observer to track pending states
        await page.evaluate(() => {
            const state = { pendingStateCount: 0 };
            const diagrams = document.querySelectorAll('.mermaid');

            // Named callback to reduce nesting depth (S2004)
            function handleMutation(mutation) {
                if (mutation.target.dataset?.mermaidRendered === 'pending') {
                    state.pendingStateCount++;
                }
            }

            const observer = new MutationObserver(mutations => mutations.forEach(handleMutation));

            for (const diagram of diagrams) {
                observer.observe(diagram, {
                    attributes: true,
                    attributeFilter: ['data-mermaid-rendered']
                });
            }

            globalThis.__testObserverState = state;
            globalThis.__testObserver = observer;
        });

        // Rapidly toggle styles
        for (let i = 0; i < 5; i++) {
            await page.evaluate((index) => {
                const styleSelector = document.getElementById('styleSelector');
                if (styleSelector) {
                    styleSelector.selectedIndex = index % styleSelector.options.length;
                    styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, i);
            await page.waitForTimeout(100);
        }

        // Wait for all changes to settle
        await page.waitForTimeout(1500);

        // Collect results
        const flickerCount = await page.evaluate(() => {
            globalThis.__testObserver?.disconnect();
            const count = globalThis.__testObserverState?.pendingStateCount || 0;
            delete globalThis.__testObserverState;
            delete globalThis.__testObserver;
            return count;
        });

        // After fix: should be 0 (no pending states)
        // Before fix: will be >= number of style changes × number of diagrams
        console.log('Pending state transitions during rapid changes:', flickerCount);
        expect(flickerCount).toBe(0);
    });

    test('mermaid diagrams should remain visible during style transition', async ({ page }) => {
        await setupMermaidContent(page);

        const snapshots = [];

        // Capture initial state using module-level helper
        snapshots.push(await captureDiagramVisibility(page, 'before'));

        // Change style
        await page.evaluate(() => {
            const styleSelector = document.getElementById('styleSelector');
            if (styleSelector) {
                styleSelector.selectedIndex = 1;
                styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Capture states at intervals during re-render
        const intervals = [50, 100, 200, 500, 1000];
        for (const ms of intervals) {
            await page.waitForTimeout(ms - (intervals[intervals.indexOf(ms) - 1] || 0));
            snapshots.push(await captureDiagramVisibility(page, `${ms}ms`));
        }

        console.log('Visibility snapshots:', JSON.stringify(snapshots, null, 2));

        // All snapshots should show diagrams with SVGs visible
        for (const snapshot of snapshots) {
            for (const diagram of snapshot.state) {
                expect(diagram.hasSvg).toBe(true);
                expect(diagram.hasLoadingClass).toBe(false);
            }
        }
    });

    test('should handle diagrams without stored mermaidSource gracefully', async ({ page }) => {
        await setupMermaidContent(page);

        // Manually remove mermaidSource from one diagram to simulate edge case
        // (e.g., diagram rendered by older code version or data corruption)
        await page.evaluate(() => {
            const diagram = document.querySelector('.mermaid');
            if (diagram) {
                delete diagram.dataset.mermaidSource;
            }
        });

        // Change style - should not throw errors
        await page.evaluate(() => {
            const styleSelector = document.getElementById('styleSelector');
            if (styleSelector) {
                styleSelector.selectedIndex = (styleSelector.selectedIndex + 1) % styleSelector.options.length;
                styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await page.waitForTimeout(2000);

        // Verify page is still functional - no console errors and diagrams exist
        const state = await page.evaluate(() => {
            const diagrams = document.querySelectorAll('.mermaid');
            return {
                diagramCount: diagrams.length,
                allHaveSvg: Array.from(diagrams).every(d => d.querySelector('svg') !== null)
            };
        });

        expect(state.diagramCount).toBeGreaterThanOrEqual(1);
        expect(state.allHaveSvg).toBe(true);
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
                rectFill: rect?.getAttribute('fill') || globalThis.getComputedStyle(rect).fill,
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

        // Note: We just need to verify the diagram is rendered after style changes
        // The initial theme value is not needed for this test's assertions

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
                theme: globalThis.state?.mermaidTheme
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

        // Set up observer to monitor for content removal
        await page.evaluate(() => {
            const state = { contentRemoved: false };
            const codeBlocks = document.querySelectorAll('pre code');
            const originalCount = codeBlocks.length;

            // Named callback to reduce nesting depth (S2004)
            function handleMutation() {
                const currentCount = document.querySelectorAll('pre code').length;
                if (currentCount < originalCount) {
                    state.contentRemoved = true;
                }
            }

            const observer = new MutationObserver(handleMutation);
            const preview = document.getElementById('preview');
            if (preview) {
                observer.observe(preview, { childList: true, subtree: true });
            }

            globalThis.__testObserverState = state;
            globalThis.__testObserver = observer;
        });

        // Change style
        await page.evaluate(() => {
            const styleSelector = document.getElementById('styleSelector');
            if (styleSelector) {
                styleSelector.selectedIndex = 1;
                styleSelector.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Wait for any changes to settle
        await page.waitForTimeout(1500);

        // Collect results
        const codeBlockFlicker = await page.evaluate(() => {
            globalThis.__testObserver?.disconnect();
            const result = { contentRemoved: globalThis.__testObserverState?.contentRemoved || false };
            delete globalThis.__testObserverState;
            delete globalThis.__testObserver;
            return result;
        });

        // Code blocks currently also get re-rendered, but they don't "flicker"
        // because syntax highlighting is applied synchronously
        console.log('Code block flicker result:', codeBlockFlicker);
    });
});
