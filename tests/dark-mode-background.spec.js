// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Helper to wait for preview background to change to a dark color (RGB values < 50)
 */
async function waitForDarkBackground(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#preview');
    if (!el) return false;
    const bg = globalThis.getComputedStyle(el).backgroundColor;
    const match = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(bg);
    if (!match) return false;
    return Math.max(Number(match[1]), Number(match[2]), Number(match[3])) < 50;
  }, { timeout: 2000 });
}

/**
 * Helper to wait for preview background to change to a light color (RGB values > 240)
 */
async function waitForLightBackground(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#preview');
    if (!el) return false;
    const bg = globalThis.getComputedStyle(el).backgroundColor;
    const match = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(bg);
    if (!match) return false;
    return Math.min(Number(match[1]), Number(match[2]), Number(match[3])) > 240;
  }, { timeout: 2000 });
}

test.describe('Dark Mode Preview Background', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should apply dark background when Dark Mode style is selected', async ({ page }) => {
    // Get the preview element
    const preview = page.locator('#preview');

    // Get initial background (should be white/light)
    const initialBg = await preview.evaluate(el => globalThis.getComputedStyle(el).backgroundColor);
    console.log('Initial background:', initialBg);

    // Select Dark Mode style
    await page.selectOption('#styleSelector', 'Dark Mode');

    // Wait for dark background to be applied
    await waitForDarkBackground(page);

    // Get the new background color
    const darkBg = await preview.evaluate(el => globalThis.getComputedStyle(el).backgroundColor);
    console.log('Dark mode background:', darkBg);

    // Dark mode should have a dark background (rgb values should be low)
    const match = darkBg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    expect(match).toBeTruthy();
    expect(Math.max(Number(match[1]), Number(match[2]), Number(match[3]))).toBeLessThan(50);
  });

  test('should apply light background when switching from Dark Mode to another style', async ({ page }) => {
    // First select Dark Mode
    await page.selectOption('#styleSelector', 'Dark Mode');
    await waitForDarkBackground(page);

    const preview = page.locator('#preview');

    // Verify dark background is applied
    const darkBg = await preview.evaluate(el => globalThis.getComputedStyle(el).backgroundColor);
    const darkMatch = darkBg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    expect(darkMatch).toBeTruthy();
    expect(Math.max(Number(darkMatch[1]), Number(darkMatch[2]), Number(darkMatch[3]))).toBeLessThan(50);

    // Switch to Clean style
    await page.selectOption('#styleSelector', 'Clean');
    await waitForLightBackground(page);

    // Verify light background
    const lightBg = await preview.evaluate(el => globalThis.getComputedStyle(el).backgroundColor);
    console.log('Clean style background:', lightBg);

    // Clean style should have white background
    const lightMatch = lightBg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    expect(lightMatch).toBeTruthy();
    expect(Math.min(Number(lightMatch[1]), Number(lightMatch[2]), Number(lightMatch[3]))).toBeGreaterThan(240);
  });

  test('wrapper element should also have dark background', async ({ page }) => {
    // Select Dark Mode
    await page.selectOption('#styleSelector', 'Dark Mode');
    await waitForDarkBackground(page);

    const wrapper = page.locator('#wrapper');
    const wrapperBg = await wrapper.evaluate(el => globalThis.getComputedStyle(el).backgroundColor);
    console.log('Wrapper background:', wrapperBg);

    // Wrapper should also have dark background
    const match = wrapperBg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    expect(match).toBeTruthy();
    expect(Math.max(Number(match[1]), Number(match[2]), Number(match[3]))).toBeLessThan(50);
  });

  test('wrapper should fill full width without artificial gutters', async ({ page }) => {
    // Select Dark Mode (which has max-width: 850px in its CSS)
    await page.selectOption('#styleSelector', 'Dark Mode');
    await waitForDarkBackground(page);

    const wrapper = page.locator('#wrapper');
    const preview = page.locator('#preview');

    // Get wrapper and preview widths
    const wrapperWidth = await wrapper.evaluate(el => el.getBoundingClientRect().width);
    const previewWidth = await preview.evaluate(el => el.getBoundingClientRect().width);

    console.log('Wrapper width:', wrapperWidth, 'Preview width:', previewWidth);

    // Wrapper should fill the preview width (minus padding)
    // The base CSS sets padding: 20px, so wrapper content area should be close to preview width
    // We check that wrapper is NOT artificially constrained (e.g., to 850px max-width from loaded style)
    const wrapperStyle = await wrapper.evaluate(el => ({
      maxWidth: globalThis.getComputedStyle(el).maxWidth,
      margin: globalThis.getComputedStyle(el).margin,
      width: globalThis.getComputedStyle(el).width
    }));

    console.log('Wrapper computed styles:', wrapperStyle);

    // max-width should be 'none' (not constrained by loaded style's 850px)
    expect(wrapperStyle.maxWidth).toBe('none');

    // margin should be 0px (not centered with auto margins)
    expect(wrapperStyle.margin).toBe('0px');
  });

  test('text should be readable in Dark Mode', async ({ page }) => {
    // Select Dark Mode
    await page.selectOption('#styleSelector', 'Dark Mode');
    await waitForDarkBackground(page);

    const wrapper = page.locator('#wrapper');
    const textColor = await wrapper.evaluate(el => globalThis.getComputedStyle(el).color);
    console.log('Text color in dark mode:', textColor);

    // Text should be light colored - parse RGB values and verify they are high (light)
    const rgbMatch = textColor.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    expect(rgbMatch).toBeTruthy();

    const r = Number.parseInt(rgbMatch[1], 10);
    const g = Number.parseInt(rgbMatch[2], 10);
    const b = Number.parseInt(rgbMatch[3], 10);

    // Light text should have RGB values > 200
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(200);
    expect(b).toBeGreaterThan(200);
  });

  test('should fall back to white background when CSS has no #wrapper background', async ({ page }) => {
    // Create a minimal CSS without any background defined for #wrapper
    const cssWithoutBackground = `
      #wrapper {
        color: #333;
        font-family: Arial, sans-serif;
        padding: 20px;
      }
    `;

    // Inject the CSS and call applyPreviewBackground
    await page.evaluate((css) => {
      const previewEl = document.querySelector('#preview');
      if (previewEl) {
        // Reset any existing background
        previewEl.style.background = '';
        // Call applyPreviewBackground with CSS that has no background
        globalThis.applyPreviewBackground(css);
      }
    }, cssWithoutBackground);

    const preview = page.locator('#preview');
    const previewBg = await preview.evaluate(el => globalThis.getComputedStyle(el).backgroundColor);
    console.log('Preview background with no CSS background:', previewBg);

    // Should fall back to white (rgb(255, 255, 255))
    const match = previewBg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    expect(match).toBeTruthy();
    expect(Number(match[1])).toBe(255);
    expect(Number(match[2])).toBe(255);
    expect(Number(match[3])).toBe(255);
  });

  test('should handle both background and background-color CSS properties', async ({ page }) => {
    const preview = page.locator('#preview');

    // Test 1: CSS using background property
    const cssWithBackground = `
      #wrapper {
        background: #2a2a2a;
        color: #fff;
      }
    `;

    await page.evaluate((css) => {
      const previewEl = document.querySelector('#preview');
      if (previewEl) {
        previewEl.style.background = '';
        globalThis.applyPreviewBackground(css);
      }
    }, cssWithBackground);

    let bgColor = await preview.evaluate(el => globalThis.getComputedStyle(el).backgroundColor);
    console.log('Background from "background" property:', bgColor);

    // Should apply dark background
    let match = bgColor.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    expect(match).toBeTruthy();
    expect(Math.max(Number(match[1]), Number(match[2]), Number(match[3]))).toBeLessThan(50);

    // Test 2: CSS using background-color property
    const cssWithBackgroundColor = `
      #wrapper {
        background-color: #1e1e1e;
        color: #fff;
      }
    `;

    await page.evaluate((css) => {
      const previewEl = document.querySelector('#preview');
      if (previewEl) {
        previewEl.style.background = '';
        globalThis.applyPreviewBackground(css);
      }
    }, cssWithBackgroundColor);

    bgColor = await preview.evaluate(el => globalThis.getComputedStyle(el).backgroundColor);
    console.log('Background from "background-color" property:', bgColor);

    // Should also apply dark background
    match = bgColor.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    expect(match).toBeTruthy();
    expect(Math.max(Number(match[1]), Number(match[2]), Number(match[3]))).toBeLessThan(50);
  });
});
