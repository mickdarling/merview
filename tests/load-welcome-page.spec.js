// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  waitForGlobalFunction,
  isGlobalFunctionAvailable,
  getCodeMirrorContent,
  setCodeMirrorContent,
  clearCodeMirrorContent,
  WAIT_TIMES
} = require('./helpers/test-utils');

/**
 * Simple delay helper to avoid deeply nested Promise callbacks in tests
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(function waitForDelay(resolve) {
    setTimeout(resolve, ms);
  });
}

/**
 * Set up status message capture via MutationObserver
 * Extracted to reduce function nesting depth in tests (SonarCloud S2004)
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {string[]} statusMessages - Array to collect status messages
 */
async function setupStatusMessageCapture(page, statusMessages) {
  await page.exposeFunction('captureStatus', (msg) => statusMessages.push(msg));
  await page.evaluate(function initStatusObserver() {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;
    const observer = new MutationObserver(function onStatusChange() {
      globalThis.captureStatus(statusEl.textContent);
    });
    observer.observe(statusEl, { childList: true, characterData: true, subtree: true });
  });
}

/**
 * Expected content elements in the welcome page markdown
 */
const EXPECTED_CONTENT = {
  mainHeading: '# Welcome to Merview',
  subHeadings: [
    '## Quick Links',
    '## Getting Started',
    '## Feature Showcase',
    '## Tips',
    '## Open Source'
  ],
  codeBlocks: ['```javascript', '```python'],
  mermaidElements: ['```mermaid', 'graph LR', 'sequenceDiagram', 'classDiagram'],
  tableMarkers: ['| Feature | Status |', '|---------|--------|'],
  minRealFileSize: 2000 // Real welcome.md is ~5KB, fallback is much smaller
};

/**
 * Browser-side helper: Load welcome page and wait for content
 * @param {number} waitTime - Time to wait after loading
 * @returns {Promise<string>} Editor content after loading
 */
async function browserLoadWelcomePageAndWait(waitTime) {
  if (typeof globalThis.loadWelcomePage === 'function') {
    await globalThis.loadWelcomePage();
  }

  // Additional wait for any post-load rendering
  await new Promise(function resolveAfterWait(resolve) {
    setTimeout(resolve, waitTime);
  });

  const cmElement = document.querySelector('.CodeMirror');
  const cmEditor = cmElement?.CodeMirror;
  return cmEditor ? cmEditor.getValue() : '';
}

/**
 * Tests for Welcome Page functionality
 *
 * These tests ensure the Welcome button and loadWelcomePage() function work correctly
 * to populate the editor with comprehensive demo content including markdown,
 * code blocks, tables, and mermaid diagrams.
 */
test.describe('Welcome Page Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
    await waitForGlobalFunction(page, 'loadWelcomePage');
  });

  test.describe('Welcome Button', () => {
    test('Welcome button should exist in toolbar', async ({ page }) => {
      const welcomeButton = await page.$('button[onclick="loadWelcomePage()"]');
      expect(welcomeButton).not.toBeNull();
    });

    test('Welcome button should have loadWelcomePage onclick handler', async ({ page }) => {
      const onclick = await page.$eval('button[onclick="loadWelcomePage()"]', el => el.getAttribute('onclick'));
      expect(onclick).toBe('loadWelcomePage()');
    });

    test('Welcome button should be visible and clickable', async ({ page }) => {
      const [isVisible, isEnabled] = await Promise.all([
        page.isVisible('button[onclick="loadWelcomePage()"]'),
        page.isEnabled('button[onclick="loadWelcomePage()"]')
      ]);

      expect(isVisible).toBe(true);
      expect(isEnabled).toBe(true);
    });
  });

  test.describe('Global Function', () => {
    test('loadWelcomePage() function should be globally available', async ({ page }) => {
      const isFunction = await isGlobalFunctionAvailable(page, 'loadWelcomePage');
      expect(isFunction).toBe(true);
    });

    test('loadWelcomePage() should be callable without errors', async ({ page }) => {
      await clearCodeMirrorContent(page);

      const didExecute = await page.evaluate(async () => {
        try {
          await globalThis.loadWelcomePage();
          return true;
        } catch (error) {
          console.error('loadWelcomePage error:', error);
          return false;
        }
      });

      expect(didExecute).toBe(true);
    });
  });

  test.describe('Sample Content Loading', () => {
    const MIN_LOADED_CONTENT_LENGTH = 0;
    const MIN_SAMPLE_CONTENT_LENGTH = 100;

    test('clicking Welcome should populate the editor with content', async ({ page }) => {
      await clearCodeMirrorContent(page);
      await page.waitForTimeout(WAIT_TIMES.SHORT);

      const emptyContent = await getCodeMirrorContent(page);
      expect(emptyContent).toBe('');

      await page.click('button[onclick="loadWelcomePage()"]');
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      const loadedContent = await getCodeMirrorContent(page);
      expect(loadedContent.length).toBeGreaterThan(MIN_LOADED_CONTENT_LENGTH);
    });

    test('editor should not be empty after loading sample', async ({ page }) => {
      const content = await page.evaluate(browserLoadWelcomePageAndWait, WAIT_TIMES.MEDIUM);

      expect(content).not.toBe('');
      expect(content.trim().length).toBeGreaterThan(MIN_SAMPLE_CONTENT_LENGTH);
    });

    // Data-driven test for expected content elements
    test('sample content should include expected elements', async ({ page }) => {
      const content = await page.evaluate(browserLoadWelcomePageAndWait, WAIT_TIMES.MEDIUM);

      // Check main heading
      expect(content).toContain(EXPECTED_CONTENT.mainHeading);

      // Check all sub-headings
      for (const heading of EXPECTED_CONTENT.subHeadings) {
        expect(content).toContain(heading);
      }
    });

    test('sample content should include code blocks with various languages', async ({ page }) => {
      const content = await page.evaluate(browserLoadWelcomePageAndWait, WAIT_TIMES.MEDIUM);

      for (const codeBlock of EXPECTED_CONTENT.codeBlocks) {
        expect(content).toContain(codeBlock);
      }
    });

    test('sample content should include mermaid diagram blocks', async ({ page }) => {
      const content = await page.evaluate(browserLoadWelcomePageAndWait, WAIT_TIMES.MEDIUM);

      for (const mermaidElement of EXPECTED_CONTENT.mermaidElements) {
        expect(content).toContain(mermaidElement);
      }
    });

    test('sample content should include markdown tables', async ({ page }) => {
      const content = await page.evaluate(browserLoadWelcomePageAndWait, WAIT_TIMES.MEDIUM);

      for (const tableMarker of EXPECTED_CONTENT.tableMarkers) {
        expect(content).toContain(tableMarker);
      }
    });
  });

  test.describe('Preview Rendering', () => {
    const MIN_PREVIEW_LENGTH = 0;

    const RENDERED_ELEMENTS = [
      { selector: 'h1', description: 'headings (h1)' },
      { selector: 'h2', description: 'headings (h2)' },
      { selector: 'table', description: 'tables' },
      { selector: 'pre', description: 'code blocks' }
    ];

    test('markdown should be rendered in preview after loading sample', async ({ page }) => {
      await page.click('button[onclick="loadWelcomePage()"]');
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const previewHTML = await page.$eval('#wrapper', el => el.innerHTML);
      expect(previewHTML.length).toBeGreaterThan(MIN_PREVIEW_LENGTH);

      // Check all expected elements exist
      for (const element of RENDERED_ELEMENTS) {
        expect(previewHTML).toContain(`<${element.selector}`);
      }
    });

    test('preview should contain rendered headings from sample', async ({ page }) => {
      await page.click('button[onclick="loadWelcomePage()"]');
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const [hasMainHeading, hasSubHeadings] = await Promise.all([
        page.$eval('#wrapper', el =>
          el.textContent.includes('Welcome to Merview')
        ),
        page.$eval('#wrapper', el => {
          const text = el.textContent;
          return text.includes('Quick Links') &&
                 text.includes('Getting Started') &&
                 text.includes('Feature Showcase');
        })
      ]);

      expect(hasMainHeading).toBe(true);
      expect(hasSubHeadings).toBe(true);
    });

    test('preview should contain syntax-highlighted code blocks', async ({ page }) => {
      await page.click('button[onclick="loadWelcomePage()"]');
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG + WAIT_TIMES.LONG);

      const hasCodeBlocks = await page.evaluate(() => {
        const codeBlocks = document.querySelectorAll('#wrapper pre code');
        return codeBlocks.length > 0;
      });
      expect(hasCodeBlocks).toBe(true);
    });

    test('preview should contain rendered mermaid diagrams', async ({ page }) => {
      await page.click('button[onclick="loadWelcomePage()"]');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      const hasMermaidDiagrams = await page.evaluate(() => {
        const minDiagrams = 0;
        const mermaidElements = document.querySelectorAll('#wrapper .mermaid svg');
        return mermaidElements.length > minDiagrams;
      });
      expect(hasMermaidDiagrams).toBe(true);
    });

    test('preview should contain rendered tables', async ({ page }) => {
      await page.click('button[onclick="loadWelcomePage()"]');
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const hasTables = await page.evaluate(() => {
        const minTables = 0;
        const tables = document.querySelectorAll('#wrapper table');
        return tables.length > minTables;
      });
      expect(hasTables).toBe(true);
    });
  });

  test.describe('Edge Cases', () => {
    const MIN_CONTENT_LENGTH = 0;
    const MIN_PREVIEW_LENGTH = 100;

    test('loading sample when editor already has content should replace it', async ({ page }) => {
      await setCodeMirrorContent(page, '# Initial Content\n\nThis is some initial content.');
      await page.waitForTimeout(WAIT_TIMES.SHORT);

      const initialContent = await getCodeMirrorContent(page);
      expect(initialContent).toContain('Initial Content');

      await page.click('button[onclick="loadWelcomePage()"]');
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      const newContent = await getCodeMirrorContent(page);
      expect(newContent).not.toContain('Initial Content');
      expect(newContent).toContain('Welcome to Merview');
    });

    test('loading sample multiple times should work consistently', async ({ page }) => {
      // First load
      const firstLoad = await page.evaluate(browserLoadWelcomePageAndWait, WAIT_TIMES.MEDIUM);

      // Wait a bit, then second load
      await page.waitForTimeout(WAIT_TIMES.SHORT);
      const secondLoad = await page.evaluate(browserLoadWelcomePageAndWait, WAIT_TIMES.MEDIUM);

      expect(firstLoad).toBe(secondLoad);
      expect(firstLoad.length).toBeGreaterThan(MIN_CONTENT_LENGTH);
    });

    test('loading sample should trigger re-render of preview', async ({ page }) => {
      await clearCodeMirrorContent(page);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      const initialPreview = await page.$eval('#wrapper', el => el.innerHTML.trim());

      await page.click('button[onclick="loadWelcomePage()"]');
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG + WAIT_TIMES.LONG);

      const newPreview = await page.$eval('#wrapper', el => el.innerHTML.trim());

      expect(initialPreview.length).toBeLessThan(newPreview.length);
      expect(newPreview.length).toBeGreaterThan(MIN_PREVIEW_LENGTH);
    });

    test('sample content should be valid markdown', async ({ page }) => {
      const EVEN_BACKTICK_COUNT_DIVISOR = 2;

      const content = await page.evaluate(browserLoadWelcomePageAndWait, WAIT_TIMES.MEDIUM);

      // Basic markdown validation checks
      expect(content).toMatch(/^#\s/m);

      // Code blocks should be properly closed
      const backtickMatches = content.match(/```/g);
      expect(backtickMatches).not.toBeNull();
      expect(backtickMatches.length % EVEN_BACKTICK_COUNT_DIVISOR).toBe(0);

      // Should have proper list syntax
      expect(content).toMatch(/^[-*]\s/m);
      expect(content).toMatch(/^\d+\.\s/m);
    });
  });

  test.describe('Integration', () => {
    test('sample loading should work after editor has content', async ({ page }) => {
      await setCodeMirrorContent(page, '# My Document\n\nSome initial content.');
      await page.waitForTimeout(WAIT_TIMES.SHORT);

      await page.click('button[onclick="loadWelcomePage()"]');
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      const content = await getCodeMirrorContent(page);
      expect(content).toContain('Welcome to Merview');
      expect(content).not.toContain('My Document');
    });

    test('sample content should render with current style theme', async ({ page }) => {
      await page.click('button[onclick="loadWelcomePage()"]');
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG + WAIT_TIMES.LONG);

      const wrapperExists = await page.evaluate(() => {
        const wrapper = document.getElementById('wrapper');
        if (!wrapper) return false;

        const hasContent = wrapper.innerHTML.length > 0;
        const hasStyles = getComputedStyle(wrapper).display !== '';

        return hasContent && hasStyles;
      });

      expect(wrapperExists).toBe(true);
    });

    test('welcome page loads from actual docs/welcome.md file (not mocked)', async ({ page }) => {
      // Clear cache to ensure we fetch the real file (with guard for function availability)
      await page.evaluate(() => {
        if (typeof globalThis.clearWelcomePageCache === 'function') {
          globalThis.clearWelcomePageCache();
        }
      });

      // Load welcome page without any mocking - this fetches the real file
      await page.click('button[onclick="loadWelcomePage()"]');

      // Wait for content to actually load (more reliable than fixed timeout)
      // Use CONTENT_LOAD * 2.5 as max timeout to handle slow CI environments
      await page.waitForFunction(() => {
        const cmElement = document.querySelector('.CodeMirror');
        const cmEditor = cmElement?.CodeMirror;
        const content = cmEditor?.getValue() || '';
        return content.includes('# Welcome to Merview');
      }, { timeout: WAIT_TIMES.CONTENT_LOAD * 2.5 });

      const content = await getCodeMirrorContent(page);

      // Verify main heading and all sub-headings using EXPECTED_CONTENT constant
      expect(content).toContain(EXPECTED_CONTENT.mainHeading);
      for (const heading of EXPECTED_CONTENT.subHeadings) {
        expect(content).toContain(heading);
      }

      // Verify tagline that proves it's the real file
      expect(content).toContain('A client-side Markdown editor with first-class Mermaid diagram support.');

      // Verify specific structural elements that prove it's the real file
      expect(content).toContain('[About Merview](/?url=docs/about.md)');
      expect(content).toContain('[Developer Kit](/?url=docs/developer-kit.md)');
      expect(content).toContain('[Theme Guide](/?url=docs/themes.md)');
      expect(content).toContain('github.com/mickdarling/merview');

      // Verify mermaid diagrams using EXPECTED_CONTENT constant
      for (const mermaidElement of EXPECTED_CONTENT.mermaidElements) {
        expect(content).toContain(mermaidElement);
      }

      // Verify code examples using EXPECTED_CONTENT constant
      for (const codeBlock of EXPECTED_CONTENT.codeBlocks) {
        expect(content).toContain(codeBlock);
      }
      expect(content).toContain('```markdown');

      // Verify table structure using EXPECTED_CONTENT constant
      for (const tableMarker of EXPECTED_CONTENT.tableMarkers) {
        expect(content).toContain(tableMarker);
      }

      // Verify the content is substantial (real file should be much larger than fallback)
      expect(content.length).toBeGreaterThan(EXPECTED_CONTENT.minRealFileSize);
    });
  });

  test.describe('Caching', () => {
    test('loadWelcomePage() should use cached content on subsequent calls', async ({ page }) => {
      // Clear cache to start fresh
      await page.evaluate(() => globalThis.clearWelcomePageCache());

      // Track fetch calls
      let fetchCount = 0;
      await page.route('**/docs/welcome.md', async route => {
        fetchCount++;
        await route.continue();
      });

      // First call should fetch
      await page.evaluate(async () => await globalThis.loadWelcomePage());
      await page.waitForTimeout(WAIT_TIMES.SHORT);
      expect(fetchCount).toBe(1);

      // Second call should use cache (no additional fetch)
      await page.evaluate(async () => await globalThis.loadWelcomePage());
      await page.waitForTimeout(WAIT_TIMES.SHORT);
      expect(fetchCount).toBe(1); // Still 1, not 2

      // Third call should also use cache
      await page.evaluate(async () => await globalThis.loadWelcomePage());
      await page.waitForTimeout(WAIT_TIMES.SHORT);
      expect(fetchCount).toBe(1); // Still 1
    });

    test('clearWelcomePageCache() should force re-fetch', async ({ page }) => {
      // Clear cache to start fresh
      await page.evaluate(() => globalThis.clearWelcomePageCache());

      // Track fetch calls
      let fetchCount = 0;
      await page.route('**/docs/welcome.md', async route => {
        fetchCount++;
        await route.continue();
      });

      // First call should fetch
      await page.evaluate(async () => await globalThis.loadWelcomePage());
      await page.waitForTimeout(WAIT_TIMES.SHORT);
      expect(fetchCount).toBe(1);

      // Clear cache
      await page.evaluate(() => globalThis.clearWelcomePageCache());

      // Next call should fetch again
      await page.evaluate(async () => await globalThis.loadWelcomePage());
      await page.waitForTimeout(WAIT_TIMES.SHORT);
      expect(fetchCount).toBe(2);
    });

    test('concurrent loadWelcomePage() calls should not cause issues', async ({ page }) => {
      // Clear cache to start fresh
      await page.evaluate(() => globalThis.clearWelcomePageCache());

      // Track fetch calls
      let fetchCount = 0;
      await page.route('**/docs/welcome.md', async route => {
        fetchCount++;
        // Add small delay to simulate network latency
        await delay(50);
        await route.continue();
      });

      // Fire multiple concurrent calls
      await page.evaluate(async () => {
        await Promise.all([
          globalThis.loadWelcomePage(),
          globalThis.loadWelcomePage(),
          globalThis.loadWelcomePage()
        ]);
      });

      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      // Verify content loaded correctly (should contain welcome content)
      const editorContent = await getCodeMirrorContent(page);
      expect(editorContent).toContain('# Welcome to Merview');

      // Editor should still be functional
      const editorWorks = await page.evaluate(() => {
        const cmElement = document.querySelector('.CodeMirror');
        return cmElement?.CodeMirror !== undefined;
      });
      expect(editorWorks).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('loadWelcomePage() should handle missing file gracefully', async ({ page }) => {
      // Set up initial content to verify it's preserved on error
      await setCodeMirrorContent(page, '# Initial Content');
      await page.waitForTimeout(WAIT_TIMES.SHORT);

      // Mock fetch to return 404 for the welcome page
      await page.route('**/docs/welcome.md', route => route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Not Found'
      }));

      // Attempt to load welcome page - should handle error gracefully
      const result = await page.evaluate(async () => {
        try {
          await globalThis.loadWelcomePage();
          return { threw: false };
        } catch (error) {
          return { threw: true, message: error.message };
        }
      });

      // The function should not throw - it handles errors internally
      expect(result.threw).toBe(false);

      // Wait for any status message to appear
      await page.waitForTimeout(WAIT_TIMES.SHORT);

      // Verify the app didn't crash - editor should still be functional
      const editorStillWorks = await page.evaluate(() => {
        const cmElement = document.querySelector('.CodeMirror');
        return cmElement?.CodeMirror !== undefined;
      });
      expect(editorStillWorks).toBe(true);
    });

    test('loadWelcomePage() should handle network failure gracefully', async ({ page }) => {
      // Mock fetch to simulate network failure
      await page.route('**/docs/welcome.md', route => route.abort('failed'));

      // Attempt to load welcome page - should handle error gracefully
      const result = await page.evaluate(async () => {
        try {
          await globalThis.loadWelcomePage();
          return { threw: false };
        } catch (error) {
          return { threw: true, message: error.message };
        }
      });

      // The function should not throw - it handles errors internally
      expect(result.threw).toBe(false);

      // Verify the app didn't crash - editor should still be functional
      const editorStillWorks = await page.evaluate(() => {
        const cmElement = document.querySelector('.CodeMirror');
        return cmElement?.CodeMirror !== undefined;
      });
      expect(editorStillWorks).toBe(true);
    });

    test('should show error status and load fallback content on fetch failure', async ({ page }) => {
      // Clear the editor and cache first
      await clearCodeMirrorContent(page);
      await page.evaluate(() => globalThis.clearWelcomePageCache());
      await page.waitForTimeout(WAIT_TIMES.SHORT);

      // Track status messages shown
      const statusMessages = [];
      await setupStatusMessageCapture(page, statusMessages);

      // Mock fetch to fail
      await page.route('**/docs/welcome.md', route => route.abort('failed'));

      // Attempt to load welcome page
      await page.evaluate(async () => await globalThis.loadWelcomePage());

      // Wait for content to load
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      // Verify fallback content is loaded in editor
      const editorContent = await getCodeMirrorContent(page);
      expect(editorContent).toContain('# Welcome to Merview');
      expect(editorContent).toContain('Unable to load full welcome page');
      expect(editorContent).toContain('Quick Start');

      // Verify error status was shown at some point
      const errorShown = statusMessages.some(msg => msg.includes('Error loading welcome page'));
      expect(errorShown).toBe(true);
    });

    test('fallback content should render correctly in preview', async ({ page }) => {
      // Clear the editor and cache first
      await clearCodeMirrorContent(page);
      await page.evaluate(() => globalThis.clearWelcomePageCache());
      await page.waitForTimeout(WAIT_TIMES.SHORT);

      // Mock fetch to fail (404)
      await page.route('**/docs/welcome.md', route => route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Not Found'
      }));

      // Attempt to load welcome page
      await page.evaluate(async () => await globalThis.loadWelcomePage());

      // Wait for content to render
      await page.waitForTimeout(WAIT_TIMES.LONG);

      // Verify fallback content includes all expected elements
      const editorContent = await getCodeMirrorContent(page);
      expect(editorContent).toContain('# Welcome to Merview');
      expect(editorContent).toContain('client-side Markdown editor');
      expect(editorContent).toContain('## Quick Start');
      expect(editorContent).toContain('mermaid code blocks'); // Mentions mermaid in instructions
      expect(editorContent).toContain('github.com/mickdarling/merview');

      // Verify fallback renders in preview
      const previewContent = await page.$eval('#wrapper', el => el.innerHTML);
      expect(previewContent).toContain('<h1');
      expect(previewContent).toContain('Welcome to Merview');
      expect(previewContent).toContain('<h2');
      expect(previewContent).toContain('Quick Start');
      expect(previewContent).toContain('<a');
      expect(previewContent).toContain('GitHub');
    });
  });
});
