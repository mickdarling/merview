// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests for Mermaid diagram text clipping fix (Issue #172)
 * Verifies that SVG text elements are not clipped due to CSS inheritance
 */

test.describe('Mermaid text clipping fix', () => {
    const mermaidContent = `# Test Diagram

\`\`\`mermaid
graph LR
    A[Markdown Editor] --> B[Parser]
    B --> C[Renderer]
    B --> D[Mermaid]
    C --> E[Live Preview]
    D --> E
\`\`\`
`;

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(1000);

        // Set content with Mermaid diagram
        await page.evaluate((content) => {
            if (globalThis.setEditorContent) {
                globalThis.setEditorContent(content);
            }
        }, mermaidContent);

        // Wait for Mermaid to render
        await page.waitForTimeout(2000);
    });

    test('mermaid container should have line-height isolation', async ({ page }) => {
        const mermaidDiv = page.locator('.mermaid').first();
        await expect(mermaidDiv).toBeVisible();

        const lineHeight = await mermaidDiv.evaluate((el) => {
            return globalThis.getComputedStyle(el).lineHeight;
        });

        // line-height: 1 computes to the font-size value in pixels (e.g., "16px")
        // or "normal". We verify it's not an inflated value like "28.8px" from 1.8 * 16
        const numericValue = Number.parseFloat(lineHeight);
        if (!Number.isNaN(numericValue)) {
            // If it's a numeric pixel value, it should be close to the font-size (not inflated)
            expect(numericValue).toBeLessThan(25); // Should not be inflated
        }
        // If it's "normal", that's fine too
    });

    test('mermaid SVG should be rendered', async ({ page }) => {
        const svg = page.locator('.mermaid svg').first();
        await expect(svg).toBeVisible();
    });

    test('mermaid container should have font-size reset', async ({ page }) => {
        const mermaidDiv = page.locator('.mermaid').first();
        await expect(mermaidDiv).toBeVisible();

        // Verify font-size is not inherited from wrapper styles
        const fontSize = await mermaidDiv.evaluate((el) => {
            return globalThis.getComputedStyle(el).fontSize;
        });

        // font-size: initial typically resolves to browser default (16px)
        const numericSize = Number.parseFloat(fontSize);
        expect(numericSize).toBeGreaterThan(0);
        expect(numericSize).toBeLessThanOrEqual(20); // Should be reasonable default
    });
});
