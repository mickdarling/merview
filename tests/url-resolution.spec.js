/**
 * Tests for URL resolution logic (docs navigation)
 * Tests the isRelativeDocPath, resolveDocUrl, and getDocsBaseUrl functions
 */
const { test, expect } = require('@playwright/test');

test.describe('isRelativeDocPath - Valid Paths', () => {
    test('should recognize standard doc paths', async ({ page }) => {
        await page.goto('/');

        const results = await page.evaluate(() => {
            return import('./js/config.js').then(({ isRelativeDocPath }) => ({
                'docs/about.md': isRelativeDocPath('docs/about.md'),
                'docs/themes.md': isRelativeDocPath('docs/themes.md'),
                'docs/security.md': isRelativeDocPath('docs/security.md'),
                'docs/contributing.md': isRelativeDocPath('docs/contributing.md'),
                'docs/sponsor.md': isRelativeDocPath('docs/sponsor.md'),
            }));
        });

        expect(results['docs/about.md']).toBe(true);
        expect(results['docs/themes.md']).toBe(true);
        expect(results['docs/security.md']).toBe(true);
        expect(results['docs/contributing.md']).toBe(true);
        expect(results['docs/sponsor.md']).toBe(true);
    });

    test('should recognize paths with leading slash', async ({ page }) => {
        await page.goto('/');

        const result = await page.evaluate(() => {
            return import('./js/config.js').then(({ isRelativeDocPath }) =>
                isRelativeDocPath('/docs/about.md')
            );
        });

        expect(result).toBe(true);
    });

    test('should allow hyphens and underscores in filenames', async ({ page }) => {
        await page.goto('/');

        const results = await page.evaluate(() => {
            return import('./js/config.js').then(({ isRelativeDocPath }) => ({
                'docs/my-file.md': isRelativeDocPath('docs/my-file.md'),
                'docs/my_file.md': isRelativeDocPath('docs/my_file.md'),
                'docs/my-file_name.md': isRelativeDocPath('docs/my-file_name.md'),
            }));
        });

        expect(results['docs/my-file.md']).toBe(true);
        expect(results['docs/my_file.md']).toBe(true);
        expect(results['docs/my-file_name.md']).toBe(true);
    });
});

test.describe('isRelativeDocPath - Invalid Paths', () => {
    test('should reject paths not in docs folder', async ({ page }) => {
        await page.goto('/');

        const results = await page.evaluate(() => {
            return import('./js/config.js').then(({ isRelativeDocPath }) => ({
                'about.md': isRelativeDocPath('about.md'),
                'other/about.md': isRelativeDocPath('other/about.md'),
            }));
        });

        expect(results['about.md']).toBe(false);
        expect(results['other/about.md']).toBe(false);
    });

    test('should reject wrong extensions', async ({ page }) => {
        await page.goto('/');

        const results = await page.evaluate(() => {
            return import('./js/config.js').then(({ isRelativeDocPath }) => ({
                'docs/about.txt': isRelativeDocPath('docs/about.txt'),
                'docs/about': isRelativeDocPath('docs/about'),
            }));
        });

        expect(results['docs/about.txt']).toBe(false);
        expect(results['docs/about']).toBe(false);
    });

    test('should reject full URLs', async ({ page }) => {
        await page.goto('/');

        const results = await page.evaluate(() => {
            return import('./js/config.js').then(({ isRelativeDocPath }) => ({
                'https://example.com/docs/about.md': isRelativeDocPath('https://example.com/docs/about.md'),
                'http://localhost/docs/about.md': isRelativeDocPath('http://localhost/docs/about.md'),
            }));
        });

        expect(results['https://example.com/docs/about.md']).toBe(false);
        expect(results['http://localhost/docs/about.md']).toBe(false);
    });

    test('should reject path traversal attempts', async ({ page }) => {
        await page.goto('/');

        const results = await page.evaluate(() => {
            return import('./js/config.js').then(({ isRelativeDocPath }) => ({
                'docs/../secret.md': isRelativeDocPath('docs/../secret.md'),
                'docs/./about.md': isRelativeDocPath('docs/./about.md'),
            }));
        });

        expect(results['docs/../secret.md']).toBe(false);
        expect(results['docs/./about.md']).toBe(false);
    });

    test('should reject special characters', async ({ page }) => {
        await page.goto('/');

        const results = await page.evaluate(() => {
            return import('./js/config.js').then(({ isRelativeDocPath }) => ({
                'docs/about%00.md': isRelativeDocPath('docs/about%00.md'),
                'docs/about?.md': isRelativeDocPath('docs/about?.md'),
                'docs/about file.md': isRelativeDocPath('docs/about file.md'),
            }));
        });

        expect(results['docs/about%00.md']).toBe(false);
        expect(results['docs/about?.md']).toBe(false);
        expect(results['docs/about file.md']).toBe(false);
    });
});

test.describe('isRelativeDocPath - Case Sensitivity', () => {
    test('should require lowercase docs/ prefix', async ({ page }) => {
        await page.goto('/');

        const results = await page.evaluate(() => {
            return import('./js/config.js').then(({ isRelativeDocPath }) => ({
                'docs/about.md': isRelativeDocPath('docs/about.md'),
                'DOCS/about.md': isRelativeDocPath('DOCS/about.md'),
                'Docs/about.md': isRelativeDocPath('Docs/about.md'),
                'DoCs/about.md': isRelativeDocPath('DoCs/about.md'),
            }));
        });

        expect(results['docs/about.md']).toBe(true);
        expect(results['DOCS/about.md']).toBe(false);
        expect(results['Docs/about.md']).toBe(false);
        expect(results['DoCs/about.md']).toBe(false);
    });
});

test.describe('getDocsBaseUrl', () => {
    test('should return localhost URL when running locally', async ({ page }) => {
        await page.goto('/');

        const baseUrl = await page.evaluate(() => {
            return import('./js/config.js').then(({ getDocsBaseUrl }) => getDocsBaseUrl());
        });

        // When running tests, we're on localhost
        expect(baseUrl).toMatch(/^https?:\/\/localhost(:\d+)?$/);
    });

    test('should cache the result', async ({ page }) => {
        await page.goto('/');

        const results = await page.evaluate(() => {
            return import('./js/config.js').then(({ getDocsBaseUrl }) => {
                const first = getDocsBaseUrl();
                const second = getDocsBaseUrl();
                const third = getDocsBaseUrl();
                return { first, second, third, allEqual: first === second && second === third };
            });
        });

        expect(results.allEqual).toBe(true);
    });
});

test.describe('resolveDocUrl', () => {
    test('should resolve relative paths to full URLs', async ({ page }) => {
        await page.goto('/');

        const results = await page.evaluate(() => {
            return import('./js/config.js').then(({ resolveDocUrl, getDocsBaseUrl }) => {
                const baseUrl = getDocsBaseUrl();
                return {
                    baseUrl,
                    'docs/about.md': resolveDocUrl('docs/about.md'),
                    'docs/themes.md': resolveDocUrl('docs/themes.md'),
                };
            });
        });

        expect(results['docs/about.md']).toBe(`${results.baseUrl}/docs/about.md`);
        expect(results['docs/themes.md']).toBe(`${results.baseUrl}/docs/themes.md`);
    });

    test('should normalize paths with leading slash', async ({ page }) => {
        await page.goto('/');

        const results = await page.evaluate(() => {
            return import('./js/config.js').then(({ resolveDocUrl }) => ({
                withSlash: resolveDocUrl('/docs/about.md'),
                withoutSlash: resolveDocUrl('docs/about.md'),
            }));
        });

        // Both should produce the same result
        expect(results.withSlash).toBe(results.withoutSlash);
    });
});

test.describe('Doc Navigation Integration', () => {
    test('should load doc via ?url=docs/about.md parameter', async ({ page }) => {
        // Navigate with relative doc path
        await page.goto('/?url=docs/about.md');

        // Wait for content to load
        await page.waitForTimeout(1000);

        // Check that the about page content loaded
        const preview = page.locator('#preview');
        await expect(preview).toContainText('About Merview');
    });

    test('should load doc via ?url=/docs/themes.md parameter', async ({ page }) => {
        // Navigate with leading slash
        await page.goto('/?url=/docs/themes.md');

        // Wait for content to load
        await page.waitForTimeout(1000);

        // Check that the themes page content loaded
        const preview = page.locator('#preview');
        await expect(preview).toContainText('Theme Guide');
    });

    test('should not load invalid doc paths (wrong case)', async ({ page }) => {
        // Navigate with invalid path (wrong case)
        await page.goto('/?url=DOCS/about.md');

        // Wait for content to load
        await page.waitForTimeout(1000);

        // Should show sample/welcome content, not the doc
        const preview = page.locator('#preview');
        await expect(preview).not.toContainText('What is Merview?');
    });
});
