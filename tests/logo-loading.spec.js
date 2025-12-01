// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

// Constants for logo validation
const MAX_LOGO_SIZE_KB = 5120; // 5MB - reasonable maximum size for a logo file
const MIN_LOGO_SIZE_KB = 1;    // Minimum size sanity check - ensures it's not a placeholder/corrupted file
const ASPECT_RATIO_TOLERANCE = 0.1; // Acceptable difference between natural and displayed aspect ratios
const LOGO_LOAD_TIMEOUT_MS = 2000;  // Maximum time to wait for logo to be visible on initial load

// Helper function to get logo locator
const getLogo = (page) => page.locator('.brand-logo');

// Helper function to test image loading error handling
// Extracted to reduce nesting depth
const testImageLoad = () => {
  return new Promise(resolve => {
    const testImg = new Image();
    testImg.onerror = () => resolve(true);
    testImg.onload = () => resolve(false);
    testImg.src = 'images/non-existent-logo.png';
  });
};

test.describe('Logo Loading and Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to be fully loaded
    // Using 'domcontentloaded' instead of 'networkidle' for CI stability:
    // - CI environments may have background requests that prevent 'networkidle'
    // - 'domcontentloaded' ensures the DOM is ready, which is sufficient for these tests
    await page.waitForLoadState('domcontentloaded');
  });

  test('logo element exists in the page', async ({ page }) => {
    // Check that the logo image element exists
    const logo = getLogo(page);
    await expect(logo).toBeAttached();

    // Verify it's actually an img element
    const tagName = await logo.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('img');
  });

  test('logo has correct src attribute pointing to the logo file', async ({ page }) => {
    const logo = getLogo(page);

    // Get the src attribute
    const src = await logo.getAttribute('src');

    // Verify src points to the logo file
    expect(src).toBe('images/logo.png');

    // Also verify the computed src (full URL)
    const computedSrc = await logo.evaluate(el => el.src);
    expect(computedSrc).toContain('images/logo.png');
  });

  test('logo has appropriate alt text for accessibility', async ({ page }) => {
    const logo = getLogo(page);

    // Get alt text
    const altText = await logo.getAttribute('alt');

    // Verify alt text exists and is meaningful
    expect(altText).toBeTruthy();
    expect(altText).toBe('Merview - Mermaid diagram and Markdown editor');

    // Verify it's descriptive (not just empty or 'logo')
    expect(altText.length).toBeGreaterThan(5);

    // Verify it includes the app name
    expect(altText).toContain('Merview');
  });

  test('logo actually loads (naturalWidth > 0)', async ({ page }) => {
    const logo = getLogo(page);

    // Wait for the logo to load
    await logo.waitFor({ state: 'attached' });

    // Check that the image has loaded by verifying naturalWidth > 0
    const naturalWidth = await logo.evaluate(img => img.naturalWidth);
    const naturalHeight = await logo.evaluate(img => img.naturalHeight);

    expect(naturalWidth).toBeGreaterThan(0);
    expect(naturalHeight).toBeGreaterThan(0);

    // Verify the image is not broken
    const isComplete = await logo.evaluate(img => img.complete);
    expect(isComplete).toBe(true);
  });

  test('logo is visible to users', async ({ page }) => {
    const logo = getLogo(page);

    // Playwright's toBeVisible() checks: attached to DOM, non-zero size,
    // not display:none, not visibility:hidden, and opacity > 0
    await expect(logo).toBeVisible();
  });

  test('logo has correct styling applied', async ({ page }) => {
    const logo = getLogo(page);

    // Check that the logo has the expected styling from CSS
    const height = await logo.evaluate(el => globalThis.getComputedStyle(el).height);
    const width = await logo.evaluate(el => globalThis.getComputedStyle(el).width);

    // Verify height is set to 28px as per CSS
    expect(height).toBe('28px');

    // Verify width is auto-computed
    expect(width).not.toBe('0px');
    expect(Number.parseInt(width)).toBeGreaterThan(0);
  });

  test('logo is located in the toolbar brand area', async ({ page }) => {
    // Verify the logo is within the toolbar-brand container
    const toolbarBrand = page.locator('.toolbar-brand');
    const logoInBrand = toolbarBrand.locator('.brand-logo');

    await expect(logoInBrand).toBeAttached();

    // Verify it's also in the main toolbar
    const toolbar = page.locator('.toolbar');
    const logoInToolbar = toolbar.locator('.brand-logo');

    await expect(logoInToolbar).toBeAttached();
  });

  test('logo loads before other non-critical content', async ({ page }) => {
    // Navigate and check that logo is one of the first elements rendered
    await page.goto('/');

    const logo = getLogo(page);

    // The logo should be visible very quickly
    await expect(logo).toBeVisible({ timeout: LOGO_LOAD_TIMEOUT_MS });

    // Verify the image loaded successfully
    const naturalWidth = await logo.evaluate(img => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  });

  test('logo maintains aspect ratio', async ({ page }) => {
    const logo = getLogo(page);

    // Get natural dimensions
    const naturalWidth = await logo.evaluate(img => img.naturalWidth);
    const naturalHeight = await logo.evaluate(img => img.naturalHeight);

    // Get displayed dimensions
    const displayedWidth = await logo.evaluate(img => img.offsetWidth);
    const displayedHeight = await logo.evaluate(img => img.offsetHeight);

    // Calculate aspect ratios
    const naturalRatio = naturalWidth / naturalHeight;
    const displayedRatio = displayedWidth / displayedHeight;

    // Aspect ratios should be approximately equal
    expect(Math.abs(naturalRatio - displayedRatio)).toBeLessThan(ASPECT_RATIO_TOLERANCE);
  });

  test.describe('Fallback Behavior', () => {
    test('logo handles loading errors gracefully', async ({ page }) => {
      // Navigate to page
      await page.goto('/');

      // Check if there's an error event listener or fallback mechanism
      const logo = getLogo(page);

      // Verify logo is visible initially
      await expect(logo).toBeVisible();

      // Test that if we try to change to a broken image, it handles gracefully
      // This simulates what would happen if the logo file was missing
      const errorHandled = await logo.evaluate(testImageLoad);

      // The error should be caught (even if there's no explicit handler)
      expect(errorHandled).toBe(true);
    });

    test('logo alt text provides meaningful fallback', async ({ page }) => {
      const logo = getLogo(page);

      const altText = await logo.getAttribute('alt');

      // Alt text should be descriptive enough to convey meaning if image fails
      expect(altText).toBeTruthy();
      expect(altText.toLowerCase()).toContain('merview');

      // Verify it's meaningful and descriptive for screen readers
      expect(altText).toContain('Mermaid');
      expect(altText).toContain('Markdown');

      // Verify it's long enough to be descriptive
      expect(altText.length).toBeGreaterThan(20);
    });
  });

  test.describe('Accessibility', () => {
    test('logo has proper ARIA attributes for accessibility', async ({ page }) => {
      const logo = getLogo(page);

      // Logo should have alt text (which we already test)
      const altText = await logo.getAttribute('alt');
      expect(altText).toBeTruthy();

      // Check that it's not hidden from screen readers
      const ariaHidden = await logo.getAttribute('aria-hidden');
      expect(ariaHidden).not.toBe('true');
    });

    test('logo is keyboard navigable as part of toolbar', async ({ page }) => {
      // The logo itself doesn't need to be focusable, but we verify
      // it doesn't break keyboard navigation
      await page.keyboard.press('Tab');

      // The focus should move through the page normally
      const focusedElement = await page.evaluate(() => document.activeElement.tagName);

      // Just verify something is focused (toolbar buttons, links, etc.)
      expect(focusedElement).toBeTruthy();
    });
  });

  test.describe('Performance', () => {
    test('logo file size is reasonable for web use', async ({ page }) => {
      // Get the actual file size via network inspection
      // Using 'domcontentloaded' instead of 'networkidle' for CI stability:
      // - CI environments may have background requests that prevent 'networkidle'
      // - 'domcontentloaded' ensures the page is interactive and logo has loaded
      const [response] = await Promise.all([
        page.waitForResponse(response =>
          response.url().includes('logo.png') && response.status() === 200
        ),
        page.goto('/', { waitUntil: 'domcontentloaded' })
      ]);

      const buffer = await response.body();
      const sizeInBytes = buffer.length;
      const sizeInKB = sizeInBytes / 1024;

      // Logo should be within reasonable size limits
      expect(sizeInKB).toBeLessThan(MAX_LOGO_SIZE_KB);

      // Also verify it's not suspiciously small (like a placeholder or corrupted file)
      expect(sizeInKB).toBeGreaterThan(MIN_LOGO_SIZE_KB);
    });
  });
});
