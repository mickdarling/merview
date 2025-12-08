// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  waitForGlobalFunction,
  isGlobalFunctionAvailable,
  setCodeMirrorContent,
  renderMarkdownAndWait,
  WAIT_TIMES
} = require('./helpers/test-utils');

/**
 * Tests for Mermaid Fullscreen and Zoom functionality
 *
 * These tests ensure the mermaid diagram expand button, fullscreen overlay,
 * and zoom controls work correctly. This prevents regressions in the
 * mermaid-fullscreen.js module functionality.
 */
test.describe('Mermaid Fullscreen and Zoom', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
    await waitForGlobalFunction(page, 'openFile');
  });

  // Data-driven tests for global function availability
  const mermaidFunctions = [
    'expandMermaid',
    'closeMermaidFullscreen',
    'mermaidZoomIn',
    'mermaidZoomOut',
    'mermaidZoomReset'
  ];

  for (const fnName of mermaidFunctions) {
    test(`${fnName} function should be globally available`, async ({ page }) => {
      expect(await isGlobalFunctionAvailable(page, fnName)).toBe(true);
    });
  }

  test.describe('Mermaid expand interactions', () => {
    const mermaidDiagram = '```mermaid\ngraph TD\nA[Start] --> B[End]\n```';

    test('double-click on mermaid diagram opens fullscreen', async ({ page }) => {
      // Render a mermaid diagram
      await setCodeMirrorContent(page, mermaidDiagram);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

      // Wait for mermaid to render the SVG
      const mermaidEl = page.locator('.mermaid');
      await expect(mermaidEl.locator('svg')).toBeVisible({ timeout: 10000 });

      // Double-click on the mermaid diagram
      await mermaidEl.dblclick();

      // Verify fullscreen overlay appears
      await expect(page.locator('#mermaid-fullscreen-overlay')).toBeVisible({ timeout: 5000 });
    });

    test('expand button click opens fullscreen', async ({ page }) => {
      // Render a mermaid diagram
      await setCodeMirrorContent(page, mermaidDiagram);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

      // Wait for mermaid to render the SVG
      await expect(page.locator('.mermaid svg')).toBeVisible({ timeout: 10000 });

      // Click the expand button
      await page.locator('.mermaid-expand-btn').click();

      // Verify fullscreen overlay appears
      await expect(page.locator('#mermaid-fullscreen-overlay')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Fullscreen background colors', () => {
    const mermaidDiagram = '```mermaid\ngraph TD\nA[Start] --> B[End]\n```';

    test('fullscreen overlay uses dark background when Mermaid theme is "dark"', async ({ page }) => {
      // Set Mermaid theme to dark
      await page.evaluate(() => {
        globalThis.state.mermaidTheme = 'dark';
      });

      // Render a mermaid diagram
      await setCodeMirrorContent(page, mermaidDiagram);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

      // Wait for mermaid to render the SVG
      await expect(page.locator('.mermaid svg')).toBeVisible({ timeout: 10000 });

      // Open fullscreen
      await page.locator('.mermaid-expand-btn').click();
      await expect(page.locator('#mermaid-fullscreen-overlay')).toBeVisible({ timeout: 5000 });

      // Get background color of fullscreen overlay
      const bgColor = await page.$eval('#mermaid-fullscreen-overlay', el => {
        return globalThis.getComputedStyle(el).backgroundColor;
      });

      // Verify dark background color (rgba(30, 30, 30, 0.98))
      expect(bgColor).toBe('rgba(30, 30, 30, 0.98)');
    });

    test('fullscreen overlay uses light background when Mermaid theme is "default"', async ({ page }) => {
      // Set Mermaid theme to default
      await page.evaluate(() => {
        globalThis.state.mermaidTheme = 'default';
      });

      // Render a mermaid diagram
      await setCodeMirrorContent(page, mermaidDiagram);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

      // Wait for mermaid to render the SVG
      await expect(page.locator('.mermaid svg')).toBeVisible({ timeout: 10000 });

      // Open fullscreen
      await page.locator('.mermaid-expand-btn').click();
      await expect(page.locator('#mermaid-fullscreen-overlay')).toBeVisible({ timeout: 5000 });

      // Get background color of fullscreen overlay
      const bgColor = await page.$eval('#mermaid-fullscreen-overlay', el => {
        return globalThis.getComputedStyle(el).backgroundColor;
      });

      // Verify light background color (rgba(255, 255, 255, 0.98))
      expect(bgColor).toBe('rgba(255, 255, 255, 0.98)');
    });

    test('fullscreen overlay uses light background when Mermaid theme is "forest"', async ({ page }) => {
      // Set Mermaid theme to forest
      await page.evaluate(() => {
        globalThis.state.mermaidTheme = 'forest';
      });

      // Render a mermaid diagram
      await setCodeMirrorContent(page, mermaidDiagram);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

      // Wait for mermaid to render the SVG
      await expect(page.locator('.mermaid svg')).toBeVisible({ timeout: 10000 });

      // Open fullscreen
      await page.locator('.mermaid-expand-btn').click();
      await expect(page.locator('#mermaid-fullscreen-overlay')).toBeVisible({ timeout: 5000 });

      // Get background color of fullscreen overlay
      const bgColor = await page.$eval('#mermaid-fullscreen-overlay', el => {
        return globalThis.getComputedStyle(el).backgroundColor;
      });

      // Verify light background color (rgba(255, 255, 255, 0.98))
      expect(bgColor).toBe('rgba(255, 255, 255, 0.98)');
    });

    test('fullscreen overlay uses light background when Mermaid theme is "neutral"', async ({ page }) => {
      // Set Mermaid theme to neutral
      await page.evaluate(() => {
        globalThis.state.mermaidTheme = 'neutral';
      });

      // Render a mermaid diagram
      await setCodeMirrorContent(page, mermaidDiagram);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

      // Wait for mermaid to render the SVG
      await expect(page.locator('.mermaid svg')).toBeVisible({ timeout: 10000 });

      // Open fullscreen
      await page.locator('.mermaid-expand-btn').click();
      await expect(page.locator('#mermaid-fullscreen-overlay')).toBeVisible({ timeout: 5000 });

      // Get background color of fullscreen overlay
      const bgColor = await page.$eval('#mermaid-fullscreen-overlay', el => {
        return globalThis.getComputedStyle(el).backgroundColor;
      });

      // Verify light background color (rgba(255, 255, 255, 0.98))
      expect(bgColor).toBe('rgba(255, 255, 255, 0.98)');
    });

    test('fullscreen overlay uses light background when Mermaid theme is "base"', async ({ page }) => {
      // Set Mermaid theme to base
      await page.evaluate(() => {
        globalThis.state.mermaidTheme = 'base';
      });

      // Render a mermaid diagram
      await setCodeMirrorContent(page, mermaidDiagram);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

      // Wait for mermaid to render the SVG
      await expect(page.locator('.mermaid svg')).toBeVisible({ timeout: 10000 });

      // Open fullscreen
      await page.locator('.mermaid-expand-btn').click();
      await expect(page.locator('#mermaid-fullscreen-overlay')).toBeVisible({ timeout: 5000 });

      // Get background color of fullscreen overlay
      const bgColor = await page.$eval('#mermaid-fullscreen-overlay', el => {
        return globalThis.getComputedStyle(el).backgroundColor;
      });

      // Verify light background color (rgba(255, 255, 255, 0.98))
      expect(bgColor).toBe('rgba(255, 255, 255, 0.98)');
    });
  });
});
