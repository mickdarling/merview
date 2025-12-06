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
 * Expected content elements in the sample markdown
 */
const EXPECTED_CONTENT = {
  mainHeading: '# Comprehensive Markdown + Mermaid Feature Demo',
  subHeadings: [
    '## Text Formatting',
    '## Lists',
    '## Code Blocks',
    '## Tables',
    '## Mermaid Diagrams',
    '## Blockquotes'
  ],
  codeBlocks: ['```javascript', '```python', '```yaml', '```json'],
  mermaidElements: ['```mermaid', 'graph TD', 'sequenceDiagram', 'classDiagram'],
  tableMarkers: ['| Feature | Status | Priority |', '|---------|--------|----------|']
};

/**
 * Browser-side helper: Load sample and wait for content
 * @param {number} waitTime - Time to wait after loading
 * @returns {Promise<string>} Editor content after loading
 */
async function browserLoadSampleAndGetContent(waitTime) {
  if (typeof globalThis.loadSample === 'function') {
    globalThis.loadSample();
  }

  await new Promise(resolve => setTimeout(resolve, waitTime));

  const cmElement = document.querySelector('.CodeMirror');
  const cmEditor = cmElement?.CodeMirror;
  return cmEditor ? cmEditor.getValue() : '';
}

/**
 * Tests for Load Sample functionality
 *
 * These tests ensure the Load Sample button and loadSample() function work correctly
 * to populate the editor with comprehensive demo content including markdown,
 * code blocks, tables, and mermaid diagrams.
 */
test.describe('Load Sample Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
    await waitForGlobalFunction(page, 'loadSample');
  });

  test.describe('Load Sample Button', () => {
    test('Load Sample button should exist in toolbar', async ({ page }) => {
      const loadSampleButton = await page.$('button[onclick="loadSample()"]');
      expect(loadSampleButton).not.toBeNull();
    });

    test('Load Sample button should have loadSample onclick handler', async ({ page }) => {
      const onclick = await page.$eval('button[onclick="loadSample()"]', el => el.getAttribute('onclick'));
      expect(onclick).toBe('loadSample()');
    });

    test('Load Sample button should be visible and clickable', async ({ page }) => {
      const [isVisible, isEnabled] = await Promise.all([
        page.isVisible('button[onclick="loadSample()"]'),
        page.isEnabled('button[onclick="loadSample()"]')
      ]);

      expect(isVisible).toBe(true);
      expect(isEnabled).toBe(true);
    });
  });

  test.describe('Global Function', () => {
    test('loadSample() function should be globally available', async ({ page }) => {
      const isFunction = await isGlobalFunctionAvailable(page, 'loadSample');
      expect(isFunction).toBe(true);
    });

    test('loadSample() should be callable without errors', async ({ page }) => {
      await clearCodeMirrorContent(page);

      const didExecute = await page.evaluate(() => {
        try {
          globalThis.loadSample();
          return true;
        } catch (error) {
          console.error('loadSample error:', error);
          return false;
        }
      });

      expect(didExecute).toBe(true);
    });
  });

  test.describe('Sample Content Loading', () => {
    test('clicking Load Sample should populate the editor with content', async ({ page }) => {
      await clearCodeMirrorContent(page);
      await page.waitForTimeout(WAIT_TIMES.SHORT);

      const emptyContent = await getCodeMirrorContent(page);
      expect(emptyContent).toBe('');

      await page.click('button[onclick="loadSample()"]');
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      const loadedContent = await getCodeMirrorContent(page);
      expect(loadedContent.length).toBeGreaterThan(0);
    });

    test('editor should not be empty after loading sample', async ({ page }) => {
      const content = await page.evaluate(browserLoadSampleAndGetContent, WAIT_TIMES.MEDIUM);

      expect(content).not.toBe('');
      expect(content.trim().length).toBeGreaterThan(100);
    });

    // Data-driven test for expected content elements
    test('sample content should include expected elements', async ({ page }) => {
      const content = await page.evaluate(browserLoadSampleAndGetContent, WAIT_TIMES.MEDIUM);

      // Check main heading
      expect(content).toContain(EXPECTED_CONTENT.mainHeading);

      // Check all sub-headings
      for (const heading of EXPECTED_CONTENT.subHeadings) {
        expect(content).toContain(heading);
      }
    });

    test('sample content should include code blocks with various languages', async ({ page }) => {
      const content = await page.evaluate(browserLoadSampleAndGetContent, WAIT_TIMES.MEDIUM);

      for (const codeBlock of EXPECTED_CONTENT.codeBlocks) {
        expect(content).toContain(codeBlock);
      }
    });

    test('sample content should include mermaid diagram blocks', async ({ page }) => {
      const content = await page.evaluate(browserLoadSampleAndGetContent, WAIT_TIMES.MEDIUM);

      for (const mermaidElement of EXPECTED_CONTENT.mermaidElements) {
        expect(content).toContain(mermaidElement);
      }
    });

    test('sample content should include markdown tables', async ({ page }) => {
      const content = await page.evaluate(browserLoadSampleAndGetContent, WAIT_TIMES.MEDIUM);

      for (const tableMarker of EXPECTED_CONTENT.tableMarkers) {
        expect(content).toContain(tableMarker);
      }
    });
  });

  test.describe('Preview Rendering', () => {
    const RENDERED_ELEMENTS = [
      { selector: 'h1', description: 'headings (h1)' },
      { selector: 'h2', description: 'headings (h2)' },
      { selector: 'table', description: 'tables' },
      { selector: 'pre', description: 'code blocks' }
    ];

    test('markdown should be rendered in preview after loading sample', async ({ page }) => {
      await page.click('button[onclick="loadSample()"]');
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const previewHTML = await page.$eval('#wrapper', el => el.innerHTML);
      expect(previewHTML.length).toBeGreaterThan(0);

      // Check all expected elements exist
      for (const element of RENDERED_ELEMENTS) {
        expect(previewHTML).toContain(`<${element.selector}`);
      }
    });

    test('preview should contain rendered headings from sample', async ({ page }) => {
      await page.click('button[onclick="loadSample()"]');
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const [hasMainHeading, hasSubHeadings] = await Promise.all([
        page.$eval('#wrapper', el =>
          el.textContent.includes('Comprehensive Markdown + Mermaid Feature Demo')
        ),
        page.$eval('#wrapper', el => {
          const text = el.textContent;
          return text.includes('Text Formatting') &&
                 text.includes('Lists') &&
                 text.includes('Code Blocks');
        })
      ]);

      expect(hasMainHeading).toBe(true);
      expect(hasSubHeadings).toBe(true);
    });

    test('preview should contain syntax-highlighted code blocks', async ({ page }) => {
      await page.click('button[onclick="loadSample()"]');
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG + WAIT_TIMES.LONG);

      const hasCodeBlocks = await page.evaluate(() => {
        const codeBlocks = document.querySelectorAll('#wrapper pre code');
        return codeBlocks.length > 0;
      });
      expect(hasCodeBlocks).toBe(true);
    });

    test('preview should contain rendered mermaid diagrams', async ({ page }) => {
      await page.click('button[onclick="loadSample()"]');
      await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

      const hasMermaidDiagrams = await page.evaluate(() => {
        const mermaidElements = document.querySelectorAll('#wrapper .mermaid svg');
        return mermaidElements.length > 0;
      });
      expect(hasMermaidDiagrams).toBe(true);
    });

    test('preview should contain rendered tables', async ({ page }) => {
      await page.click('button[onclick="loadSample()"]');
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG);

      const hasTables = await page.evaluate(() => {
        const tables = document.querySelectorAll('#wrapper table');
        return tables.length > 0;
      });
      expect(hasTables).toBe(true);
    });
  });

  test.describe('Edge Cases', () => {
    test('loading sample when editor already has content should replace it', async ({ page }) => {
      await setCodeMirrorContent(page, '# Initial Content\n\nThis is some initial content.');
      await page.waitForTimeout(WAIT_TIMES.SHORT);

      const initialContent = await getCodeMirrorContent(page);
      expect(initialContent).toContain('Initial Content');

      await page.click('button[onclick="loadSample()"]');
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      const newContent = await getCodeMirrorContent(page);
      expect(newContent).not.toContain('Initial Content');
      expect(newContent).toContain('Comprehensive Markdown + Mermaid Feature Demo');
    });

    test('loading sample multiple times should work consistently', async ({ page }) => {
      const [firstLoad, secondLoad] = await Promise.all([
        page.evaluate(async (waitTime) => {
          if (typeof globalThis.loadSample === 'function') globalThis.loadSample();
          await new Promise(r => setTimeout(r, waitTime));
          const cm = document.querySelector('.CodeMirror');
          return cm?.CodeMirror?.getValue() || '';
        }, WAIT_TIMES.MEDIUM),
        (async () => {
          await page.waitForTimeout(WAIT_TIMES.MEDIUM + WAIT_TIMES.SHORT);
          if (typeof globalThis.loadSample === 'function') {
            await page.evaluate(() => globalThis.loadSample());
          }
          await page.waitForTimeout(WAIT_TIMES.MEDIUM);
          return getCodeMirrorContent(page);
        })()
      ]);

      expect(firstLoad).toBe(secondLoad);
      expect(firstLoad.length).toBeGreaterThan(0);
    });

    test('loading sample should trigger re-render of preview', async ({ page }) => {
      await clearCodeMirrorContent(page);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      const initialPreview = await page.$eval('#wrapper', el => el.innerHTML.trim());

      await page.click('button[onclick="loadSample()"]');
      await page.waitForTimeout(WAIT_TIMES.EXTRA_LONG + WAIT_TIMES.LONG);

      const newPreview = await page.$eval('#wrapper', el => el.innerHTML.trim());

      expect(initialPreview.length).toBeLessThan(newPreview.length);
      expect(newPreview.length).toBeGreaterThan(100);
    });

    test('sample content should be valid markdown', async ({ page }) => {
      const content = await page.evaluate(browserLoadSampleAndGetContent, WAIT_TIMES.MEDIUM);

      // Basic markdown validation checks
      expect(content).toMatch(/^#\s/m);

      // Code blocks should be properly closed
      const backtickMatches = content.match(/```/g);
      expect(backtickMatches).not.toBeNull();
      expect(backtickMatches.length % 2).toBe(0);

      // Should have proper list syntax
      expect(content).toMatch(/^[-*]\s/m);
      expect(content).toMatch(/^\d+\.\s/m);
    });
  });

  test.describe('Integration', () => {
    test('sample loading should work after editor has content', async ({ page }) => {
      await setCodeMirrorContent(page, '# My Document\n\nSome initial content.');
      await page.waitForTimeout(WAIT_TIMES.SHORT);

      await page.click('button[onclick="loadSample()"]');
      await page.waitForTimeout(WAIT_TIMES.MEDIUM);

      const content = await getCodeMirrorContent(page);
      expect(content).toContain('Comprehensive Markdown + Mermaid Feature Demo');
      expect(content).not.toContain('My Document');
    });

    test('sample content should render with current style theme', async ({ page }) => {
      await page.click('button[onclick="loadSample()"]');
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
  });
});
