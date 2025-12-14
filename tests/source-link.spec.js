// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Helper to get computed style property
 * Moved to module scope for better performance
 */
async function getComputedStyle(locator, property) {
  return await locator.evaluate((el, prop) => {
    return globalThis.getComputedStyle(el)[prop];
  }, property);
}

/**
 * Helper to get multiple computed style properties
 * Moved to module scope for better performance
 */
async function getComputedStyles(locator, properties) {
  return await locator.evaluate((el, props) => {
    const styles = globalThis.getComputedStyle(el);
    return props.reduce((acc, prop) => {
      acc[prop] = styles[prop];
      return acc;
    }, {});
  }, properties);
}

/**
 * Tests for source link functionality (Issue #26)
 *
 * AGPL-3.0 Section 13 requires that source code be made available
 * to users interacting with the software over a network. This test
 * suite verifies that the GitHub source link is properly visible,
 * accessible, and configured with correct security attributes.
 */
test.describe('Source Link Functionality (AGPL-3.0 Compliance)', () => {
  const EXPECTED_URL = 'https://github.com/mickdarling/merview';

  // Shared locators and helpers
  let sourceLink;
  let sourceLabel;
  let toolbar;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Initialize shared locators
    sourceLink = page.locator('.github-link');
    sourceLabel = page.locator('.github-label');
    toolbar = page.locator('.toolbar');
  });

  test.describe('Visibility and Presence', () => {
    test('should have a visible GitHub source link in the toolbar', async () => {
      await expect(sourceLink).toBeVisible();
      await expect(toolbar).toContainText('Source');
    });

    test('should display "Source" label text', async () => {
      await expect(sourceLabel).toBeVisible();
      await expect(sourceLabel).toHaveText('Source');
    });

    test('should include GitHub icon SVG', async () => {
      const svg = sourceLink.locator('svg');
      await expect(svg).toBeVisible();
      await expect(svg).toHaveAttribute('height', '16');
      await expect(svg).toHaveAttribute('width', '16');
    });
  });

  test.describe('Link Target and URL', () => {
    test('should point to correct GitHub repository URL', async () => {
      await expect(sourceLink).toHaveAttribute('href', EXPECTED_URL);
    });

    test('should open in new tab (target="_blank")', async () => {
      await expect(sourceLink).toHaveAttribute('target', '_blank');
    });
  });

  test.describe('Security Attributes', () => {
    test('should have proper security rel attribute (noopener)', async () => {
      const relValue = await sourceLink.getAttribute('rel');
      expect(relValue).toContain('noopener');
    });

    test('should prevent window.opener access with noopener', async () => {
      const relValue = await sourceLink.getAttribute('rel');
      expect(relValue).toMatch(/noopener/);
    });

    test('should ideally include noreferrer for privacy', async () => {
      const relValue = await sourceLink.getAttribute('rel');
      if (relValue) {
        expect(['noopener', 'noopener noreferrer', 'noreferrer noopener']).toContain(relValue);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible title attribute', async () => {
      const titleValue = await sourceLink.getAttribute('title');
      expect(titleValue).toBeTruthy();
      expect(titleValue).toContain('GitHub');
    });

    test('should have descriptive title mentioning AGPL-3.0', async () => {
      const titleValue = await sourceLink.getAttribute('title');
      expect(titleValue).toContain('AGPL');
    });

    test('should be keyboard accessible', async () => {
      await sourceLink.focus();
      await expect(sourceLink).toBeFocused();
    });

    test('should have visible focus indicator', async ({ page }) => {
      await sourceLink.focus();
      const hasFocus = await page.evaluate(() => {
        const link = document.querySelector('.github-link');
        return document.activeElement === link;
      });
      expect(hasFocus).toBe(true);
    });
  });

  test.describe('AGPL-3.0 Section 13 Compliance', () => {
    test('should provide source code access as required by AGPL-3.0', async () => {
      await expect(sourceLink).toBeVisible();
      await expect(sourceLink).toHaveAttribute('href', EXPECTED_URL);
      const titleValue = await sourceLink.getAttribute('title');
      expect(titleValue).toContain('AGPL');
    });

    test('should make source link prominent and easy to find', async () => {
      const isInToolbar = await toolbar.locator('.github-link').count() > 0;
      expect(isInToolbar).toBe(true);
      const isInViewport = await sourceLink.isVisible();
      expect(isInViewport).toBe(true);
    });

    test('should have HTML comment with source code URL', async ({ page }) => {
      const htmlContent = await page.content();
      expect(htmlContent).toContain(EXPECTED_URL);
      expect(htmlContent).toContain('AGPL');
    });
  });

  test.describe('Visual Styling and UX', () => {
    test('should have hover effect for better UX', async ({ page }) => {
      const initialColor = await getComputedStyle(sourceLink, 'color');
      await sourceLink.hover();
      await page.waitForTimeout(250);
      const hoverColor = await getComputedStyle(sourceLink, 'color');
      expect(initialColor).toBeTruthy();
      expect(hoverColor).toBeTruthy();
    });

    test('should be styled consistently with toolbar', async () => {
      const display = await getComputedStyle(sourceLink, 'display');
      expect(display).toBe('flex');
    });

    test('should have proper spacing and padding', async () => {
      const padding = await getComputedStyles(sourceLink, [
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'
      ]);
      expect(padding.paddingTop).not.toBe('0px');
      expect(padding.paddingLeft).not.toBe('0px');
    });
  });

  test.describe('Integration with Application', () => {
    test('should not interfere with other toolbar functionality', async ({ page }) => {
      const documentSelector = page.locator('#documentSelector');
      const clearBtn = page.locator('button[onclick="clearEditor()"]');
      await expect(sourceLink).toBeVisible();
      await expect(documentSelector).toBeVisible();
      await expect(clearBtn).toBeVisible();
    });

    test('should remain visible after page interactions', async ({ page }) => {
      await page.click('button[onclick="loadWelcomePage()"]');
      await page.waitForTimeout(500);
      await expect(sourceLink).toBeVisible();

      await page.click('button[onclick="toggleLintPanel()"]');
      await page.waitForTimeout(100);
      await expect(sourceLink).toBeVisible();
    });

    test('should be present immediately on page load', async ({ page }) => {
      await page.goto('/');
      const freshSourceLink = page.locator('.github-link');
      await expect(freshSourceLink).toBeVisible({ timeout: 1000 });
    });
  });

  test.describe('Link Behavior', () => {
    test('should have correct link type (external link)', async () => {
      const href = await sourceLink.getAttribute('href');
      expect(href).toMatch(/^https:\/\//);
    });

    test('should point to a valid GitHub repository', async () => {
      const href = await sourceLink.getAttribute('href');
      expect(href).toMatch(/^https:\/\/github\.com\/[\w-]+\/[\w-]+$/);
    });

    test('should not have any javascript: or data: URI (security)', async () => {
      const href = await sourceLink.getAttribute('href');
      expect(href).not.toMatch(/^javascript:/);
      expect(href).not.toMatch(/^data:/);
    });
  });

  test.describe('Content Security Policy Compliance', () => {
    test('should be allowed by CSP connect-src directive', async ({ page }) => {
      const href = await sourceLink.getAttribute('href');
      expect(href).toContain('github.com');

      const cspErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
          cspErrors.push(msg.text());
        }
      });

      await expect(sourceLink).toBeVisible();
      expect(cspErrors.length).toBe(0);
    });
  });
});
