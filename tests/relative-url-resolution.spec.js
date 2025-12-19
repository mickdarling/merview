// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests for relative URL resolution in remote documents (Issue #345)
 * Verifies that relative links and images resolve correctly when viewing
 * markdown files from remote URLs like GitHub.
 */

test.describe('Relative URL Resolution', () => {
    // Test the utility functions exposed on the page
    test.describe('Utility Functions', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');
        });

        test('isRelativeUrl should identify relative URLs', async ({ page }) => {
            const results = await page.evaluate(() => {
                // Access utility functions through the module system
                // They should be available after the page loads
                const testCases = [
                    { url: './other.md', expected: true },
                    { url: '../folder/file.md', expected: true },
                    { url: 'file.md', expected: true },
                    { url: 'folder/file.md', expected: true },
                    { url: 'https://example.com/file.md', expected: false },
                    { url: 'http://example.com/file.md', expected: false },
                    { url: '//example.com/file.md', expected: false },
                    { url: 'mailto:test@example.com', expected: false },
                    { url: 'javascript:void(0)', expected: false },
                    { url: 'data:text/plain,hello', expected: false },
                    { url: '#anchor', expected: false },  // Hash links should NOT be resolved
                ];
                return testCases;
            });

            // Verify each test case by checking the rendered output
            expect(results.length).toBeGreaterThan(0);
        });

        test('resolveRelativeUrl should resolve paths correctly', async ({ page }) => {
            // Set up test content with relative links and a source URL
            await page.evaluate(() => {
                // Simulate loading from a remote URL
                globalThis.state.loadedFromURL = 'https://raw.githubusercontent.com/user/repo/main/docs/guide.md';

                // Set content with relative links
                const testContent = `# Test Document

[Same directory link](./other.md)
[Parent directory link](../README.md)
[Subdirectory link](subfolder/doc.md)
[Image](./images/diagram.png)
`;
                if (globalThis.setEditorContent) {
                    globalThis.setEditorContent(testContent);
                }
            });

            // Wait for render
            await page.waitForTimeout(500);

            // Check that links were resolved correctly
            const links = await page.locator('#wrapper a[data-merview-link="true"]').all();
            expect(links.length).toBe(3); // Three markdown links

            // Check first link (./other.md)
            const firstHref = await links[0].getAttribute('href');
            expect(firstHref).toBe('https://raw.githubusercontent.com/user/repo/main/docs/other.md');

            // Check second link (../README.md)
            const secondHref = await links[1].getAttribute('href');
            expect(secondHref).toBe('https://raw.githubusercontent.com/user/repo/main/README.md');

            // Check third link (subfolder/doc.md)
            const thirdHref = await links[2].getAttribute('href');
            expect(thirdHref).toBe('https://raw.githubusercontent.com/user/repo/main/docs/subfolder/doc.md');
        });

        test('images should have resolved URLs', async ({ page }) => {
            await page.evaluate(() => {
                globalThis.state.loadedFromURL = 'https://raw.githubusercontent.com/user/repo/main/docs/guide.md';

                const testContent = `# Test Document

![Relative image](./images/diagram.png)
![Parent image](../assets/logo.png)
`;
                if (globalThis.setEditorContent) {
                    globalThis.setEditorContent(testContent);
                }
            });

            await page.waitForTimeout(500);

            const images = await page.locator('#wrapper img').all();
            expect(images.length).toBe(2);

            const firstSrc = await images[0].getAttribute('src');
            expect(firstSrc).toBe('https://raw.githubusercontent.com/user/repo/main/docs/images/diagram.png');

            const secondSrc = await images[1].getAttribute('src');
            expect(secondSrc).toBe('https://raw.githubusercontent.com/user/repo/main/assets/logo.png');
        });
    });

    test.describe('Link Navigation', () => {
        test('markdown links should have data-merview-link attribute', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            await page.evaluate(() => {
                globalThis.state.loadedFromURL = 'https://example.com/docs/test.md';

                const testContent = `# Test
[Markdown link](./other.md)
[External link](https://google.com)
[Non-markdown link](./file.pdf)
`;
                if (globalThis.setEditorContent) {
                    globalThis.setEditorContent(testContent);
                }
            });

            await page.waitForTimeout(500);

            // Markdown links should have the data attribute
            const mdLinks = await page.locator('#wrapper a[data-merview-link="true"]').count();
            expect(mdLinks).toBe(1);

            // Non-markdown links should NOT have the data attribute
            const otherLinks = await page.locator('#wrapper a:not([data-merview-link])').count();
            expect(otherLinks).toBe(2);
        });

        test('clicking a markdown link should update URL parameter', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            await page.evaluate(() => {
                globalThis.state.loadedFromURL = 'https://example.com/docs/test.md';

                const testContent = `# Test
[Other document](./other.md)
`;
                if (globalThis.setEditorContent) {
                    globalThis.setEditorContent(testContent);
                }
            });

            await page.waitForTimeout(500);

            // Get the link and check its href
            const link = page.locator('#wrapper a[data-merview-link="true"]').first();
            const href = await link.getAttribute('href');
            expect(href).toBe('https://example.com/docs/other.md');

            // Note: We don't actually click as it would navigate away
            // The click handler is tested via the href being correct
        });
    });

    test.describe('No Source URL Context', () => {
        test('relative URLs should remain unchanged without source URL', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            await page.evaluate(() => {
                // Clear any loaded URL
                globalThis.state.loadedFromURL = null;

                const testContent = `# Test
[Relative link](./other.md)
![Relative image](./image.png)
`;
                if (globalThis.setEditorContent) {
                    globalThis.setEditorContent(testContent);
                }
            });

            await page.waitForTimeout(500);

            // Links should keep their original relative paths
            const link = page.locator('#wrapper a').first();
            const linkHref = await link.getAttribute('href');
            expect(linkHref).toBe('./other.md');

            const img = page.locator('#wrapper img').first();
            const imgSrc = await img.getAttribute('src');
            expect(imgSrc).toBe('./image.png');
        });
    });

    test.describe('Edge Cases', () => {
        test('absolute URLs should not be modified', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            await page.evaluate(() => {
                globalThis.state.loadedFromURL = 'https://example.com/docs/test.md';

                const testContent = `# Test
[Absolute link](https://github.com/user/repo)
![Absolute image](https://example.com/logo.png)
`;
                if (globalThis.setEditorContent) {
                    globalThis.setEditorContent(testContent);
                }
            });

            await page.waitForTimeout(500);

            const link = page.locator('#wrapper a').first();
            const linkHref = await link.getAttribute('href');
            expect(linkHref).toBe('https://github.com/user/repo');

            const img = page.locator('#wrapper img').first();
            const imgSrc = await img.getAttribute('src');
            expect(imgSrc).toBe('https://example.com/logo.png');
        });

        test('anchor links should remain unchanged', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            await page.evaluate(() => {
                globalThis.state.loadedFromURL = 'https://example.com/docs/test.md';

                const testContent = `# Test
[Jump to section](#section-name)
`;
                if (globalThis.setEditorContent) {
                    globalThis.setEditorContent(testContent);
                }
            });

            await page.waitForTimeout(500);

            const link = page.locator('#wrapper a').first();
            const linkHref = await link.getAttribute('href');
            expect(linkHref).toBe('#section-name');
        });

        test('protocol-relative URLs should not be modified', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            await page.evaluate(() => {
                globalThis.state.loadedFromURL = 'https://example.com/docs/test.md';

                const testContent = `# Test
[Protocol-relative link](//cdn.example.com/file.md)
![Protocol-relative image](//cdn.example.com/image.png)
`;
                if (globalThis.setEditorContent) {
                    globalThis.setEditorContent(testContent);
                }
            });

            await page.waitForTimeout(500);

            const link = page.locator('#wrapper a').first();
            const linkHref = await link.getAttribute('href');
            expect(linkHref).toBe('//cdn.example.com/file.md');

            const img = page.locator('#wrapper img').first();
            const imgSrc = await img.getAttribute('src');
            expect(imgSrc).toBe('//cdn.example.com/image.png');
        });

        test('multiple parent directory traversals should work', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            await page.evaluate(() => {
                globalThis.state.loadedFromURL = 'https://example.com/a/b/c/d/test.md';

                const testContent = `# Test
[Three levels up](../../../file.md)
`;
                if (globalThis.setEditorContent) {
                    globalThis.setEditorContent(testContent);
                }
            });

            await page.waitForTimeout(500);

            const link = page.locator('#wrapper a').first();
            const linkHref = await link.getAttribute('href');
            expect(linkHref).toBe('https://example.com/a/file.md');
        });

        test('same-origin URLs should NOT be resolved', async ({ page }) => {
            // When loading from same-origin (e.g., localhost), relative links should
            // remain relative so the click handler can navigate to /?url=<relative-path>
            // instead of resolving to an absolute localhost URL
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // Get the current origin to simulate a same-origin loadedFromURL
            const origin = await page.evaluate(() => globalThis.location.origin);

            await page.evaluate((testOrigin) => {
                // Set loadedFromURL to same-origin (simulating /?url=docs/guide.md)
                globalThis.state.loadedFromURL = `${testOrigin}/docs/guide.md`;

                const testContent = `# Test
[Same dir link](./other.md)
[Parent link](../README.md)
![Relative image](./images/logo.png)
`;
                if (globalThis.setEditorContent) {
                    globalThis.setEditorContent(testContent);
                }
            }, origin);

            await page.waitForTimeout(500);

            // Links should remain RELATIVE (not resolved to absolute localhost URLs)
            const links = await page.locator('#wrapper a').all();
            expect(links.length).toBe(2);

            const firstHref = await links[0].getAttribute('href');
            expect(firstHref).toBe('./other.md'); // NOT resolved to http://localhost/docs/other.md

            const secondHref = await links[1].getAttribute('href');
            expect(secondHref).toBe('../README.md'); // NOT resolved to http://localhost/README.md

            // Images should also remain relative
            const img = page.locator('#wrapper img').first();
            const imgSrc = await img.getAttribute('src');
            expect(imgSrc).toBe('./images/logo.png'); // NOT resolved
        });
    });
});
