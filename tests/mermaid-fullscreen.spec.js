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
});
