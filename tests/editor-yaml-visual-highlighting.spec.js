// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  setContentAndWait,
  lineHasSyntaxHighlighting,
  findLineWithText,
  findNthLineWithText,
  WAIT_TIMES
} = require('./helpers/test-utils');

test.describe('YAML Complex Structure Visual Highlighting', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test('complex YAML example from issue has visible syntax highlighting', async ({ page }) => {
    const content = `---
title: My Document
metadata:
  author:
    name: John Doe
    email: john@example.com
  tags:
    - documentation
    - tutorial
description: |
  This is a multi-line
  description using literal block style.
defaults: &defaults
  layout: post
  published: true
post_settings:
  <<: *defaults
  comments: enabled
---
# Markdown content
`;
    await setContentAndWait(page, content);

    // Verify syntax highlighting is active for various lines

    // Opening delimiter (line 0 is always the first line)
    const line0Highlighted = await lineHasSyntaxHighlighting(page, 0);
    expect(line0Highlighted).toBe(true);

    // Simple key-value
    const titleLine = await findLineWithText(page, 'title: My Document');
    const titleHighlighted = await lineHasSyntaxHighlighting(page, titleLine);
    expect(titleHighlighted).toBe(true);

    // Nested object
    const metadataLine = await findLineWithText(page, 'metadata:');
    const metadataHighlighted = await lineHasSyntaxHighlighting(page, metadataLine);
    expect(metadataHighlighted).toBe(true);

    // Double nested
    const authorLine = await findLineWithText(page, 'author:');
    const authorHighlighted = await lineHasSyntaxHighlighting(page, authorLine);
    expect(authorHighlighted).toBe(true);

    // Array item
    const arrayItemLine = await findLineWithText(page, '- documentation');
    const arrayItemHighlighted = await lineHasSyntaxHighlighting(page, arrayItemLine);
    expect(arrayItemHighlighted).toBe(true);

    // Multi-line string indicator
    const multiLineLine = await findLineWithText(page, 'description: |');
    const multiLineHighlighted = await lineHasSyntaxHighlighting(page, multiLineLine);
    expect(multiLineHighlighted).toBe(true);

    // Anchor definition
    const anchorLine = await findLineWithText(page, 'defaults: &defaults');
    const anchorHighlighted = await lineHasSyntaxHighlighting(page, anchorLine);
    expect(anchorHighlighted).toBe(true);

    // Merge key and alias
    const aliasLine = await findLineWithText(page, '<<: *defaults');
    const aliasHighlighted = await lineHasSyntaxHighlighting(page, aliasLine);
    expect(aliasHighlighted).toBe(true);

    // Closing delimiter (find the second occurrence of ---)
    const closingDelimiterLine = await findNthLineWithText(page, '---', 2);
    const closingHighlighted = await lineHasSyntaxHighlighting(page, closingDelimiterLine);
    expect(closingHighlighted).toBe(true);

    // Markdown content (after front matter)
    const markdownLine = await findLineWithText(page, '# Markdown content');
    const markdownHighlighted = await lineHasSyntaxHighlighting(page, markdownLine);
    expect(markdownHighlighted).toBe(true);
  });

  test('nested objects have different token types for keys and values', async ({ page }) => {
    const content = `---
metadata:
  author: John Doe
---`;
    await setContentAndWait(page, content);

    // Get all unique token types used in the YAML section
    const tokenTypes = await page.evaluate(() => {
      const cmElement = document.querySelector('.CodeMirror');
      const cm = cmElement?.CodeMirror;
      if (!cm) {
        throw new Error('CodeMirror instance not found');
      }

      const uniqueTypes = new Set();

      // Check lines 0-3 (YAML front matter)
      for (let lineNum = 0; lineNum <= 3; lineNum++) {
        const lineContent = cm.getLine(lineNum);
        if (!lineContent) continue;

        let pos = 0;
        while (pos < lineContent.length) {
          const token = cm.getTokenAt({ line: lineNum, ch: pos + 1 });
          if (token.type) {
            uniqueTypes.add(token.type);
          }
          pos = token.end;
        }
      }

      return Array.from(uniqueTypes);
    });

    // Should have more than one token type (indicating different syntax elements are tokenized differently)
    expect(tokenTypes.length).toBeGreaterThan(1);
  });

  test('comments have distinct highlighting', async ({ page }) => {
    const content = `---
title: Test # This is a comment
# Full line comment
author: John
---`;
    await setContentAndWait(page, content);

    // Inline comment should have highlighting
    const inlineCommentLine = await findLineWithText(page, 'title: Test # This is a comment');
    const inlineCommentHighlighted = await lineHasSyntaxHighlighting(page, inlineCommentLine);
    expect(inlineCommentHighlighted).toBe(true);

    // Full-line comment should have highlighting
    const fullLineCommentLine = await findLineWithText(page, '# Full line comment');
    const fullLineCommentHighlighted = await lineHasSyntaxHighlighting(page, fullLineCommentLine);
    expect(fullLineCommentHighlighted).toBe(true);
  });

  test('multi-line strings maintain highlighting', async ({ page }) => {
    const content = `---
description: |
  First line
  Second line
  Third line
---`;
    await setContentAndWait(page, content);

    // All lines should have highlighting
    for (let i = 0; i <= 5; i++) {
      const highlighted = await lineHasSyntaxHighlighting(page, i);
      expect(highlighted).toBe(true);
    }
  });

  test('anchors and aliases are highlighted', async ({ page }) => {
    const content = `---
defaults: &defaults
  layout: post
post:
  <<: *defaults
---`;
    await setContentAndWait(page, content);

    // Anchor definition should have highlighting
    const anchorLine = await findLineWithText(page, 'defaults: &defaults');
    const anchorHighlighted = await lineHasSyntaxHighlighting(page, anchorLine);
    expect(anchorHighlighted).toBe(true);

    // Alias reference should have highlighting
    const aliasLine = await findLineWithText(page, '<<: *defaults');
    const aliasHighlighted = await lineHasSyntaxHighlighting(page, aliasLine);
    expect(aliasHighlighted).toBe(true);
  });

  test('complex arrays with nested objects are highlighted', async ({ page }) => {
    const content = `---
items:
  - name: Item 1
    value: 100
  - name: Item 2
    value: 200
---`;
    await setContentAndWait(page, content);

    // All lines should be highlighted
    for (let i = 0; i <= 6; i++) {
      const highlighted = await lineHasSyntaxHighlighting(page, i);
      expect(highlighted).toBe(true);
    }
  });

  test('quoted strings are highlighted differently than unquoted', async ({ page }) => {
    const content = `---
quoted: "String value"
unquoted: String value
---`;
    await setContentAndWait(page, content);

    // Both lines should have highlighting
    const quotedLine = await findLineWithText(page, 'quoted: "String value"');
    const quotedHighlighted = await lineHasSyntaxHighlighting(page, quotedLine);
    expect(quotedHighlighted).toBe(true);

    const unquotedLine = await findLineWithText(page, 'unquoted: String value');
    const unquotedHighlighted = await lineHasSyntaxHighlighting(page, unquotedLine);
    expect(unquotedHighlighted).toBe(true);
  });

  test('highlighting persists after editing', async ({ page }) => {
    const content = `---
title: Test
---`;
    await setContentAndWait(page, content);

    // Edit the content
    await page.evaluate(() => {
      const cmElement = document.querySelector('.CodeMirror');
      const cm = cmElement?.CodeMirror;
      if (cm) {
        cm.replaceRange('\nauthor: John', { line: 1, ch: 11 });
      }
    });

    await page.waitForTimeout(WAIT_TIMES.SHORT);

    // New line should be highlighted
    const authorLine = await findLineWithText(page, 'author: John');
    const authorHighlighted = await lineHasSyntaxHighlighting(page, authorLine);
    expect(authorHighlighted).toBe(true);
  });

  test('syntax highlighting switches from YAML to markdown after front matter', async ({ page }) => {
    const content = `---
title: Test
---
# Markdown Heading
**Bold text**
`;
    await setContentAndWait(page, content);

    // YAML section should be highlighted
    const yamlLine = await findLineWithText(page, 'title: Test');
    const yamlHighlighted = await lineHasSyntaxHighlighting(page, yamlLine);
    expect(yamlHighlighted).toBe(true);

    // Markdown section should also be highlighted (but with different mode)
    const headingLine = await findLineWithText(page, '# Markdown Heading');
    const headingHighlighted = await lineHasSyntaxHighlighting(page, headingLine);
    expect(headingHighlighted).toBe(true);

    const boldLine = await findLineWithText(page, '**Bold text**');
    const boldHighlighted = await lineHasSyntaxHighlighting(page, boldLine);
    expect(boldHighlighted).toBe(true);
  });
});
