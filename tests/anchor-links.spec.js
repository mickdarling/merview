// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Helper to set editor content using CodeMirror API and trigger render
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} content - Markdown content to set
 */
async function setEditorContent(page, content) {
    await page.evaluate(async (text) => {
        // Access CodeMirror instance via DOM element
        const cmElement = document.querySelector('.CodeMirror');
        const cmInstance = cmElement?.CodeMirror;
        if (cmInstance) {
            cmInstance.setValue(text);
        }
        // Trigger render to ensure content is displayed
        if (typeof globalThis.renderMarkdown === 'function') {
            await globalThis.renderMarkdown();
        }
    }, content);
    await page.waitForTimeout(300); // Wait for mermaid diagrams if any
}

test.describe('Internal Anchor Links', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('headings should have ID attributes for anchor linking', async ({ page }) => {
        await setEditorContent(page, '# First Heading\n\n## Second Heading\n\n### Third Heading');

        // Check that headings have correct IDs
        await expect(page.locator('#wrapper #first-heading')).toBeVisible();
        await expect(page.locator('#wrapper #second-heading')).toBeVisible();
        await expect(page.locator('#wrapper #third-heading')).toBeVisible();
    });

    test('clicking anchor link should scroll to target heading', async ({ page }) => {
        // Create long content with link at top and target at bottom
        const markdown = `# Top

[Jump to Target](#target-section)

${'Lorem ipsum dolor sit amet.\n\n'.repeat(20)}

## Target Section

This is the target.`;

        await setEditorContent(page, markdown);

        const preview = page.locator('#preview');
        const link = page.locator('#wrapper a[href="#target-section"]');

        // Get initial scroll position
        const initialScroll = await preview.evaluate(el => el.scrollTop);

        // Click the anchor link
        await link.click();
        await page.waitForTimeout(300);

        // Scroll should have changed
        const afterScroll = await preview.evaluate(el => el.scrollTop);
        expect(afterScroll).toBeGreaterThan(initialScroll);
    });

    test('heading IDs should be URL-friendly slugs', async ({ page }) => {
        await setEditorContent(page, '# Hello World!\n\n## Multiple   Spaces\n\n### Special-Characters Here');

        // Check slugification: special chars removed, spaces become hyphens
        await expect(page.locator('#wrapper #hello-world')).toBeVisible();
        await expect(page.locator('#wrapper #multiple-spaces')).toBeVisible();
        await expect(page.locator('#wrapper #special-characters-here')).toBeVisible();
    });

    test('anchor links in table of contents should work', async ({ page }) => {
        const markdown = `# Contents

- [Introduction](#introduction)
- [Details](#details)
- [Conclusion](#conclusion)

## Introduction

This is the intro.

## Details

These are details.

## Conclusion

This is the end.`;

        await setEditorContent(page, markdown);

        // All TOC links should exist
        await expect(page.locator('#wrapper a[href="#introduction"]')).toBeVisible();
        await expect(page.locator('#wrapper a[href="#details"]')).toBeVisible();
        await expect(page.locator('#wrapper a[href="#conclusion"]')).toBeVisible();

        // All target headings should have correct IDs
        await expect(page.locator('#wrapper #introduction')).toBeVisible();
        await expect(page.locator('#wrapper #details')).toBeVisible();
        await expect(page.locator('#wrapper #conclusion')).toBeVisible();
    });
});
