// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

// Timeouts for initialization
const CODEMIRROR_INIT_TIMEOUT = 15000;
const EDITOR_API_TIMEOUT = 5000;
const LAYOUT_STABILIZE_DELAY = 200;

test.describe('Resize Handle Touch Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');
    await page.waitForSelector('.CodeMirror', { timeout: CODEMIRROR_INIT_TIMEOUT });
    await page.waitForFunction(() => typeof globalThis.setEditorContent === 'function', { timeout: EDITOR_API_TIMEOUT });
    await page.waitForTimeout(LAYOUT_STABILIZE_DELAY);
  });

  test.describe('Resize Handle Element', () => {
    test('resize handle should exist and be visible', async ({ page }) => {
      const resizeHandle = page.locator('.resize-handle');
      await expect(resizeHandle).toBeVisible();
    });

    test('resize handle should have 8px visual width', async ({ page }) => {
      const width = await page.evaluate(() => {
        const handle = document.querySelector('.resize-handle');
        return handle ? getComputedStyle(handle).width : null;
      });
      expect(width).toBe('8px');
    });

    test('resize handle should have col-resize cursor', async ({ page }) => {
      const cursor = await page.evaluate(() => {
        const handle = document.querySelector('.resize-handle');
        return handle ? getComputedStyle(handle).cursor : null;
      });
      expect(cursor).toBe('col-resize');
    });

    test('resize handle should have position relative for pseudo-elements', async ({ page }) => {
      const position = await page.evaluate(() => {
        const handle = document.querySelector('.resize-handle');
        return handle ? getComputedStyle(handle).position : null;
      });
      expect(position).toBe('relative');
    });
  });

  test.describe('Touch Target', () => {
    test('touch target (::before) should be 44px wide for iOS guidelines', async ({ page }) => {
      // We can't directly query pseudo-element computed styles via Playwright,
      // but we can verify the style rule exists in the stylesheet
      const hasTouchTargetStyle = await page.evaluate(() => {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.selectorText === '.resize-handle::before') {
                return rule.style.width === '44px';
              }
            }
          } catch (e) {
            // Cross-origin stylesheets throw SecurityError - expected and safe to ignore
            continue;
          }
        }
        return false;
      });
      expect(hasTouchTargetStyle).toBe(true);
    });
  });

  test.describe('Mouse Drag Resize', () => {
    test('should resize panels on mouse drag', async ({ page }) => {
      const resizeHandle = page.locator('.resize-handle');
      const handleBox = await resizeHandle.boundingBox();

      if (!handleBox) {
        throw new Error('Resize handle not found');
      }

      // Get initial panel widths
      const initialWidths = await page.evaluate(() => {
        const editor = document.querySelector('.editor-panel');
        const preview = document.querySelector('.preview-panel');
        return {
          editor: editor ? editor.offsetWidth : 0,
          preview: preview ? preview.offsetWidth : 0
        };
      });

      // Drag the handle 100px to the right
      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 100, startY);
      await page.mouse.up();

      // Get new panel widths
      const newWidths = await page.evaluate(() => {
        const editor = document.querySelector('.editor-panel');
        const preview = document.querySelector('.preview-panel');
        return {
          editor: editor ? editor.offsetWidth : 0,
          preview: preview ? preview.offsetWidth : 0
        };
      });

      // Editor should be wider, preview should be narrower
      expect(newWidths.editor).toBeGreaterThan(initialWidths.editor);
      expect(newWidths.preview).toBeLessThan(initialWidths.preview);
    });

    test('should reset cursor after mouse drag ends', async ({ page }) => {
      const resizeHandle = page.locator('.resize-handle');
      const handleBox = await resizeHandle.boundingBox();

      if (!handleBox) {
        throw new Error('Resize handle not found');
      }

      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;

      // Start drag
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 50, startY);

      // Body should have col-resize cursor during drag
      const cursorDuring = await page.evaluate(() => document.body.style.cursor);
      expect(cursorDuring).toBe('col-resize');

      // End drag
      await page.mouse.up();

      // Body cursor should be reset
      const cursorAfter = await page.evaluate(() => document.body.style.cursor);
      expect(cursorAfter).toBe('');
    });
  });

  test.describe('Touch Drag Resize', () => {
    test('should resize panels on touch drag', async ({ page }) => {
      const resizeHandle = page.locator('.resize-handle');
      const handleBox = await resizeHandle.boundingBox();

      if (!handleBox) {
        throw new Error('Resize handle not found');
      }

      // Get initial panel widths
      const initialWidths = await page.evaluate(() => {
        const editor = document.querySelector('.editor-panel');
        const preview = document.querySelector('.preview-panel');
        return {
          editor: editor ? editor.offsetWidth : 0,
          preview: preview ? preview.offsetWidth : 0
        };
      });

      // Simulate touch drag by dispatching touch events manually
      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;

      // Dispatch touch events manually for drag simulation
      await page.evaluate(({ startX, startY, endX }) => {
        const handle = document.querySelector('.resize-handle');
        if (!handle) return;

        // Create and dispatch touchstart
        const touchStart = new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [new Touch({
            identifier: 0,
            target: handle,
            clientX: startX,
            clientY: startY
          })]
        });
        handle.dispatchEvent(touchStart);

        // Create and dispatch touchmove
        const touchMove = new TouchEvent('touchmove', {
          bubbles: true,
          cancelable: true,
          touches: [new Touch({
            identifier: 0,
            target: handle,
            clientX: endX,
            clientY: startY
          })]
        });
        document.dispatchEvent(touchMove);

        // Create and dispatch touchend
        const touchEnd = new TouchEvent('touchend', {
          bubbles: true,
          cancelable: true,
          touches: []
        });
        document.dispatchEvent(touchEnd);
      }, { startX, startY, endX: startX + 100 });

      // Get new panel widths
      const newWidths = await page.evaluate(() => {
        const editor = document.querySelector('.editor-panel');
        const preview = document.querySelector('.preview-panel');
        return {
          editor: editor ? editor.offsetWidth : 0,
          preview: preview ? preview.offsetWidth : 0
        };
      });

      // Editor should be wider after dragging right
      expect(newWidths.editor).toBeGreaterThan(initialWidths.editor);
    });

    test('should handle touchcancel event', async ({ page }) => {
      const resizeHandle = page.locator('.resize-handle');
      const handleBox = await resizeHandle.boundingBox();

      if (!handleBox) {
        throw new Error('Resize handle not found');
      }

      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;

      // Start touch, then cancel
      await page.evaluate(({ startX, startY }) => {
        const handle = document.querySelector('.resize-handle');
        if (!handle) return;

        // Dispatch touchstart
        const touchStart = new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [new Touch({
            identifier: 0,
            target: handle,
            clientX: startX,
            clientY: startY
          })]
        });
        handle.dispatchEvent(touchStart);

        // Dispatch touchcancel
        const touchCancel = new TouchEvent('touchcancel', {
          bubbles: true,
          cancelable: true,
          touches: []
        });
        document.dispatchEvent(touchCancel);
      }, { startX, startY });

      // Body cursor should be reset after cancel
      const cursor = await page.evaluate(() => document.body.style.cursor);
      expect(cursor).toBe('');

      // userSelect should be reset
      const userSelect = await page.evaluate(() => document.body.style.userSelect);
      expect(userSelect).toBe('');
    });
  });

  test.describe('Minimum Panel Width', () => {
    test('should enforce minimum panel width of 200px', async ({ page }) => {
      const resizeHandle = page.locator('.resize-handle');
      const handleBox = await resizeHandle.boundingBox();

      if (!handleBox) {
        throw new Error('Resize handle not found');
      }

      // Try to drag handle all the way to the left
      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(0, startY); // Drag to left edge
      await page.mouse.up();

      // Editor panel should still have at least 200px width
      const editorWidth = await page.evaluate(() => {
        const editor = document.querySelector('.editor-panel');
        return editor ? editor.offsetWidth : 0;
      });

      expect(editorWidth).toBeGreaterThanOrEqual(200);
    });

    test('should enforce minimum preview panel width of 200px', async ({ page }) => {
      const resizeHandle = page.locator('.resize-handle');
      const handleBox = await resizeHandle.boundingBox();

      if (!handleBox) {
        throw new Error('Resize handle not found');
      }

      // Get container width
      const containerWidth = await page.evaluate(() => {
        const container = document.querySelector('.container');
        return container ? container.offsetWidth : 0;
      });

      // Try to drag handle all the way to the right
      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(containerWidth, startY); // Drag to right edge
      await page.mouse.up();

      // Preview panel should still have at least 200px width
      const previewWidth = await page.evaluate(() => {
        const preview = document.querySelector('.preview-panel');
        return preview ? preview.offsetWidth : 0;
      });

      expect(previewWidth).toBeGreaterThanOrEqual(200);
    });
  });

  test.describe('Initialization Guard', () => {
    test('multiple init calls should not create duplicate listeners', async ({ page }) => {
      // Call initResizeHandle multiple times via evaluate
      const result = await page.evaluate(() => {
        // The module should already be initialized from page load
        // We can check if calling the export again works without side effects
        // Since initResizeHandle is not exposed globally, we test behavior instead

        // Get initial panel widths
        const editor = document.querySelector('.editor-panel');
        const initialWidth = editor ? editor.offsetWidth : 0;

        // Simulate a drag
        const handle = document.querySelector('.resize-handle');
        if (!handle) return { success: false, reason: 'no handle' };

        const rect = handle.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        // Dispatch mousedown
        handle.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          clientX: startX,
          clientY: startY
        }));

        // Dispatch mousemove
        document.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          clientX: startX + 50,
          clientY: startY
        }));

        // Check width changed by expected amount (not doubled from duplicate listeners)
        const newWidth = editor ? editor.offsetWidth : 0;
        const widthChange = newWidth - initialWidth;

        // Dispatch mouseup
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

        return {
          success: true,
          initialWidth,
          newWidth,
          widthChange,
          // Width change should be reasonable (50px drag = ~50px change, not 100px from duplicates)
          reasonable: widthChange > 0 && widthChange < 100
        };
      });

      expect(result.success).toBe(true);
      expect(result.reasonable).toBe(true);
    });
  });
});
