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
        if (Number.isNaN(numericValue)) {
            // "normal" is the browser default and is acceptable for isolated containers
            expect(lineHeight).toBe('normal');
        } else {
            // If it's a numeric pixel value, it should be close to the font-size (not inflated)
            expect(numericValue).toBeLessThan(25); // Should not be inflated
        }
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

    test('line-height stays isolated after switching to Monospace style', async ({ page }) => {
        const mermaidDiv = page.locator('.mermaid').first();
        await expect(mermaidDiv).toBeVisible();

        // Switch to Monospace style (which has line-height: 1.8 on #wrapper)
        await page.evaluate(() => {
            if (globalThis.changeStyle) {
                globalThis.changeStyle('monospace');
            }
        });
        await page.waitForTimeout(1500);

        // Verify line-height on mermaid container is still isolated
        const lineHeight = await mermaidDiv.evaluate((el) => {
            return globalThis.getComputedStyle(el).lineHeight;
        });

        const numericValue = Number.parseFloat(lineHeight);
        if (Number.isNaN(numericValue)) {
            expect(lineHeight).toBe('normal');
        } else {
            // Should still be small, not inflated by Monospace's 1.8 line-height
            expect(numericValue).toBeLessThan(25);
        }
    });

    // Issue #342 - Academic and Newspaper theme compatibility
    test('mermaid typography stays isolated with Academic theme', async ({ page }) => {
        const mermaidDiv = page.locator('.mermaid').first();
        await expect(mermaidDiv).toBeVisible();

        // Switch to Academic style (font-size: 18px, font-family: Georgia/serif)
        await page.evaluate(() => {
            if (globalThis.changeStyle) {
                globalThis.changeStyle('academic');
            }
        });
        await page.waitForTimeout(1500);

        // Verify typography properties are isolated from Academic theme
        const styles = await mermaidDiv.evaluate((el) => {
            const computed = globalThis.getComputedStyle(el);
            return {
                fontSize: computed.fontSize,
                fontFamily: computed.fontFamily,
                letterSpacing: computed.letterSpacing,
                lineHeight: computed.lineHeight,
            };
        });

        // font-size should not be Academic's 18px
        const fontSize = Number.parseFloat(styles.fontSize);
        expect(fontSize).toBeLessThanOrEqual(16);

        // font-family should not be Georgia/serif
        expect(styles.fontFamily.toLowerCase()).not.toContain('georgia');

        // letter-spacing should be normal (0px)
        expect(styles.letterSpacing).toBe('normal');
    });

    test('mermaid typography stays isolated with Newspaper theme', async ({ page }) => {
        const mermaidDiv = page.locator('.mermaid').first();
        await expect(mermaidDiv).toBeVisible();

        // Switch to Newspaper style (font-size: 14px, font-family: Times New Roman)
        await page.evaluate(() => {
            if (globalThis.changeStyle) {
                globalThis.changeStyle('newspaper');
            }
        });
        await page.waitForTimeout(1500);

        // Verify typography properties are isolated from Newspaper theme
        const styles = await mermaidDiv.evaluate((el) => {
            const computed = globalThis.getComputedStyle(el);
            return {
                fontSize: computed.fontSize,
                fontFamily: computed.fontFamily,
                letterSpacing: computed.letterSpacing,
                textTransform: computed.textTransform,
            };
        });

        // font-family should not be Times New Roman
        expect(styles.fontFamily.toLowerCase()).not.toContain('times');

        // text-transform should be none (Newspaper uses uppercase on some elements)
        expect(styles.textTransform).toBe('none');

        // letter-spacing should be normal
        expect(styles.letterSpacing).toBe('normal');
    });

    test('mermaid SVG text elements are isolated from theme styles', async ({ page }) => {
        // Wait for mermaid SVG to fully render
        const mermaidSvg = page.locator('.mermaid svg').first();
        await expect(mermaidSvg).toBeVisible({ timeout: 10000 });

        // Switch to Academic style which has the most aggressive typography
        await page.evaluate(() => {
            if (globalThis.changeStyle) {
                globalThis.changeStyle('academic');
            }
        });
        await page.waitForTimeout(1500);

        // Check SVG element styles (text elements may be nested deep)
        const svgStyles = await mermaidSvg.evaluate((el) => {
            const computed = globalThis.getComputedStyle(el);
            return {
                letterSpacing: computed.letterSpacing,
                wordSpacing: computed.wordSpacing,
                textTransform: computed.textTransform,
            };
        });

        // SVG should have isolated typography
        expect(svgStyles.letterSpacing).toBe('normal');
        expect(svgStyles.textTransform).toBe('none');
    });
});
