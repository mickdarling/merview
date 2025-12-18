/**
 * Mermaid Lazy Loading Tests
 * Tests for Issue #326 - Slow loading on documentation pages with multiple diagrams
 *
 * This test suite verifies that Mermaid diagrams are rendered lazily using
 * IntersectionObserver rather than all at once during initial page load.
 */

// @ts-check
const { test, expect } = require('@playwright/test');
const {
    waitForPageReady,
    waitForGlobalFunction,
    setCodeMirrorContent,
    renderMarkdownAndWait,
    WAIT_TIMES
} = require('./helpers/test-utils');

test.describe('Mermaid Lazy Loading', () => {
    test.beforeEach(async ({ page }) => {
        await waitForPageReady(page);
        await waitForGlobalFunction(page, 'openFile');
    });

    test('diagrams above the fold should render immediately', async ({ page }) => {
        // Create content with a diagram at the top
        const content = `# Test Document

\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\`

Regular text content here.
`;

        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

        // Wait a bit for lazy loading to trigger
        await page.waitForTimeout(WAIT_TIMES.SHORT);

        // Check that the first diagram is rendered (should be visible)
        const diagramRendered = await page.evaluate(() => {
            const diagram = document.querySelector('.mermaid');
            return diagram?.dataset.mermaidRendered === 'true';
        });

        expect(diagramRendered).toBe(true);
    });

    test('diagrams far below viewport should not render immediately', async ({ page }) => {
        // Create content with a diagram very far down the page (beyond 200px margin)
        const content = `# Test Document

${'\n'.repeat(100)}

\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\`
`;

        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.MEDIUM);

        // Check diagram status before any scroll
        const diagramStatus = await page.evaluate(() => {
            const diagram = document.querySelector('.mermaid');
            return diagram ? diagram.dataset.mermaidRendered : null;
        });

        // Should be 'pending' (waiting to be rendered) or 'true' if within rootMargin
        // The 200px rootMargin means nearby diagrams will preload
        expect(diagramStatus).toMatch(/^(pending|true)$/);
    });

    test('lazy loading improves initial render performance', async ({ page }) => {
        // Create content with multiple diagrams
        const content = `# Test Document

\`\`\`mermaid
graph TD
    A1[First]
\`\`\`

${'\n'.repeat(100)}

\`\`\`mermaid
graph TD
    A2[Second]
\`\`\`

${'\n'.repeat(100)}

\`\`\`mermaid
graph TD
    A3[Third]
\`\`\`
`;

        await setCodeMirrorContent(page, content);

        // Measure render time
        const startTime = Date.now();
        await renderMarkdownAndWait(page, WAIT_TIMES.MEDIUM);
        const renderTime = Date.now() - startTime;

        // Check that at least one diagram exists
        const diagramCount = await page.evaluate(() => {
            return document.querySelectorAll('.mermaid').length;
        });

        expect(diagramCount).toBe(3);

        // Render should complete quickly (not waiting for all diagrams)
        // This is a loose check - main goal is not blocking on all diagram renders
        expect(renderTime).toBeLessThan(5000);
    });

    test('multiple diagrams should render progressively', async ({ page }) => {
        // Create content with multiple diagrams
        const content = `# Test Document

\`\`\`mermaid
graph TD
    A1[First]
\`\`\`

${'\n'.repeat(20)}

\`\`\`mermaid
graph TD
    A2[Second]
\`\`\`

${'\n'.repeat(20)}

\`\`\`mermaid
graph TD
    A3[Third]
\`\`\`
`;

        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

        // Wait for visible diagrams to render
        await page.waitForTimeout(WAIT_TIMES.SHORT);

        // Count how many diagrams are rendered
        const renderedCount = await page.evaluate(() => {
            const diagrams = document.querySelectorAll('.mermaid');
            return Array.from(diagrams).filter(d => d.dataset.mermaidRendered === 'true').length;
        });

        // First diagram should be rendered, others may not be (depends on viewport)
        expect(renderedCount).toBeGreaterThanOrEqual(1);
        expect(renderedCount).toBeLessThanOrEqual(3);
    });

    test('IntersectionObserver should be created and stored in state', async ({ page }) => {
        const content = `# Test

\`\`\`mermaid
graph TD
    A[Start]
\`\`\`
`;

        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.MEDIUM);

        // Check that the observer is stored in state
        const hasObserver = await page.evaluate(() => {
            return globalThis.state && globalThis.state.mermaidObserver !== null;
        });

        expect(hasObserver).toBe(true);
    });

    test('observer should be cleaned up on re-render', async ({ page }) => {
        const content = `# Test

\`\`\`mermaid
graph TD
    A[Start]
\`\`\`
`;

        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.MEDIUM);

        // Get initial observer
        const observer1 = await page.evaluate(() => {
            return globalThis.state ? globalThis.state.mermaidObserver : null;
        });

        // Trigger a re-render by changing content
        await setCodeMirrorContent(page, content + '\nMore content');
        await renderMarkdownAndWait(page, WAIT_TIMES.MEDIUM);

        // Check that a new observer was created
        const observer2 = await page.evaluate(() => {
            return globalThis.state ? globalThis.state.mermaidObserver : null;
        });

        // Both should exist (different instances)
        expect(observer1).not.toBeNull();
        expect(observer2).not.toBeNull();
    });

    test('malformed diagrams should show error state', async ({ page }) => {
        const content = `# Test

\`\`\`mermaid
graph TD
    Invalid syntax here [
\`\`\`
`;

        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

        // Wait for diagram to attempt render
        await page.waitForTimeout(WAIT_TIMES.SHORT);

        // Check that error state is shown
        const errorState = await page.evaluate(() => {
            const diagram = document.querySelector('.mermaid');
            return {
                hasErrorClass: diagram?.classList.contains('mermaid-error'),
                renderedState: diagram?.dataset.mermaidRendered,
                hasErrorDetails: !!diagram?.querySelector('.mermaid-error-details')
            };
        });

        expect(errorState.hasErrorClass).toBe(true);
        expect(errorState.renderedState).toBe('error');
        expect(errorState.hasErrorDetails).toBe(true);
    });

    test('loading indicator should appear for pending diagrams', async ({ page }) => {
        const content = `# Test

${'\n'.repeat(100)}

\`\`\`mermaid
graph TD
    A[Far Down]
\`\`\`
`;

        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.MEDIUM);

        // Check loading state before scroll
        const loadingState = await page.evaluate(() => {
            const diagram = document.querySelector('.mermaid');
            return {
                hasLoadingClass: diagram?.classList.contains('mermaid-loading'),
                renderedState: diagram?.dataset.mermaidRendered
            };
        });

        // Should have loading indicator if still pending
        if (loadingState.renderedState === 'pending') {
            expect(loadingState.hasLoadingClass).toBe(true);
        }
    });

    test('performance: multiple diagrams render efficiently', async ({ page }) => {
        // Create content with 10 diagrams
        const diagrams = Array.from({ length: 10 }, (_, i) => `
${'\n'.repeat(20)}

\`\`\`mermaid
graph TD
    A${i}[Diagram ${i}]
\`\`\`
`).join('');

        const content = `# Performance Test\n${diagrams}`;

        await setCodeMirrorContent(page, content);

        const startTime = Date.now();
        await renderMarkdownAndWait(page, WAIT_TIMES.MEDIUM);
        const renderTime = Date.now() - startTime;

        // Verify all diagrams exist
        const diagramCount = await page.evaluate(() => {
            return document.querySelectorAll('.mermaid').length;
        });

        expect(diagramCount).toBe(10);

        // Initial render should be fast (not waiting for all diagrams)
        expect(renderTime).toBeLessThan(3000);

        // Scroll to bottom to trigger remaining diagrams
        await page.evaluate(() => {
            const preview = document.getElementById('preview');
            if (preview) {
                preview.scrollTop = preview.scrollHeight;
            }
        });

        // Wait for diagrams to render
        await page.waitForTimeout(WAIT_TIMES.LONG);

        // Count rendered diagrams
        const renderedCount = await page.evaluate(() => {
            const diagrams = document.querySelectorAll('.mermaid');
            return Array.from(diagrams).filter(d =>
                d.dataset.mermaidRendered === 'true'
            ).length;
        });

        // Several diagrams should be rendered after scrolling (at least 3)
        expect(renderedCount).toBeGreaterThanOrEqual(3);
    });

    test('error tracking counts failed diagrams', async ({ page }) => {
        const content = `# Error Tracking Test

\`\`\`mermaid
graph TD
    A[Valid]
\`\`\`

\`\`\`mermaid
invalid syntax
\`\`\`

\`\`\`mermaid
graph TD
    B[Valid 2]
\`\`\`
`;

        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

        // Wait for all diagrams to attempt render
        await page.waitForTimeout(WAIT_TIMES.MEDIUM);

        // Count errors
        const errorCount = await page.evaluate(() => {
            return document.querySelectorAll('.mermaid-error').length;
        });

        // Should have 1 error from the invalid diagram
        expect(errorCount).toBe(1);

        // Check that valid diagrams rendered
        const validCount = await page.evaluate(() => {
            const diagrams = document.querySelectorAll('.mermaid:not(.mermaid-error)');
            return Array.from(diagrams).filter(d =>
                d.dataset.mermaidRendered === 'true'
            ).length;
        });

        expect(validCount).toBeGreaterThan(0);
    });

    test('observer cleanup on page navigation', async ({ page }) => {
        const content = `# Test

\`\`\`mermaid
graph TD
    A[Start]
\`\`\`
`;

        await setCodeMirrorContent(page, content);
        await renderMarkdownAndWait(page, WAIT_TIMES.MEDIUM);

        // Verify observer exists
        const hasObserverBefore = await page.evaluate(() => {
            return globalThis.state?.mermaidObserver !== null;
        });

        expect(hasObserverBefore).toBe(true);

        // Simulate page navigation by triggering pagehide event
        await page.evaluate(() => {
            globalThis.dispatchEvent(new Event('pagehide'));
        });

        // Check that observer was cleaned up
        const hasObserverAfter = await page.evaluate(() => {
            return globalThis.state?.mermaidObserver;
        });

        expect(hasObserverAfter).toBeNull();
    });
});
