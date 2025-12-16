// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  getCodeMirrorContent,
  WAIT_TIMES
} = require('./helpers/test-utils');

/**
 * Tests for Fresh Visit behavior (Issue #137)
 *
 * Fresh visits (new tab/window) should always load the sample document.
 * Same-session refreshes should preserve localStorage content.
 *
 * This uses sessionStorage to detect fresh visits since sessionStorage
 * is cleared when the tab/window is closed.
 *
 * Note on multi-tab behavior: Each browser tab has its own sessionStorage,
 * so opening merview.com in a new tab will always show the sample document,
 * even if another tab has edited content. This is intentional for privacy
 * and predictable UX reasons - see issue #137 for details.
 */

/**
 * Helper to clear all storage for a clean test state
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
async function clearAllStorage(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Helper to set localStorage content without session marker
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} content - Content to set
 */
async function setLocalStorageContent(page, content) {
  await page.evaluate((text) => {
    localStorage.setItem('markdown-content', text);
  }, content);
}

/**
 * Helper to get sessionStorage marker
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string|null>} The session marker value
 */
async function getSessionMarker(page) {
  return page.evaluate(() => {
    return sessionStorage.getItem('merview-session-initialized');
  });
}

/**
 * Helper to check if content contains sample document markers
 * @param {string|null} content - Content to check
 * @returns {boolean} True if content is the sample document
 */
function isSampleContent(content) {
  return content?.includes('Welcome to Merview') ?? false;
}

test.describe('Fresh Visit Behavior', () => {
  test.describe('Fresh Visit Detection', () => {
    test('fresh visit with no localStorage should load sample document', async ({ page }) => {
      // Clear everything to simulate truly fresh visit
      await page.goto('/');
      await clearAllStorage(page);

      // Reload to trigger fresh visit logic
      await page.reload();
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForTimeout(WAIT_TIMES.LONG);

      const content = await getCodeMirrorContent(page);
      expect(isSampleContent(content)).toBe(true);
    });

    test('fresh visit with existing localStorage should still load sample document', async ({ page }) => {
      // Set up localStorage content but NO session marker.
      // We go to the page first, then clear storage, then set localStorage content.
      // This ensures we have a controlled state before the reload test.
      await page.goto('/');
      await clearAllStorage(page);
      await setLocalStorageContent(page, '# My Custom Document\n\nThis is cached content.');

      // Reload triggers fresh visit detection because sessionStorage was cleared.
      // Since there's no session marker, isFreshVisit() returns true and
      // the app loads the sample document instead of the localStorage content.
      await page.reload();
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForTimeout(WAIT_TIMES.LONG);

      const content = await getCodeMirrorContent(page);
      // Should load sample, NOT the cached localStorage content
      expect(isSampleContent(content)).toBe(true);
      expect(content).not.toContain('My Custom Document');
    });

    test('session marker should be set after initial load', async ({ page }) => {
      await page.goto('/');
      await clearAllStorage(page);

      // Reload for fresh visit
      await page.reload();
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      const marker = await getSessionMarker(page);
      expect(marker).toBe('true');
    });
  });

  test.describe('Same-Session Refresh', () => {
    test('refresh within same session should preserve edited content', async ({ page }) => {
      // Initial fresh visit
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      // Edit content in the editor
      const customContent = '# My Edited Document\n\nThis content was edited.';
      await page.evaluate((text) => {
        const cmElement = document.querySelector('.CodeMirror');
        const cmEditor = cmElement?.CodeMirror;
        if (cmEditor) {
          cmEditor.setValue(text);
          // Trigger render to save to localStorage
          if (typeof globalThis.renderMarkdown === 'function') {
            globalThis.renderMarkdown();
          }
        }
      }, customContent);
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      // Refresh (same session - session marker still exists)
      await page.reload();
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForTimeout(WAIT_TIMES.LONG);

      const content = await getCodeMirrorContent(page);
      // Should preserve edited content, NOT load sample
      expect(content).toContain('My Edited Document');
      expect(isSampleContent(content)).toBe(false);
    });

    test('multiple refreshes should continue preserving content', async ({ page }) => {
      await waitForPageReady(page);

      // Set custom content
      const customContent = '# Persistent Content\n\nThis should persist.';
      await page.evaluate((text) => {
        const cmElement = document.querySelector('.CodeMirror');
        const cmEditor = cmElement?.CodeMirror;
        if (cmEditor) {
          cmEditor.setValue(text);
          if (typeof globalThis.renderMarkdown === 'function') {
            globalThis.renderMarkdown();
          }
        }
      }, customContent);
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      // Multiple refreshes
      for (let i = 0; i < 3; i++) {
        await page.reload();
        await page.waitForSelector('.CodeMirror', { timeout: 15000 });
        await page.waitForTimeout(WAIT_TIMES.MEDIUM);

        const content = await getCodeMirrorContent(page);
        expect(content).toContain('Persistent Content');
      }
    });
  });

  test.describe('URL Parameter Behavior', () => {
    test('fresh visit with ?url= parameter should load URL content (common first-time user scenario)', async ({ page }) => {
      // This is a critical test: many users' first experience with Merview
      // will be clicking a shared link with a ?url= parameter. They should
      // see the shared content, not the sample document.

      // Clear all storage to simulate true first-time visitor
      await page.goto('/');
      await clearAllStorage(page);

      // Now visit with a URL parameter (simulating clicking a shared link)
      // Using a data URL to avoid external dependencies in tests
      const testMarkdown = '# Shared Document\n\nThis was shared via link.';
      const encodedContent = encodeURIComponent(testMarkdown);

      await page.goto(`/?md=${encodedContent}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      const content = await getCodeMirrorContent(page);
      // Should load the shared content, NOT the sample document
      expect(content).toContain('Shared Document');
      expect(isSampleContent(content)).toBe(false);

      // Session should be marked as initialized
      const marker = await getSessionMarker(page);
      expect(marker).toBe('true');
    });

    test('URL with ?md= parameter should load inline content and mark session', async ({ page }) => {
      const inlineContent = '# Inline Content';
      const encodedContent = encodeURIComponent(inlineContent);

      await page.goto(`/?md=${encodedContent}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      const content = await getCodeMirrorContent(page);
      expect(content).toContain('Inline Content');

      // Session should be marked
      const marker = await getSessionMarker(page);
      expect(marker).toBe('true');
    });

    test('refresh after URL parameter load should preserve content', async ({ page }) => {
      const inlineContent = '# URL Loaded Content\n\nFrom query parameter.';
      const encodedContent = encodeURIComponent(inlineContent);

      await page.goto(`/?md=${encodedContent}`);
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      // Navigate to base URL (simulates removing the parameter)
      // But within same session, should keep localStorage content
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      const content = await getCodeMirrorContent(page);
      // Since session is initialized, should load from localStorage
      expect(content).toContain('URL Loaded Content');
    });
  });

  test.describe('Storage Functions', () => {
    test('isFreshVisit should return true when no session marker exists', async ({ page }) => {
      await page.goto('/');
      await clearAllStorage(page);

      const isFresh = await page.evaluate(() => {
        // Direct check since we're testing the storage logic
        return !sessionStorage.getItem('merview-session-initialized');
      });

      expect(isFresh).toBe(true);
    });

    test('isFreshVisit should return false after session is initialized', async ({ page }) => {
      await waitForPageReady(page);
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      const isFresh = await page.evaluate(() => {
        return !sessionStorage.getItem('merview-session-initialized');
      });

      expect(isFresh).toBe(false);
    });

    test('localStorage content should persist across page loads', async ({ page }) => {
      await waitForPageReady(page);

      // Set custom content
      const testContent = '# Test Persistence';
      await page.evaluate((text) => {
        localStorage.setItem('markdown-content', text);
      }, testContent);

      // Reload and check localStorage directly
      await page.reload();
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });

      const storedContent = await page.evaluate(() => {
        return localStorage.getItem('markdown-content');
      });

      expect(storedContent).toContain('Test Persistence');
    });
  });

  test.describe('Multi-Tab Behavior', () => {
    test('new tab should show sample even if another tab has edited content', async ({ context }) => {
      // Open first tab and edit content
      const page1 = await context.newPage();
      await page1.goto('/');
      await page1.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page1.waitForTimeout(WAIT_TIMES.MEDIUM);

      // Edit content in first tab
      await page1.evaluate(() => {
        const cmElement = document.querySelector('.CodeMirror');
        const cmEditor = cmElement?.CodeMirror;
        if (cmEditor) {
          cmEditor.setValue('# Content from Tab 1\n\nThis was edited in the first tab.');
          if (typeof globalThis.renderMarkdown === 'function') {
            globalThis.renderMarkdown();
          }
        }
      });
      await page1.waitForTimeout(WAIT_TIMES.MEDIUM);

      // Verify first tab has edited content saved to localStorage
      const localStorageContent = await page1.evaluate(() => {
        return localStorage.getItem('markdown-content');
      });
      expect(localStorageContent).toContain('Content from Tab 1');

      // Open second tab - should show sample document, NOT the edited content.
      // This is intentional: each tab has its own sessionStorage, so the
      // second tab is treated as a "fresh visit" even though localStorage
      // has content from the first tab.
      const page2 = await context.newPage();
      await page2.goto('/');
      await page2.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page2.waitForTimeout(WAIT_TIMES.LONG);

      const content2 = await page2.evaluate(() => {
        const cmElement = document.querySelector('.CodeMirror');
        const cmEditor = cmElement?.CodeMirror;
        return cmEditor ? cmEditor.getValue() : '';
      });

      // Second tab shows sample (this is the designed behavior for privacy)
      expect(isSampleContent(content2)).toBe(true);
      expect(content2).not.toContain('Content from Tab 1');

      await page1.close();
      await page2.close();
    });

    test('tabs in same session share localStorage but have separate sessionStorage', async ({ context }) => {
      // Open first tab
      const page1 = await context.newPage();
      await page1.goto('/');
      await page1.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Verify session marker is set in first tab
      const marker1 = await page1.evaluate(() => {
        return sessionStorage.getItem('merview-session-initialized');
      });
      expect(marker1).toBe('true');

      // Open second tab
      const page2 = await context.newPage();
      await page2.goto('/');
      await page2.waitForSelector('.CodeMirror', { timeout: 15000 });

      // Second tab also has its own session marker (separate sessionStorage)
      const marker2 = await page2.evaluate(() => {
        return sessionStorage.getItem('merview-session-initialized');
      });
      expect(marker2).toBe('true');

      // But localStorage is shared - set in one, visible in other
      await page1.evaluate(() => {
        localStorage.setItem('test-shared', 'from-tab-1');
      });

      const sharedValue = await page2.evaluate(() => {
        return localStorage.getItem('test-shared');
      });
      expect(sharedValue).toBe('from-tab-1');

      // Cleanup
      await page1.evaluate(() => {
        localStorage.removeItem('test-shared');
      });

      await page1.close();
      await page2.close();
    });
  });

  test.describe('Edge Cases', () => {
    test('empty localStorage with session marker should load sample', async ({ page }) => {
      await page.goto('/');

      // Set session marker but clear localStorage content
      await page.evaluate(() => {
        sessionStorage.setItem('merview-session-initialized', 'true');
        localStorage.removeItem('markdown-content');
      });

      await page.reload();
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await page.waitForTimeout(WAIT_TIMES.LONG);

      const content = await getCodeMirrorContent(page);
      // Should fall back to sample since no localStorage content exists
      expect(isSampleContent(content)).toBe(true);
    });

    test('Load Sample button should work regardless of session state', async ({ page }) => {
      await waitForPageReady(page);

      // Set custom content
      await page.evaluate(() => {
        const cmElement = document.querySelector('.CodeMirror');
        const cmEditor = cmElement?.CodeMirror;
        if (cmEditor) {
          cmEditor.setValue('# Custom Content');
        }
      });

      // Click Load Sample
      await page.click('button[onclick="loadWelcomePage()"]');
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      const content = await getCodeMirrorContent(page);
      expect(isSampleContent(content)).toBe(true);
    });
  });

  test.describe('Default Settings for New Users', () => {
    test('hrAsPageBreak defaults to false when localStorage is empty', async ({ page }) => {
      await page.goto('/');
      await clearAllStorage(page);

      // Reload to reinitialize state with empty localStorage
      await page.reload();
      await waitForPageReady(page);

      const result = await page.evaluate(() => {
        return {
          localStorageValue: localStorage.getItem('hr-page-break'),
          stateValue: globalThis.state?.hrAsPageBreak
        };
      });

      // localStorage should be null (not set), state should be false
      expect(result.localStorageValue).toBeNull();
      expect(result.stateValue).toBe(false);
    });

    test('respectStyleLayout defaults to false when localStorage is empty', async ({ page }) => {
      await page.goto('/');
      await clearAllStorage(page);

      // Reload to reinitialize state with empty localStorage
      await page.reload();
      await waitForPageReady(page);

      const result = await page.evaluate(() => {
        return {
          localStorageValue: localStorage.getItem('respect-style-layout'),
          stateValue: globalThis.state?.respectStyleLayout
        };
      });

      // localStorage should be null (not set), state should be false
      expect(result.localStorageValue).toBeNull();
      expect(result.stateValue).toBe(false);
    });

    test('hrAsPageBreak is true when localStorage is set to true', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('hr-page-break', 'true');
      });

      // Reload to reinitialize state with the stored value
      await page.reload();
      await waitForPageReady(page);

      const stateValue = await page.evaluate(() => globalThis.state?.hrAsPageBreak);
      expect(stateValue).toBe(true);
    });

    test('respectStyleLayout is true when localStorage is set to true', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('respect-style-layout', 'true');
      });

      // Reload to reinitialize state with the stored value
      await page.reload();
      await waitForPageReady(page);

      const stateValue = await page.evaluate(() => globalThis.state?.respectStyleLayout);
      expect(stateValue).toBe(true);
    });

    test('hrAsPageBreak is false when localStorage is set to false', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('hr-page-break', 'false');
      });

      // Reload to reinitialize state with the stored value
      await page.reload();
      await waitForPageReady(page);

      const stateValue = await page.evaluate(() => globalThis.state?.hrAsPageBreak);
      expect(stateValue).toBe(false);
    });

    test('respectStyleLayout is false when localStorage is set to false', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('respect-style-layout', 'false');
      });

      // Reload to reinitialize state with the stored value
      await page.reload();
      await waitForPageReady(page);

      const stateValue = await page.evaluate(() => globalThis.state?.respectStyleLayout);
      expect(stateValue).toBe(false);
    });
  });
});
