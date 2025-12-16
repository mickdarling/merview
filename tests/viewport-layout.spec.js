// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

// Tolerance for overflow checks - accounts for browser rounding differences in layout calculations
const OVERFLOW_TOLERANCE_PX = 2;

// Timeouts for initialization - generous for CI environments
const CODEMIRROR_INIT_TIMEOUT = 15000;
const EDITOR_API_TIMEOUT = 5000;
const LAYOUT_STABILIZE_DELAY = 200;

test.describe('Viewport Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Set a consistent viewport size for all tests
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    // Wait for CodeMirror to initialize
    await page.waitForSelector('.CodeMirror', { timeout: CODEMIRROR_INIT_TIMEOUT });
    await page.waitForFunction(() => typeof globalThis.setEditorContent === 'function', { timeout: EDITOR_API_TIMEOUT });
    // Wait for layout to stabilize
    await page.waitForTimeout(LAYOUT_STABILIZE_DELAY);
  });

  test.describe('No Page Overflow', () => {
    test('body should not have significant vertical overflow', async ({ page }) => {
      const overflow = await page.evaluate(() => {
        return document.body.scrollHeight - document.body.clientHeight;
      });
      expect(overflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
    });

    test('should prevent page scroll when editor scrolled to bottom', async ({ page }) => {
      // Load content that fills the editor
      await page.evaluate(() => {
        const longContent = new Array(100).fill('# Heading\n\nParagraph with some text.').join('\n\n');
        globalThis.setEditorContent(longContent);
      });

      // Wait for content to render
      await page.waitForTimeout(100);

      // Scroll editor to bottom
      await page.evaluate(() => {
        const cmScroll = document.querySelector('.CodeMirror-scroll');
        if (cmScroll) {
          cmScroll.scrollTop = cmScroll.scrollHeight;
        }
      });

      // Check body scroll position hasn't changed
      const bodyScrollTop = await page.evaluate(() => document.documentElement.scrollTop || document.body.scrollTop);
      expect(bodyScrollTop).toBe(0);

      // Also verify body still doesn't have significant overflow
      const overflow = await page.evaluate(() => {
        return document.body.scrollHeight - document.body.clientHeight;
      });
      expect(overflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
    });

    test('should prevent page scroll when preview scrolled to bottom', async ({ page }) => {
      // Load content that fills the preview
      await page.evaluate(() => {
        const longContent = new Array(100).fill('# Heading\n\nParagraph with some text.').join('\n\n');
        globalThis.setEditorContent(longContent);
      });

      // Wait for preview to render
      await page.waitForTimeout(500);

      // Scroll preview to bottom
      await page.evaluate(() => {
        const preview = document.getElementById('preview');
        if (preview) {
          preview.scrollTop = preview.scrollHeight;
        }
      });

      // Check body scroll position hasn't changed
      const bodyScrollTop = await page.evaluate(() => document.documentElement.scrollTop || document.body.scrollTop);
      expect(bodyScrollTop).toBe(0);
    });
  });

  test.describe('Responsive Toolbar', () => {
    test('layout should work with narrow viewport (wrapped toolbar)', async ({ page }) => {
      // Resize to narrow viewport where toolbar wraps
      await page.setViewportSize({ width: 600, height: 800 });

      // Wait for layout to adjust
      await page.waitForTimeout(100);

      // Body should still not have significant overflow
      const overflow = await page.evaluate(() => {
        return document.body.scrollHeight - document.body.clientHeight;
      });
      expect(overflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);

      // Container should fill remaining space
      const layoutCheck = await page.evaluate(() => {
        const toolbar = document.querySelector('.toolbar');
        const container = document.querySelector('.container');
        const footer = document.querySelector('.site-footer');
        const body = document.body;

        const toolbarHeight = toolbar ? toolbar.offsetHeight : 0;
        const containerHeight = container ? container.offsetHeight : 0;
        const footerHeight = footer ? footer.offsetHeight : 0;
        const totalHeight = toolbarHeight + containerHeight + footerHeight;
        const bodyHeight = body.clientHeight;

        return {
          toolbarHeight,
          containerHeight,
          footerHeight,
          totalHeight,
          bodyHeight,
          difference: Math.abs(totalHeight - bodyHeight)
        };
      });

      // Total should equal body height (within 1px tolerance for rounding)
      expect(layoutCheck.difference).toBeLessThanOrEqual(1);
    });

    test('layout should work with very narrow viewport', async ({ page }) => {
      // Very narrow viewport
      await page.setViewportSize({ width: 400, height: 600 });
      await page.waitForTimeout(100);

      const overflow = await page.evaluate(() => {
        return document.body.scrollHeight - document.body.clientHeight;
      });
      expect(overflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
    });

    test('layout should work with wide viewport', async ({ page }) => {
      // Wide desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(100);

      const overflow = await page.evaluate(() => {
        return document.body.scrollHeight - document.body.clientHeight;
      });
      expect(overflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
    });
  });

  test.describe('Footer', () => {
    test('footer should be visible', async ({ page }) => {
      const footer = page.locator('.site-footer');
      await expect(footer).toBeVisible();
    });

    test('footer should contain copyright text with current year', async ({ page }) => {
      const footer = page.locator('.site-footer');
      const currentYear = new Date().getFullYear().toString();
      await expect(footer).toContainText(currentYear);
      await expect(footer).toContainText('Mick Darling');
      await expect(footer).toContainText('AGPL-3.0');
    });

    test('footer should be hidden in print mode', async ({ page }) => {
      // Emulate print media
      await page.emulateMedia({ media: 'print' });

      const footer = page.locator('.site-footer');
      await expect(footer).toBeHidden();
    });

    test('footer should not cause overflow', async ({ page }) => {
      // Get footer position
      const footerBottom = await page.evaluate(() => {
        const footer = document.querySelector('.site-footer');
        if (footer) {
          const rect = footer.getBoundingClientRect();
          return rect.bottom;
        }
        return 0;
      });

      const viewportHeight = await page.evaluate(() => globalThis.innerHeight);

      // Footer bottom should be at or within viewport
      expect(footerBottom).toBeLessThanOrEqual(viewportHeight);
    });
  });

  test.describe('Flexbox Layout Structure', () => {
    test('body should be flex container with column direction', async ({ page }) => {
      const bodyStyles = await page.evaluate(() => {
        const computed = globalThis.getComputedStyle(document.body);
        return {
          display: computed.display,
          flexDirection: computed.flexDirection
        };
      });

      expect(bodyStyles.display).toBe('flex');
      expect(bodyStyles.flexDirection).toBe('column');
    });

    test('toolbar should not shrink', async ({ page }) => {
      const toolbarFlexShrink = await page.evaluate(() => {
        const toolbar = document.querySelector('.toolbar');
        if (toolbar) {
          return globalThis.getComputedStyle(toolbar).flexShrink;
        }
        return null;
      });

      expect(toolbarFlexShrink).toBe('0');
    });

    test('container should flex to fill space', async ({ page }) => {
      const containerStyles = await page.evaluate(() => {
        const container = document.querySelector('.container');
        if (container) {
          const computed = globalThis.getComputedStyle(container);
          return {
            flexGrow: computed.flexGrow,
            flexShrink: computed.flexShrink
          };
        }
        return null;
      });

      expect(containerStyles.flexGrow).toBe('1');
    });

    test('footer should not shrink', async ({ page }) => {
      const footerFlexShrink = await page.evaluate(() => {
        const footer = document.querySelector('.site-footer');
        if (footer) {
          return globalThis.getComputedStyle(footer).flexShrink;
        }
        return null;
      });

      expect(footerFlexShrink).toBe('0');
    });
  });

  test.describe('Visual Regression - Layout Dimensions', () => {
    test('toolbar, container, and footer heights should sum to viewport', async ({ page }) => {
      // Standard viewport
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(100);

      const dimensions = await page.evaluate(() => {
        const toolbar = document.querySelector('.toolbar');
        const container = document.querySelector('.container');
        const footer = document.querySelector('.site-footer');

        return {
          viewport: globalThis.innerHeight,
          toolbar: toolbar ? toolbar.offsetHeight : 0,
          container: container ? container.offsetHeight : 0,
          footer: footer ? footer.offsetHeight : 0
        };
      });

      const totalHeight = dimensions.toolbar + dimensions.container + dimensions.footer;

      // Should match viewport exactly (within 1px tolerance)
      expect(Math.abs(totalHeight - dimensions.viewport)).toBeLessThanOrEqual(1);
    });

    test('editor and preview panels should have equal width by default', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(100);

      const panelWidths = await page.evaluate(() => {
        const editor = document.querySelector('.editor-panel');
        const preview = document.querySelector('.preview-panel');
        const resizeHandle = document.querySelector('.resize-handle');

        return {
          editor: editor ? editor.offsetWidth : 0,
          preview: preview ? preview.offsetWidth : 0,
          resizeHandle: resizeHandle ? resizeHandle.offsetWidth : 0
        };
      });

      // Panels should be roughly equal (within 10px tolerance for resize handle)
      const widthDifference = Math.abs(panelWidths.editor - panelWidths.preview);
      expect(widthDifference).toBeLessThanOrEqual(10);
    });

    test('divider position should persist across document loads (Issue #285)', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(200);

      // Get the resize handle and container
      const resizeHandle = page.locator('.resize-handle');
      const container = page.locator('.container');

      // Get initial container bounds
      const containerBox = await container.boundingBox();

      // Drag the resize handle to approximately 30% from the left
      const targetX = containerBox.x + (containerBox.width * 0.3);
      const centerY = containerBox.y + (containerBox.height / 2);

      await resizeHandle.hover();
      await page.mouse.down();
      await page.mouse.move(targetX, centerY);
      await page.mouse.up();
      await page.waitForTimeout(100);

      // Get the editor panel width after dragging
      const widthAfterDrag = await page.evaluate(() => {
        const editor = document.querySelector('.editor-panel');
        const container = document.querySelector('.container');
        return (editor.offsetWidth / container.offsetWidth) * 100;
      });

      // Click the Welcome button to load a new document
      await page.click('button:has-text("Welcome")');
      await page.waitForTimeout(200);

      // Get the editor panel width after loading new document
      const widthAfterLoad = await page.evaluate(() => {
        const editor = document.querySelector('.editor-panel');
        const container = document.querySelector('.container');
        return (editor.offsetWidth / container.offsetWidth) * 100;
      });

      // The width should persist (within 2% tolerance for rounding)
      expect(Math.abs(widthAfterDrag - widthAfterLoad)).toBeLessThanOrEqual(2);

      // Verify it's still roughly at 30% (not reset to 50%)
      expect(widthAfterLoad).toBeLessThan(40);
    });
  });
});
