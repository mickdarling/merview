/**
 * Test for issue #327: Mermaid diagram edge labels should not be struck through by arrows
 * Verifies that edge labels have proper background rectangles with full opacity
 */

const { test, expect } = require('@playwright/test');

test.describe('Mermaid Edge Labels', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080');
        await page.waitForLoadState('networkidle');
    });

    test('edge label foreignObjects should have background', async ({ page }) => {
        // Load test markdown with edge labels
        const markdown = `
# Test Edge Labels

\`\`\`mermaid
graph LR
    A[Start] -->|Label 1| B[Middle]
    B -->|Label 2| C[End]
\`\`\`
        `;

        await page.evaluate((md) => {
            const editor = document.querySelector('.CodeMirror').CodeMirror;
            editor.setValue(md);
        }, markdown);

        // Wait for Mermaid to render
        await page.waitForSelector('.mermaid svg', { timeout: 5000 });

        // Verify edge label foreignObjects have a background (our CSS fix)
        const foreignObjectBackground = await page.evaluate(() => {
            const foreignObject = document.querySelector('.mermaid svg .edgeLabel foreignObject');
            if (!foreignObject) return null;
            const computedStyle = window.getComputedStyle(foreignObject);
            return {
                backgroundColor: computedStyle.backgroundColor,
                hasBackground: computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                              computedStyle.backgroundColor !== 'transparent'
            };
        });

        // Should have a background color (not transparent)
        expect(foreignObjectBackground).not.toBeNull();
        expect(foreignObjectBackground.hasBackground).toBe(true);
    });

    test('sponsor page diagram should render with edge labels', async ({ page }) => {
        // Load the sponsor page
        await page.goto('http://localhost:8080/?url=docs/sponsor.md');
        await page.waitForLoadState('networkidle');

        // Wait for Mermaid to render
        await page.waitForSelector('.mermaid svg', { timeout: 5000 });

        // Check that edge labels exist (the sponsor diagram has 2 labeled edges: "Sponsor" and "Free for Everyone")
        const edgeLabels = await page.locator('.mermaid svg .edgeLabel').count();
        expect(edgeLabels).toBeGreaterThan(0);

        // Verify edge label foreignObjects have backgrounds
        const foreignObjectBackground = await page.evaluate(() => {
            const foreignObject = document.querySelector('.mermaid svg .edgeLabel foreignObject');
            if (!foreignObject) return null;
            const computedStyle = window.getComputedStyle(foreignObject);
            return {
                backgroundColor: computedStyle.backgroundColor,
                hasBackground: computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                              computedStyle.backgroundColor !== 'transparent'
            };
        });

        expect(foreignObjectBackground).not.toBeNull();
        expect(foreignObjectBackground.hasBackground).toBe(true);
    });

    test('edge label CSS fix should be applied', async ({ page }) => {
        // Verify the CSS fix is present in the page
        const cssRuleExists = await page.evaluate(() => {
            const styleSheets = Array.from(document.styleSheets);
            for (const sheet of styleSheets) {
                try {
                    const rules = Array.from(sheet.cssRules || []);
                    for (const rule of rules) {
                        if (rule.selectorText &&
                            rule.selectorText.includes('.mermaid svg .edgeLabel rect')) {
                            return true;
                        }
                    }
                } catch (e) {
                    // Skip stylesheets we can't access (CORS)
                    continue;
                }
            }
            return false;
        });

        expect(cssRuleExists).toBe(true);
    });
});
