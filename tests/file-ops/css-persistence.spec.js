// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  WAIT_TIMES
} = require('../helpers/test-utils');

/**
 * Tests for CSS persistence across page navigation (Issue #390)
 *
 * These tests verify that dynamically loaded CSS files (via file picker or URL)
 * persist across page navigation using sessionStorage.
 */
test.describe('CSS Persistence Across Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
    // Wait for the style selector to be populated
    await page.waitForFunction(() => {
      const selector = document.getElementById('styleSelector');
      return selector && selector.options.length > 0;
    }, { timeout: 5000 });

    // Clear sessionStorage to start fresh
    await page.evaluate(() => {
      sessionStorage.clear();
    });
  });

  test('should restore loaded styles from sessionStorage on page init', async ({ page }) => {
    // Create a mock CSS style in sessionStorage as if user loaded it previously
    const mockStyle = {
      name: 'test-style.css',
      source: 'file',
      css: '#wrapper { background: rgb(30, 30, 30); color: white; }'
    };

    await page.evaluate((style) => {
      sessionStorage.setItem('merview-v1-loaded-styles', JSON.stringify([style]));
    }, mockStyle);

    // Reload the page to trigger restoration
    await page.reload();
    await waitForPageReady(page);

    // Wait for style selector to be ready
    await page.waitForFunction(() => {
      const selector = document.getElementById('styleSelector');
      return selector && selector.options.length > 0;
    }, { timeout: 5000 });

    // Verify the loaded style appears in dropdown
    const hasLoadedStyle = await page.evaluate((styleName) => {
      const selector = document.getElementById('styleSelector');
      const options = Array.from(selector.options);
      return options.some(opt => opt.value === styleName);
    }, mockStyle.name);

    expect(hasLoadedStyle).toBe(true);
  });

  test('should save loaded styles to sessionStorage when CSS is loaded via loadCSSFromFile', async ({ page }) => {
    // Create a test CSS file blob with distinctive styling
    const cssContent = '#wrapper { background: #1e1e1e; color: #fff; }';
    const fileName = 'test-dark.css';

    // Create a mock File object and call the actual loadCSSFromFile function
    await page.evaluate(async ({ css, name }) => {
      // Create a Blob from the CSS content
      const blob = new Blob([css], { type: 'text/css' });
      // Create a File object from the Blob
      const file = new File([blob], name, { type: 'text/css' });

      // Call the actual loadCSSFromFile function (now exposed to globalThis)
      if (globalThis.loadCSSFromFile) {
        await globalThis.loadCSSFromFile(file);
      } else {
        throw new Error('loadCSSFromFile not exposed to globalThis');
      }
    }, { css: cssContent, name: fileName });

    // Wait for sessionStorage to be updated (deterministic wait instead of timeout)
    await page.waitForFunction((key) => {
      const data = sessionStorage.getItem(key);
      return data && JSON.parse(data).length > 0;
    }, 'merview-v1-loaded-styles', { timeout: 5000 });

    // Verify sessionStorage was updated with the loaded style
    const sessionData = await page.evaluate(() => {
      const data = sessionStorage.getItem('merview-v1-loaded-styles');
      return data ? JSON.parse(data) : null;
    });

    // Verify sessionStorage contains the loaded style with correct structure
    expect(sessionData).toBeDefined();
    expect(Array.isArray(sessionData)).toBe(true);
    expect(sessionData.length).toBeGreaterThan(0);

    // Verify the loaded style has the expected properties
    const loadedStyle = sessionData.find(s => s.name === fileName);
    expect(loadedStyle).toBeDefined();
    expect(loadedStyle.source).toBe('file');
    expect(loadedStyle.css).toContain('#wrapper');
  });

  test('should apply loaded CSS to page after reload', async ({ page }) => {
    // This test verifies that CSS is not just saved/restored in sessionStorage,
    // but is actually re-applied to the page with the correct visual styles.

    // Use a distinctive, easily verifiable background color (bright red in rgb format)
    const testBackgroundColor = 'rgb(255, 0, 0)'; // Bright red
    const cssContent = `#wrapper { background-color: ${testBackgroundColor}; }`;
    const fileName = 'test-red-background.css';

    // Step 1: Load CSS using applyCSSDirectly and save to sessionStorage
    await page.evaluate(({ css, name }) => {
      // Save to sessionStorage as if it was loaded
      const mockStyle = {
        name: name,
        source: 'file',
        css: css
      };
      sessionStorage.setItem('merview-v1-loaded-styles', JSON.stringify([mockStyle]));
    }, { css: cssContent, name: fileName });

    // Step 2: Reload the page to trigger CSS restoration from sessionStorage
    await page.reload();
    await waitForPageReady(page);

    // Wait for style selector to be ready
    await page.waitForFunction(() => {
      const selector = document.getElementById('styleSelector');
      return selector && selector.options.length > 0;
    }, { timeout: 5000 });

    // Step 3: Select the loaded style from the dropdown to apply it
    await page.evaluate((styleName) => {
      const selector = document.getElementById('styleSelector');
      const option = Array.from(selector.options).find(opt => opt.value === styleName);
      if (option) {
        selector.value = styleName;
        selector.dispatchEvent(new Event('change'));
      }
    }, fileName);

    // Wait for CSS to be applied (deterministic wait for background color change)
    await page.waitForFunction((expectedColor) => {
      const wrapper = document.getElementById('wrapper');
      if (!wrapper) return false;
      const computedStyle = globalThis.getComputedStyle(wrapper);
      return computedStyle.backgroundColor === expectedColor;
    }, testBackgroundColor, { timeout: 5000 });

    // Step 4: Verify the computed style actually reflects the loaded CSS
    const actualBackgroundColor = await page.evaluate(() => {
      const wrapper = document.getElementById('wrapper');
      if (!wrapper) return null;
      const computedStyle = globalThis.getComputedStyle(wrapper);
      return computedStyle.backgroundColor;
    });

    // Verify the background color was applied correctly
    expect(actualBackgroundColor).toBe(testBackgroundColor);
  });

  test('should clear sessionStorage when "No CSS" is selected', async ({ page }) => {
    // First, add a style to sessionStorage
    await page.evaluate(() => {
      const mockStyle = {
        name: 'test.css',
        source: 'file',
        css: '#wrapper { background: black; }'
      };
      sessionStorage.setItem('merview-v1-loaded-styles', JSON.stringify([mockStyle]));
    });

    // Verify it was saved
    let savedData = await page.evaluate(() => {
      return sessionStorage.getItem('merview-v1-loaded-styles');
    });
    expect(savedData).toBeTruthy();

    // Select "None (No CSS)" option
    await page.evaluate(() => {
      const selector = document.getElementById('styleSelector');
      const noCssOption = Array.from(selector.options).find(opt =>
        opt.value === 'None (No CSS)' || opt.text === 'None (No CSS)'
      );
      if (noCssOption) {
        selector.value = noCssOption.value;
        selector.dispatchEvent(new Event('change'));
      }
    });

    // Wait for sessionStorage to be cleared (deterministic wait)
    await page.waitForFunction((key) => {
      return sessionStorage.getItem(key) === null;
    }, 'merview-v1-loaded-styles', { timeout: 5000 });

    // Verify sessionStorage was cleared
    savedData = await page.evaluate(() => {
      return sessionStorage.getItem('merview-v1-loaded-styles');
    });
    expect(savedData).toBeNull();
  });

  test('should handle corrupted sessionStorage data gracefully', async ({ page }) => {
    // Set invalid JSON in sessionStorage
    await page.evaluate(() => {
      sessionStorage.setItem('merview-v1-loaded-styles', 'invalid json{{{');
    });

    // Reload page - should not crash
    await page.reload();
    await waitForPageReady(page);

    // Verify page loaded successfully
    const styleSelector = await page.$('#styleSelector');
    expect(styleSelector).not.toBeNull();

    // Verify corrupted data was cleaned up
    const sessionData = await page.evaluate(() => {
      return sessionStorage.getItem('merview-v1-loaded-styles');
    });
    expect(sessionData).toBeNull();
  });

  test('should persist multiple loaded styles', async ({ page }) => {
    // Add multiple styles to sessionStorage
    const mockStyles = [
      { name: 'style1.css', source: 'file', css: '#wrapper { background: red; }' },
      { name: 'style2.css', source: 'url', css: '#wrapper { background: blue; }' },
      { name: 'style3.css', source: 'file', css: '#wrapper { background: green; }' }
    ];

    await page.evaluate((styles) => {
      sessionStorage.setItem('merview-v1-loaded-styles', JSON.stringify(styles));
    }, mockStyles);

    // Reload the page
    await page.reload();
    await waitForPageReady(page);

    await page.waitForFunction(() => {
      const selector = document.getElementById('styleSelector');
      return selector && selector.options.length > 0;
    }, { timeout: 5000 });

    // Verify all styles were restored
    const restoredCount = await page.evaluate((styleNames) => {
      const selector = document.getElementById('styleSelector');
      const optionValues = new Set(Array.from(selector.options).map(opt => opt.value));
      let count = 0;
      for (const name of styleNames) {
        if (optionValues.has(name)) count++;
      }
      return count;
    }, mockStyles.map(s => s.name));

    expect(restoredCount).toBe(mockStyles.length);
  });

  test('should update sessionStorage when existing style is reloaded with new content', async ({ page }) => {
    const styleName = 'test-update.css';
    const originalCss = '#wrapper { background: red; }';
    const updatedCss = '#wrapper { background: blue; }';

    // Load initial style via loadCSSFromFile
    await page.evaluate(async ({ css, name }) => {
      const blob = new Blob([css], { type: 'text/css' });
      const file = new File([blob], name, { type: 'text/css' });
      if (globalThis.loadCSSFromFile) {
        await globalThis.loadCSSFromFile(file);
      }
    }, { css: originalCss, name: styleName });

    // Wait for sessionStorage to be updated
    await page.waitForFunction((key) => {
      const data = sessionStorage.getItem(key);
      return data && JSON.parse(data).length > 0;
    }, 'merview-v1-loaded-styles', { timeout: 5000 });

    // Verify original CSS is saved
    let sessionData = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem('merview-v1-loaded-styles'));
    });
    expect(sessionData[0].css).toContain('red');

    // Reload the same file with different content (simulates user re-uploading)
    await page.evaluate(async ({ css, name }) => {
      const blob = new Blob([css], { type: 'text/css' });
      const file = new File([blob], name, { type: 'text/css' });
      if (globalThis.loadCSSFromFile) {
        await globalThis.loadCSSFromFile(file);
      }
    }, { css: updatedCss, name: styleName });

    // Wait for sessionStorage to be updated with new content
    await page.waitForFunction((expectedCss) => {
      const data = sessionStorage.getItem('merview-v1-loaded-styles');
      if (!data) return false;
      const styles = JSON.parse(data);
      return styles.some(s => s.css.includes(expectedCss));
    }, 'blue', { timeout: 5000 });

    // Verify updated CSS replaced the original
    sessionData = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem('merview-v1-loaded-styles'));
    });
    const updatedStyle = sessionData.find(s => s.name === styleName);
    expect(updatedStyle).toBeDefined();
    expect(updatedStyle.css).toContain('blue');
    expect(updatedStyle.css).not.toContain('red');
  });

  test('should persist URL-loaded CSS across page navigation', async ({ page }) => {
    // This tests CSS loaded via URL (source: 'url') persists correctly
    const urlStyleName = 'https://example.com/theme.css';
    const urlCss = '#wrapper { font-family: serif; color: navy; }';

    // Simulate URL-loaded CSS by directly setting sessionStorage with source: 'url'
    await page.evaluate(({ name, css }) => {
      const mockStyle = {
        name: name,
        source: 'url',
        css: css
      };
      sessionStorage.setItem('merview-v1-loaded-styles', JSON.stringify([mockStyle]));
    }, { name: urlStyleName, css: urlCss });

    // Reload the page to test restoration
    await page.reload();
    await waitForPageReady(page);

    // Wait for style selector to be populated
    await page.waitForFunction(() => {
      const selector = document.getElementById('styleSelector');
      return selector && selector.options.length > 0;
    }, { timeout: 5000 });

    // Verify URL-loaded style appears in dropdown with (URL) suffix
    const hasUrlStyle = await page.evaluate((styleName) => {
      const selector = document.getElementById('styleSelector');
      const options = Array.from(selector.options);
      return options.some(opt => opt.value === styleName && opt.textContent.includes('(URL)'));
    }, urlStyleName);

    expect(hasUrlStyle).toBe(true);

    // Verify CSS content was preserved in sessionStorage
    const sessionData = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem('merview-v1-loaded-styles'));
    });
    const urlStyle = sessionData.find(s => s.name === urlStyleName);
    expect(urlStyle).toBeDefined();
    expect(urlStyle.source).toBe('url');
    expect(urlStyle.css).toContain('serif');
  });

  test('should handle sessionStorage quota exceeded gracefully', async ({ page }) => {
    // Set up error listener BEFORE triggering the action
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    // Inject a mock that will fail when saving loaded styles
    await page.evaluate(() => {
      const originalSetItem = sessionStorage.setItem.bind(sessionStorage);
      sessionStorage.setItem = function(key, value) {
        if (key === 'merview-v1-loaded-styles') {
          throw new Error('QuotaExceededError');
        }
        return originalSetItem(key, value);
      };
    });

    // Actually trigger saveLoadedStylesToSession by loading a CSS file
    // This exercises the error handling code path
    await page.evaluate(async () => {
      const css = '#wrapper { background: red; }';
      const blob = new Blob([css], { type: 'text/css' });
      const file = new File([blob], 'quota-test.css', { type: 'text/css' });

      // This should trigger saveLoadedStylesToSession, which will hit the mocked error
      if (globalThis.loadCSSFromFile) {
        await globalThis.loadCSSFromFile(file);
      }
    });

    // Wait for style to appear in dropdown (proves loadCSSFromFile completed despite storage error)
    await page.waitForFunction(() => {
      const selector = document.getElementById('styleSelector');
      if (!selector) return false;
      return Array.from(selector.options).some(opt => opt.value === 'quota-test.css');
    }, { timeout: 5000 });

    // The app should not crash even if sessionStorage fails
    const styleSelector = await page.$('#styleSelector');
    expect(styleSelector).not.toBeNull();

    // Should have no unhandled errors (warnings are logged but not thrown)
    expect(errors.length).toBe(0);
  });

  test('should persist loaded styles when navigating away and back', async ({ page }) => {
    // This tests actual browser navigation (not just reload)
    // sessionStorage persists within the same tab's session
    const styleName = 'navigation-test.css';
    const cssContent = '#wrapper { border: 2px solid green; }';

    // Load a CSS file
    await page.evaluate(async ({ css, name }) => {
      const blob = new Blob([css], { type: 'text/css' });
      const file = new File([blob], name, { type: 'text/css' });
      if (globalThis.loadCSSFromFile) {
        await globalThis.loadCSSFromFile(file);
      }
    }, { css: cssContent, name: styleName });

    // Wait for sessionStorage to be updated
    await page.waitForFunction((key) => {
      const data = sessionStorage.getItem(key);
      return data && JSON.parse(data).length > 0;
    }, 'merview-v1-loaded-styles', { timeout: 5000 });

    // Store the base URL to navigate back to
    const baseUrl = page.url();

    // Navigate away to a different page
    await page.goto('about:blank');

    // Navigate back using the URL (goBack may not work from about:blank)
    await page.goto(baseUrl);
    await waitForPageReady(page);

    // Wait for style selector to be populated
    await page.waitForFunction(() => {
      const selector = document.getElementById('styleSelector');
      return selector && selector.options.length > 0;
    }, { timeout: 5000 });

    // Verify the loaded style was restored from sessionStorage
    const hasLoadedStyle = await page.evaluate((name) => {
      const selector = document.getElementById('styleSelector');
      const options = Array.from(selector.options);
      return options.some(opt => opt.value === name);
    }, styleName);

    expect(hasLoadedStyle).toBe(true);

    // Verify CSS content is still in sessionStorage
    const sessionData = await page.evaluate(() => {
      return JSON.parse(sessionStorage.getItem('merview-v1-loaded-styles'));
    });
    const restoredStyle = sessionData.find(s => s.name === styleName);
    expect(restoredStyle).toBeDefined();
    expect(restoredStyle.css).toContain('green');
  });
});
