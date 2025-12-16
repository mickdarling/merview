// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  WAIT_TIMES
} = require('./helpers/test-utils');

/**
 * All internal documentation links used across the docs
 * These are extracted from docs/*.md and docs/demos/*.md
 *
 * expectedTitle: A string that should appear in the rendered content to verify correct loading
 */
const INTERNAL_DOC_LINKS = [
  { path: '/?sample', name: 'Welcome/Sample Page', expectedTitle: 'Welcome to Merview' },
  { path: '/?url=docs/about.md', name: 'About Merview', expectedTitle: 'About Merview' },
  { path: '/?url=docs/contributing.md', name: 'Contributing Guide', expectedTitle: 'Contributing' },
  { path: '/?url=docs/cors-configuration.md', name: 'CORS Configuration', expectedTitle: 'CORS Configuration' },
  { path: '/?url=docs/demos/code-validation.md', name: 'Code Validation Demo', expectedTitle: 'Code Validation Demo' },
  { path: '/?url=docs/demos/error-handling.md', name: 'Error Handling Demo', expectedTitle: 'Error Handling Demo' },
  { path: '/?url=docs/demos/index.md', name: 'Feature Demos Index', expectedTitle: 'Feature Demos' },
  { path: '/?url=docs/demos/international-text.md', name: 'International Text Demo', expectedTitle: 'International' },
  { path: '/?url=docs/demos/yaml-front-matter.md', name: 'YAML Front Matter Demo', expectedTitle: 'YAML Front Matter' },
  { path: '/?url=docs/developer-kit.md', name: 'Developer Kit', expectedTitle: 'Developer Kit' },
  { path: '/?url=docs/security.md', name: 'Security Documentation', expectedTitle: 'Security' },
  { path: '/?url=docs/sponsor.md', name: 'Sponsor/Support', expectedTitle: 'Support' },
  { path: '/?url=docs/themes.md', name: 'Theme Guide', expectedTitle: 'Theme' }
];

/**
 * Tests for internal documentation links
 *
 * Validates that all internal links used in documentation:
 * 1. Load without errors
 * 2. Render content in the preview
 * 3. Do not show error messages
 *
 * Note: Uses baseURL from playwright.config.js (default: http://localhost:8081)
 */
test.describe('Documentation Links Validation', () => {

  test.describe('All Internal Links Load Successfully', () => {
    for (const link of INTERNAL_DOC_LINKS) {
      test(`${link.name} (${link.path}) loads correctly`, async ({ page }) => {
        // Navigate using relative path (uses baseURL from config)
        await page.goto(link.path);
        await waitForPageReady(page);
        await page.waitForTimeout(WAIT_TIMES.LONG);

        // Verify preview has content
        const previewContent = await page.$eval('#wrapper', el => el.textContent.trim());
        expect(previewContent.length).toBeGreaterThan(50);

        // Verify no error modal is shown (actual load errors show modals)
        const errorModal = await page.$('.modal.show');
        expect(errorModal).toBeNull();

        // Verify the expected document title appears (proves correct doc loaded)
        expect(previewContent).toContain(link.expectedTitle);
      });
    }
  });

  test.describe('Documentation Content Integrity', () => {
    test('Welcome page contains expected sections', async ({ page }) => {
      await page.goto('/?sample');
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const content = await page.$eval('#wrapper', el => el.textContent);

      expect(content).toContain('Welcome to Merview');
      expect(content).toContain('Quick Links');
      expect(content).toContain('Getting Started');
    });

    test('About page contains feature documentation', async ({ page }) => {
      await page.goto('/?url=docs/about.md');
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const content = await page.$eval('#wrapper', el => el.textContent);

      expect(content).toContain('Merview');
      // Should document key features
      expect(content).toMatch(/markdown|Markdown/i);
      expect(content).toMatch(/mermaid|Mermaid/i);
    });

    test('Security page documents protection features', async ({ page }) => {
      await page.goto('/?url=docs/security.md');
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const content = await page.$eval('#wrapper', el => el.textContent);

      expect(content).toContain('Security');
      expect(content).toMatch(/XSS|sanitization|DOMPurify/i);
      expect(content).toMatch(/HTTPS|URL|validation/i);
    });

    test('Demo index page lists all demos', async ({ page }) => {
      await page.goto('/?url=docs/demos/index.md');
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const content = await page.$eval('#wrapper', el => el.textContent);

      expect(content).toContain('Feature Demos');
      expect(content).toContain('Code Validation');
      expect(content).toContain('International');
      expect(content).toContain('YAML');
      expect(content).toContain('Error Handling');
    });
  });

  test.describe('Demo Pages Functionality', () => {
    test('Code validation demo shows lint examples', async ({ page }) => {
      await page.goto('/?url=docs/demos/code-validation.md');
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const content = await page.$eval('#wrapper', el => el.textContent);

      expect(content).toContain('Code Validation');
      expect(content).toContain('JSON');
      expect(content).toContain('HTML');
      expect(content).toContain('CSS');
    });

    test('International text demo shows multilingual content', async ({ page }) => {
      await page.goto('/?url=docs/demos/international-text.md');
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const content = await page.$eval('#wrapper', el => el.textContent);

      // Should contain CJK characters
      expect(content).toMatch(/[\u4e00-\u9fff]|[\u3040-\u309f]|[\uac00-\ud7af]/);
      // Should contain RTL indicator or Arabic/Hebrew
      expect(content).toMatch(/[\u0600-\u06ff]|[\u0590-\u05ff]|Arabic|Hebrew/);
    });

    test('YAML front matter demo shows metadata example', async ({ page }) => {
      await page.goto('/?url=docs/demos/yaml-front-matter.md');
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const content = await page.$eval('#wrapper', el => el.textContent);

      expect(content).toContain('YAML');
      expect(content).toContain('Front Matter');
      // Should have metadata-related terms
      expect(content).toMatch(/title|author|date|metadata/i);
    });

    test('Error handling demo documents error types', async ({ page }) => {
      await page.goto('/?url=docs/demos/error-handling.md');
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const content = await page.$eval('#wrapper', el => el.textContent);

      expect(content).toContain('Error');
      expect(content).toMatch(/CORS|network|timeout/i);
    });
  });

  test.describe('Navigation Between Docs', () => {
    test('can navigate from welcome to about via link', async ({ page }) => {
      await page.goto('/?sample');
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      // Find and click a link to about.md
      const aboutLink = await page.$('a[href*="about.md"]');
      if (aboutLink) {
        await aboutLink.click();
        await page.waitForTimeout(WAIT_TIMES.LONG);

        const content = await page.$eval('#wrapper', el => el.textContent);
        expect(content).toContain('Merview');
      }
    });

    test('demo pages have back navigation to welcome', async ({ page }) => {
      await page.goto('/?url=docs/demos/code-validation.md');
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      // Should have a back link
      const backLink = await page.$('a[href*="sample"], a[href="/?sample"]');
      expect(backLink).not.toBeNull();
    });
  });

  test.describe('Mermaid Diagrams in Docs', () => {
    test('security page renders mermaid diagram', async ({ page }) => {
      await page.goto('/?url=docs/security.md');
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      const hasMermaid = await page.evaluate(() => {
        const diagrams = document.querySelectorAll('#wrapper .mermaid svg');
        return diagrams.length > 0;
      });

      expect(hasMermaid).toBe(true);
    });

    test('demo index page renders mermaid diagram', async ({ page }) => {
      await page.goto('/?url=docs/demos/index.md');
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      const hasMermaid = await page.evaluate(() => {
        const diagrams = document.querySelectorAll('#wrapper .mermaid svg');
        return diagrams.length > 0;
      });

      expect(hasMermaid).toBe(true);
    });
  });
});

/**
 * Tests for cross-references between documentation files
 */
test.describe('Documentation Cross-References', () => {
  test('about.md references exist and are valid', async ({ page }) => {
    await page.goto('/?url=docs/about.md');
    await waitForPageReady(page);
    await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

    // Get all internal links on the page
    const links = await page.$$eval('a[href*="/?"]', anchors =>
      anchors.map(a => a.getAttribute('href'))
    );

    // Each linked doc should exist - verify by checking no error modal appears
    for (const link of links) {
      if (link?.startsWith('/?url=docs/')) {
        // Extract the doc path
        const docPath = link.replace('/?url=', '');

        // Navigate and verify it loads (uses baseURL from config)
        await page.goto(`/?url=${docPath}`);
        await page.waitForTimeout(WAIT_TIMES.MEDIUM);

        // Verify content loaded (minimum length check)
        const content = await page.$eval('#wrapper', el => el.textContent.trim());
        expect(content.length).toBeGreaterThan(50);

        // Verify no error modal appeared (actual load failures show modals)
        const errorModal = await page.$('.modal.show');
        expect(errorModal).toBeNull();
      }
    }
  });
});
