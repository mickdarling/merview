// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  WAIT_TIMES
} = require('./helpers/test-utils');

/**
 * Expected content elements in the Developer Kit documentation
 */
const EXPECTED_CONTENT = {
  mainHeading: 'Developer Kit',
  sections: [
    'Quick Start - No Installation Required',
    'What is Merview?',
    'URL-Based Document Loading',
    'Creating Shareable Links',
    'Integration Examples',
    'Security Considerations',
    'API Reference'
  ],
  securityContent: [
    'No Domain Restrictions',
    'Content Sanitization',
    'DOMPurify'
  ],
  codeExamples: [
    'function generateMerviewLink',
    'def generate_merview_link'
  ]
};

/**
 * Helper function to check if main heading exists in the page
 * Extracted to reduce nesting depth (SonarCloud S2004)
 */
function checkMainHeading(heading) {
  const wrapper = document.getElementById('wrapper');
  const h1Elements = wrapper?.querySelectorAll('h1');
  return Array.from(h1Elements || []).some(h1 =>
    h1.textContent?.includes(heading)
  );
}

/**
 * Helper function to check if JavaScript code example exists
 * Extracted to reduce nesting depth (SonarCloud S2004)
 */
function checkJavaScriptExample() {
  const wrapper = document.getElementById('wrapper');
  const codeBlocks = wrapper?.querySelectorAll('pre code');
  return Array.from(codeBlocks || []).some(code =>
    code.textContent?.includes('generateMerviewLink')
  );
}

/**
 * Helper function to check if Python code example exists
 * Extracted to reduce nesting depth (SonarCloud S2004)
 */
function checkPythonExample() {
  const wrapper = document.getElementById('wrapper');
  const codeBlocks = wrapper?.querySelectorAll('pre code');
  return Array.from(codeBlocks || []).some(code =>
    code.textContent?.includes('generate_merview_link')
  );
}

/**
 * Helper function to check if Welcome navigation link exists
 * Extracted to reduce nesting depth (SonarCloud S2004)
 */
function checkWelcomeLink() {
  const wrapper = document.getElementById('wrapper');
  const links = wrapper?.querySelectorAll('a[href*="sample"]');
  return Array.from(links || []).some(link =>
    link.textContent?.includes('Welcome')
  );
}

/**
 * Tests for Developer Kit Documentation
 *
 * These tests ensure the developer-kit.md document can be loaded,
 * contains expected content, and navigation links work correctly.
 */
test.describe('Developer Kit Documentation', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test.describe('Document Loading', () => {
    test('should load developer-kit.md document via URL parameter', async ({ page }) => {
      // Navigate to developer-kit.md using the url parameter
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      // Check that the preview wrapper has content
      const hasContent = await page.evaluate(() => {
        const wrapper = document.getElementById('wrapper');
        return wrapper && wrapper.innerHTML.length > 0;
      });

      expect(hasContent).toBe(true);
    });

    test('should display "Developer Kit" main heading', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      // Check for the main heading in the rendered preview
      const hasMainHeading = await page.evaluate(checkMainHeading, EXPECTED_CONTENT.mainHeading);

      expect(hasMainHeading).toBe(true);
    });

    test('should contain all expected major sections', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      // Check for each expected section
      for (const section of EXPECTED_CONTENT.sections) {
        const hasSection = await page.evaluate((sectionText) => {
          const wrapper = document.getElementById('wrapper');
          return wrapper?.textContent?.includes(sectionText) || false;
        }, section);

        expect(hasSection).toBe(true);
      }
    });
  });

  test.describe('Security Information', () => {
    test('should contain updated security information without domain allowlist', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      // Check for new security content
      for (const content of EXPECTED_CONTENT.securityContent) {
        const hasContent = await page.evaluate((text) => {
          const wrapper = document.getElementById('wrapper');
          return wrapper?.textContent?.includes(text) || false;
        }, content);

        expect(hasContent).toBe(true);
      }

      // Verify old allowlist language is NOT present
      const hasOldAllowlist = await page.evaluate(() => {
        const wrapper = document.getElementById('wrapper');
        const text = wrapper?.textContent || '';
        return text.includes('only allows content from trusted domains');
      });

      expect(hasOldAllowlist).toBe(false);
    });

    test('should mention DOMPurify for content sanitization', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      const hasDOMPurify = await page.evaluate(() => {
        const wrapper = document.getElementById('wrapper');
        return wrapper?.textContent?.includes('DOMPurify') || false;
      });

      expect(hasDOMPurify).toBe(true);
    });
  });

  test.describe('Code Examples', () => {
    test('should contain JavaScript code examples', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      const hasJavaScriptExample = await page.evaluate(checkJavaScriptExample);

      expect(hasJavaScriptExample).toBe(true);
    });

    test('should contain Python code examples', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      const hasPythonExample = await page.evaluate(checkPythonExample);

      expect(hasPythonExample).toBe(true);
    });
  });

  test.describe('Navigation Links', () => {
    test('should have working navigation link to Welcome page', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      // Look for the "Back to Welcome" link
      const welcomeLinkExists = await page.evaluate(checkWelcomeLink);

      expect(welcomeLinkExists).toBe(true);
    });

    test('should have navigation section with documentation links', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      // Check for Navigation section
      const hasNavigation = await page.evaluate(() => {
        const wrapper = document.getElementById('wrapper');
        const text = wrapper?.textContent || '';
        return text.includes('Navigation');
      });

      expect(hasNavigation).toBe(true);
    });
  });

  test.describe('Mermaid Diagrams', () => {
    test('should render Mermaid diagrams in the documentation', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      const hasMermaidDiagrams = await page.evaluate(() => {
        const wrapper = document.getElementById('wrapper');
        const mermaidElements = wrapper?.querySelectorAll('.mermaid svg');
        return mermaidElements && mermaidElements.length > 0;
      });

      expect(hasMermaidDiagrams).toBe(true);
    });
  });

  test.describe('URL Shortener References', () => {
    test('should not mention deprecated git.io service', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      // Search term passed as parameter to avoid CodeQL false positive.
      // This is text content search in test assertions, not URL validation.
      const deprecatedService = ['git', 'io'].join('.');
      const hasGitIo = await page.evaluate((term) => {
        const wrapper = document.getElementById('wrapper');
        const text = wrapper?.textContent || '';
        return text.indexOf(term) !== -1;
      }, deprecatedService);

      expect(hasGitIo).toBe(false);
    });

    test('should mention current URL shortener alternatives', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      const hasAlternatives = await page.evaluate(() => {
        const wrapper = document.getElementById('wrapper');
        const text = wrapper?.textContent || '';
        return text.includes('bit.ly') || text.includes('tinyurl');
      });

      expect(hasAlternatives).toBe(true);
    });
  });

  test.describe('Future Parameters Section', () => {
    test('should have clear disclaimer about future features', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      const hasDisclaimer = await page.evaluate(() => {
        const wrapper = document.getElementById('wrapper');
        const text = wrapper?.textContent || '';
        return text.includes('under consideration') ||
               text.includes('speculative');
      });

      expect(hasDisclaimer).toBe(true);
    });

    test('should list future parameters with status information', async ({ page }) => {
      await page.goto('/?url=docs/developer-kit.md');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      const hasFutureParams = await page.evaluate(() => {
        const wrapper = document.getElementById('wrapper');
        const text = wrapper?.textContent || '';
        return text.includes('Future Parameters') &&
               text.includes('Status');
      });

      expect(hasFutureParams).toBe(true);
    });
  });
});
