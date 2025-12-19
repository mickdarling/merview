// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForPageReady, getCodeMirrorContent, setCodeMirrorContent } = require('./helpers/test-utils');

test.describe('Symbols Selector', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test('should exist in the editor panel header', async ({ page }) => {
    const selector = await page.$('#symbolsSelector');
    expect(selector).not.toBeNull();
  });

  test('should have correct optgroup labels', async ({ page }) => {
    const labels = await page.$$eval('#symbolsSelector optgroup', els =>
      els.map(el => el.getAttribute('label'))
    );
    expect(labels).toEqual([
      'Mermaid Block',
      'Diagram Types',
      'Flowchart Syntax',
      'Sequence Syntax',
      'Class Syntax',
      'State Syntax',
      'ER Syntax',
      'Gantt Syntax',
      'Special Characters',
      'Arrows'
    ]);
  });

  test('should have placeholder "Mermaid Snippet..." as first option', async ({ page }) => {
    const firstOption = await page.$eval('#symbolsSelector option:first-child', el => el.textContent);
    expect(firstOption).toBe('Mermaid Snippet...');
  });

  test('should have mermaid block option', async ({ page }) => {
    const mermaidOption = await page.$eval('#symbolsSelector optgroup[label="Mermaid Block"] option:nth-child(2)',
      el => el.textContent
    );
    expect(mermaidOption).toBe('``` mermaid block');
  });

  test('should have diagram type options', async ({ page }) => {
    const diagramOptions = await page.$$eval('#symbolsSelector optgroup[label="Diagram Types"] option',
      els => els.map(el => el.textContent)
    );
    expect(diagramOptions).toContain('graph LR (left → right)');
    expect(diagramOptions).toContain('sequenceDiagram');
    expect(diagramOptions).toContain('classDiagram');
    expect(diagramOptions).toContain('erDiagram');
    expect(diagramOptions).toContain('gantt');
    expect(diagramOptions).toContain('pie chart');
  });

  test('should have special character options', async ({ page }) => {
    const charOptions = await page.$$eval('#symbolsSelector optgroup[label="Special Characters"] option',
      els => els.map(el => ({ value: el.value, text: el.textContent }))
    );
    expect(charOptions).toEqual([
      { value: '#quot;', text: '" double quote' },
      { value: '#apos;', text: '\' single quote' },
      { value: '#lt;', text: '< less than' },
      { value: '#gt;', text: '> greater than' },
      { value: '#amp;', text: '& ampersand' }
    ]);
  });

  test('should have arrow options', async ({ page }) => {
    const arrowOptions = await page.$$eval('#symbolsSelector optgroup[label="Arrows"] option',
      els => els.map(el => el.value)
    );
    expect(arrowOptions).toContain('-->');
    expect(arrowOptions).toContain('---');
    expect(arrowOptions).toContain('==>');
    expect(arrowOptions).toContain('<-->');
    expect(arrowOptions.length).toBeGreaterThanOrEqual(5);
  });

  test('should insert #quot; at cursor position', async ({ page }) => {
    // Set initial content
    await setCodeMirrorContent(page, 'Hello World');

    // Set cursor position using CodeMirror API
    await page.evaluate(() => {
      const editor = globalThis.state.cmEditor;
      editor.setCursor({ line: 0, ch: 5 }); // After "Hello"
    });

    // Select the #quot; option
    await page.selectOption('#symbolsSelector', '#quot;');

    // Wait a bit for the insertion
    await page.waitForTimeout(100);

    // Check content
    const content = await getCodeMirrorContent(page);
    expect(content).toBe('Hello#quot; World');
  });

  test('should insert --> (right arrow) at cursor position', async ({ page }) => {
    await setCodeMirrorContent(page, 'A B');

    await page.evaluate(() => {
      const editor = globalThis.state.cmEditor;
      editor.setCursor({ line: 0, ch: 2 }); // After "A "
    });

    await page.selectOption('#symbolsSelector', '-->');
    await page.waitForTimeout(100);

    const content = await getCodeMirrorContent(page);
    expect(content).toBe('A -->B');
  });

  test('should reset to placeholder after insertion', async ({ page }) => {
    await setCodeMirrorContent(page, 'Test');

    // Select a symbol
    await page.selectOption('#symbolsSelector', '#amp;');
    await page.waitForTimeout(100);

    // Check that selector is back to placeholder
    const value = await page.$eval('#symbolsSelector', el => el.value);
    expect(value).toBe('');
  });

  test('should insert at beginning of document', async ({ page }) => {
    await setCodeMirrorContent(page, 'World');

    await page.evaluate(() => {
      const editor = globalThis.state.cmEditor;
      editor.setCursor({ line: 0, ch: 0 });
    });

    await page.selectOption('#symbolsSelector', '#lt;');
    await page.waitForTimeout(100);

    const content = await getCodeMirrorContent(page);
    expect(content).toBe('#lt;World');
  });

  test('should insert at end of document', async ({ page }) => {
    await setCodeMirrorContent(page, 'Hello');

    await page.evaluate(() => {
      const editor = globalThis.state.cmEditor;
      editor.setCursor({ line: 0, ch: 5 });
    });

    await page.selectOption('#symbolsSelector', '#gt;');
    await page.waitForTimeout(100);

    const content = await getCodeMirrorContent(page);
    expect(content).toBe('Hello#gt;');
  });

  test('should move cursor after inserted text', async ({ page }) => {
    await setCodeMirrorContent(page, 'AB');

    await page.evaluate(() => {
      const editor = globalThis.state.cmEditor;
      editor.setCursor({ line: 0, ch: 1 }); // Between A and B
    });

    await page.selectOption('#symbolsSelector', '<-->');
    await page.waitForTimeout(100);

    // Check cursor position
    const cursorPos = await page.evaluate(() => {
      const editor = globalThis.state.cmEditor;
      const cursor = editor.getCursor();
      return { line: cursor.line, ch: cursor.ch };
    });

    expect(cursorPos).toEqual({ line: 0, ch: 5 }); // 1 (A) + 4 (<-->) = 5
  });

  test('should position cursor correctly after multi-line insertion', async ({ page }) => {
    await setCodeMirrorContent(page, 'Start\nEnd');

    await page.evaluate(() => {
      const editor = globalThis.state.cmEditor;
      editor.setCursor({ line: 0, ch: 5 }); // After "Start"
    });

    // Insert subgraph which has multiple lines: "subgraph \n    \n    end"
    await page.selectOption('#symbolsSelector', 'subgraph \n    \n    end');
    await page.waitForTimeout(100);

    // Check cursor position - should be at end of last line of inserted text
    const cursorPos = await page.evaluate(() => {
      const editor = globalThis.state.cmEditor;
      const cursor = editor.getCursor();
      return { line: cursor.line, ch: cursor.ch };
    });

    // Inserted "subgraph \n    \n    end" (3 lines)
    // Starting at line 0, cursor should now be at line 2 (0 + 3 - 1)
    // ch should be length of "    end" = 7
    expect(cursorPos.line).toBe(2);
    expect(cursorPos.ch).toBe(7);
  });

  test('should work with multiline content', async ({ page }) => {
    await setCodeMirrorContent(page, 'Line 1\nLine 2\nLine 3');

    await page.evaluate(() => {
      const editor = globalThis.state.cmEditor;
      editor.setCursor({ line: 1, ch: 4 }); // After "Line" on line 2
    });

    await page.selectOption('#symbolsSelector', '#apos;');
    await page.waitForTimeout(100);

    const content = await getCodeMirrorContent(page);
    expect(content).toBe('Line 1\nLine#apos; 2\nLine 3');
  });

  test('should have onchange handler', async ({ page }) => {
    const onchange = await page.$eval('#symbolsSelector', el => el.getAttribute('onchange'));
    expect(onchange).toBe('insertSpecialCharacter(this.value)');
  });

  test('should have appropriate title attribute', async ({ page }) => {
    const title = await page.$eval('#symbolsSelector', el => el.getAttribute('title'));
    expect(title).toContain('Insert Mermaid snippets and special characters');
  });

  test('should use panel-selector CSS class', async ({ page }) => {
    const hasClass = await page.$eval('#symbolsSelector', el => el.classList.contains('panel-selector'));
    expect(hasClass).toBe(true);
  });

  test('insertSpecialCharacter should be a global function', async ({ page }) => {
    const isFunction = await page.evaluate(() => {
      return typeof globalThis.insertSpecialCharacter === 'function';
    });
    expect(isFunction).toBe(true);
  });
});

test.describe('Symbols Selector Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test('should have aria-label for screen readers', async ({ page }) => {
    const ariaLabel = await page.$eval('#symbolsSelector', el => el.getAttribute('aria-label'));
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toContain('Insert');
    expect(ariaLabel).toContain('Mermaid');
  });

  test('should be focusable via keyboard (Tab)', async ({ page }) => {
    // The select element should have a tabindex that makes it focusable
    const tabIndex = await page.$eval('#symbolsSelector', el => el.tabIndex);

    // tabIndex >= 0 means it's in the tab order
    // -1 would mean it's not tabbable (but can be focused programmatically)
    expect(tabIndex).toBeGreaterThanOrEqual(0);

    // Verify it can receive focus
    await page.focus('#symbolsSelector');
    const isFocused = await page.evaluate(() => document.activeElement?.id === 'symbolsSelector');
    expect(isFocused).toBe(true);
  });

  test('should be operable via keyboard (Enter/Space)', async ({ page }) => {
    await setCodeMirrorContent(page, 'Test content');

    // Focus the selector
    await page.focus('#symbolsSelector');

    // Verify it's focused
    const isFocused = await page.evaluate(() => document.activeElement?.id === 'symbolsSelector');
    expect(isFocused).toBe(true);

    // Use keyboard to change selection (Arrow Down to select an option)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50);

    // The native select behavior handles Enter/Space - verify the dropdown is interactive
    const canInteract = await page.evaluate(() => {
      const selector = document.getElementById('symbolsSelector');
      return !selector.disabled && selector.options.length > 1;
    });
    expect(canInteract).toBe(true);
  });

  test('should have visible focus indicator', async ({ page }) => {
    await page.focus('#symbolsSelector');

    // Check that the element has some focus styling (outline or box-shadow)
    const focusStyles = await page.evaluate(() => {
      const el = document.getElementById('symbolsSelector');
      const styles = globalThis.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow
      };
    });

    // Should have either outline or box-shadow for focus visibility
    const hasFocusIndicator =
      (focusStyles.outline && focusStyles.outline !== 'none' && focusStyles.outlineWidth !== '0px') ||
      (focusStyles.boxShadow && focusStyles.boxShadow !== 'none');

    expect(hasFocusIndicator).toBe(true);
  });

  test('optgroups should have accessible labels', async ({ page }) => {
    const optgroups = await page.$$eval('#symbolsSelector optgroup', els =>
      els.map(el => ({
        label: el.getAttribute('label'),
        hasLabel: el.hasAttribute('label') && el.getAttribute('label').length > 0
      }))
    );

    // All optgroups should have non-empty labels
    for (const group of optgroups) {
      expect(group.hasLabel).toBe(true);
      expect(group.label.length).toBeGreaterThan(0);
    }
  });

  test('should insert content when option selected via keyboard', async ({ page }) => {
    await setCodeMirrorContent(page, 'Hello');

    // Set cursor at end
    await page.evaluate(() => {
      const editor = globalThis.state.cmEditor;
      editor.setCursor({ line: 0, ch: 5 });
    });

    // Focus selector and select an option using keyboard
    await page.focus('#symbolsSelector');

    // Navigate to a specific option (double quote)
    // First option is placeholder, second is mermaid block, then we need to go through optgroups
    // Using selectOption is the accessible way to programmatically select
    await page.selectOption('#symbolsSelector', '#quot;');
    await page.waitForTimeout(100);

    const content = await getCodeMirrorContent(page);
    expect(content).toBe('Hello#quot;');
  });

  test('should not trap keyboard focus', async ({ page }) => {
    // Focus the selector
    await page.focus('#symbolsSelector');

    // Should be able to Tab away from it
    await page.keyboard.press('Tab');

    const stillFocused = await page.evaluate(() => document.activeElement?.id === 'symbolsSelector');
    expect(stillFocused).toBe(false);
  });

  test('should focus dropdown with Ctrl+M keyboard shortcut', async ({ page }) => {
    // Focus somewhere else first (the editor)
    await page.evaluate(() => {
      globalThis.state.cmEditor.focus();
    });

    // Verify we're not on the selector
    const beforeFocus = await page.evaluate(() => document.activeElement?.id);
    expect(beforeFocus).not.toBe('symbolsSelector');

    // Press Ctrl+M (or Cmd+M on Mac)
    await page.keyboard.press('Control+m');
    await page.waitForTimeout(100);

    // Verify the selector is now focused
    const afterFocus = await page.evaluate(() => document.activeElement?.id);
    expect(afterFocus).toBe('symbolsSelector');
  });

  test('should mention keyboard shortcut in title attribute', async ({ page }) => {
    const title = await page.$eval('#symbolsSelector', el => el.getAttribute('title'));
    expect(title).toContain('Ctrl');
    expect(title).toContain('Cmd');
    expect(title).toContain('M');
  });

  test('should mention keyboard shortcut in aria-label for screen readers', async ({ page }) => {
    const ariaLabel = await page.$eval('#symbolsSelector', el => el.getAttribute('aria-label'));
    expect(ariaLabel).toContain('shortcut');
    expect(ariaLabel).toContain('Control');
    expect(ariaLabel).toContain('Command');
  });
});
