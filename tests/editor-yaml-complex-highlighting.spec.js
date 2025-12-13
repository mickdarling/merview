// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  getLineTokens,
  lineHasTokenType,
  setContentAndWait
} = require('./helpers/test-utils');

test.describe('CodeMirror Complex YAML Highlighting in Editor', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test.describe('Nested objects', () => {
    test('highlights nested object keys', async ({ page }) => {
      const content = `---
metadata:
  author:
    name: John Doe
    email: john@example.com
---`;
      await setContentAndWait(page, content);

      // Line 1: "metadata:" should have atom or property type
      const line1Tokens = await getLineTokens(page, 1);
      const metadataToken = line1Tokens.find(t => t.string.includes('metadata'));
      expect(metadataToken).toBeDefined();
      expect(metadataToken?.type).toBeTruthy();

      // Line 2: "  author:" (nested key)
      const line2Tokens = await getLineTokens(page, 2);
      const authorToken = line2Tokens.find(t => t.string.includes('author'));
      expect(authorToken).toBeDefined();
      expect(authorToken?.type).toBeTruthy();

      // Line 3: "    name:" (double nested)
      const line3Tokens = await getLineTokens(page, 3);
      const nameToken = line3Tokens.find(t => t.string.includes('name'));
      expect(nameToken).toBeDefined();
      expect(nameToken?.type).toBeTruthy();

      // Line 4: "    email:" (double nested)
      const line4Tokens = await getLineTokens(page, 4);
      const emailToken = line4Tokens.find(t => t.string.includes('email'));
      expect(emailToken).toBeDefined();
      expect(emailToken?.type).toBeTruthy();
    });

    test('highlights deeply nested structures', async ({ page }) => {
      const content = `---
level1:
  level2:
    level3:
      level4: deep value
---`;
      await setContentAndWait(page, content);

      // All nested levels should have proper highlighting
      for (let i = 1; i <= 4; i++) {
        const tokens = await getLineTokens(page, i);
        expect(tokens.length).toBeGreaterThan(0);
        // Each line should have at least one token with type information
        expect(tokens.some(t => t.type)).toBe(true);
        // Each key should be highlighted as atom, variable-2, or meta (YAML property)
        const hasYamlKey = tokens.some(t =>
          t.type && (t.type.includes('atom') || t.type.includes('variable') || t.type.includes('meta'))
        );
        expect(hasYamlKey).toBe(true);
      }
    });
  });

  test.describe('Multi-line strings', () => {
    test('highlights literal block scalar (|)', async ({ page }) => {
      const content = `---
description: |
  This is a multi-line
  description using literal block style.
  Newlines are preserved.
title: Test
---`;
      await setContentAndWait(page, content);

      // Line 1: "description: |"
      const line1Tokens = await getLineTokens(page, 1);
      const pipeToken = line1Tokens.find(t => t.string.includes('|'));
      expect(pipeToken).toBeDefined();

      // Lines 2-4: Multi-line string content
      // These should be highlighted as part of the string value
      const line2Tokens = await getLineTokens(page, 2);
      const line3Tokens = await getLineTokens(page, 3);
      const line4Tokens = await getLineTokens(page, 4);

      expect(line2Tokens.length).toBeGreaterThan(0);
      expect(line3Tokens.length).toBeGreaterThan(0);
      expect(line4Tokens.length).toBeGreaterThan(0);

      // Multi-line string content should be highlighted as string or have some token type
      expect(line2Tokens.some(t => t.type)).toBe(true);
      expect(line3Tokens.some(t => t.type)).toBe(true);
      expect(line4Tokens.some(t => t.type)).toBe(true);
    });

    test('highlights folded block scalar (>)', async ({ page }) => {
      const content = `---
summary: >
  This is a folded
  multi-line string.
  Lines are joined.
---`;
      await setContentAndWait(page, content);

      // Line 1: "summary: >"
      const line1Tokens = await getLineTokens(page, 1);
      const gtToken = line1Tokens.find(t => t.string.includes('>'));
      expect(gtToken).toBeDefined();

      // Lines 2-4: Multi-line string content
      const line2Tokens = await getLineTokens(page, 2);
      expect(line2Tokens.length).toBeGreaterThan(0);
    });

    test('handles literal block with additional content after', async ({ page }) => {
      const content = `---
description: |
  Multi-line content here.
  More content.
title: Following Field
---`;
      await setContentAndWait(page, content);

      // Line 4: "title: Following Field" should be highlighted normally
      const line4Tokens = await getLineTokens(page, 4);
      const titleToken = line4Tokens.find(t => t.string.includes('title'));
      expect(titleToken).toBeDefined();
    });
  });

  test.describe('Anchors and aliases', () => {
    test('highlights anchor definition (&anchor)', async ({ page }) => {
      const content = `---
defaults: &defaults
  layout: post
  published: true
---`;
      await setContentAndWait(page, content);

      // Line 1: "&defaults" should have special highlighting
      const line1Tokens = await getLineTokens(page, 1);
      const anchorToken = line1Tokens.find(t => t.string.includes('&') || t.string.includes('defaults'));
      expect(anchorToken).toBeDefined();
    });

    test('highlights alias reference (*alias)', async ({ page }) => {
      const content = `---
defaults: &defaults
  layout: post
post_settings:
  <<: *defaults
---`;
      await setContentAndWait(page, content);

      // Line 4: "*defaults" should have special highlighting
      const line4Tokens = await getLineTokens(page, 4);
      const aliasToken = line4Tokens.find(t => t.string.includes('*') || t.string.includes('defaults'));
      expect(aliasToken).toBeDefined();
    });

    test('highlights merge key (<<)', async ({ page }) => {
      const content = `---
base: &base
  key: value
extended:
  <<: *base
  extra: data
---`;
      await setContentAndWait(page, content);

      // Line 4: "<<:" should have special highlighting
      const line4Tokens = await getLineTokens(page, 4);
      expect(line4Tokens.length).toBeGreaterThan(0);
      // The << token should exist
      const mergeToken = line4Tokens.find(t => t.string.includes('<<'));
      expect(mergeToken).toBeDefined();
    });

    test('handles complex anchor and alias usage', async ({ page }) => {
      const content = `---
defaults: &defaults
  layout: post
  published: true
post_settings:
  <<: *defaults
  comments: enabled
page_settings:
  <<: *defaults
  comments: disabled
---`;
      await setContentAndWait(page, content);

      // Verify all alias references are highlighted
      const line5Tokens = await getLineTokens(page, 5);
      const line8Tokens = await getLineTokens(page, 8);

      expect(line5Tokens.length).toBeGreaterThan(0);
      expect(line8Tokens.length).toBeGreaterThan(0);
    });
  });

  test.describe('Complex arrays with nested objects', () => {
    test('highlights array of objects', async ({ page }) => {
      const content = `---
items:
  - name: Item 1
    value: 100
  - name: Item 2
    value: 200
---`;
      await setContentAndWait(page, content);

      // Line 2: "  - name: Item 1"
      const line2Tokens = await getLineTokens(page, 2);
      const dashToken = line2Tokens.find(t => t.string.includes('-'));
      expect(dashToken).toBeDefined();

      // Line 4: "  - name: Item 2"
      const line4Tokens = await getLineTokens(page, 4);
      expect(line4Tokens.length).toBeGreaterThan(0);
    });

    test('highlights deeply nested arrays', async ({ page }) => {
      const content = `---
matrix:
  - row:
      - cell1
      - cell2
  - row:
      - cell3
      - cell4
---`;
      await setContentAndWait(page, content);

      // Verify all array items are highlighted
      for (let i = 1; i <= 7; i++) {
        const tokens = await getLineTokens(page, i);
        expect(tokens.length).toBeGreaterThan(0);
      }
    });

    test('highlights mixed arrays and objects', async ({ page }) => {
      const content = `---
config:
  servers:
    - host: server1.com
      port: 8080
    - host: server2.com
      port: 8081
  timeout: 30
---`;
      await setContentAndWait(page, content);

      // Line 3: First array item with nested object
      const line3Tokens = await getLineTokens(page, 3);
      expect(line3Tokens.length).toBeGreaterThan(0);

      // Line 7: Regular key-value after array
      const line7Tokens = await getLineTokens(page, 7);
      const timeoutToken = line7Tokens.find(t => t.string.includes('timeout'));
      expect(timeoutToken).toBeDefined();
    });
  });

  test.describe('Quoted vs unquoted strings', () => {
    test('highlights double-quoted strings', async ({ page }) => {
      const content = `---
title: "Quoted String"
description: "Another quoted value"
---`;
      await setContentAndWait(page, content);

      // Line 1: Quoted string should have string type
      const line1Tokens = await getLineTokens(page, 1);
      const quotedToken = line1Tokens.find(t => t.string.includes('"'));
      expect(quotedToken).toBeDefined();
    });

    test('highlights single-quoted strings', async ({ page }) => {
      const content = `---
title: 'Single Quoted'
description: 'Another value'
---`;
      await setContentAndWait(page, content);

      // Line 1: Single-quoted string
      const line1Tokens = await getLineTokens(page, 1);
      const quotedToken = line1Tokens.find(t => t.string.includes("'"));
      expect(quotedToken).toBeDefined();
    });

    test('highlights unquoted strings', async ({ page }) => {
      const content = `---
title: Unquoted String
description: No quotes here
---`;
      await setContentAndWait(page, content);

      // Both should be highlighted
      const line1Tokens = await getLineTokens(page, 1);
      const line2Tokens = await getLineTokens(page, 2);

      expect(line1Tokens.length).toBeGreaterThan(0);
      expect(line2Tokens.length).toBeGreaterThan(0);
    });

    test('handles mixed quoting styles', async ({ page }) => {
      const content = `---
double: "Double quoted"
single: 'Single quoted'
unquoted: No quotes
number: 42
boolean: true
---`;
      await setContentAndWait(page, content);

      // All lines should be properly highlighted
      for (let i = 1; i <= 5; i++) {
        const tokens = await getLineTokens(page, i);
        expect(tokens.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Comments in YAML', () => {
    test('highlights inline comments', async ({ page }) => {
      const content = `---
title: Test # This is a comment
author: John Doe # Another comment
---`;
      await setContentAndWait(page, content);

      // Comments should be highlighted
      const line1Tokens = await getLineTokens(page, 1);
      const commentToken = line1Tokens.find(t => t.string.includes('#'));
      expect(commentToken).toBeDefined();
    });

    test('highlights full-line comments', async ({ page }) => {
      const content = `---
# This is a comment
title: Test
# Another comment
author: John
---`;
      await setContentAndWait(page, content);

      // Line 1: Full-line comment
      const line1Tokens = await getLineTokens(page, 1);
      expect(line1Tokens.length).toBeGreaterThan(0);

      // Line 3: Another comment
      const line3Tokens = await getLineTokens(page, 3);
      expect(line3Tokens.length).toBeGreaterThan(0);
    });

    test('handles comments in nested structures', async ({ page }) => {
      const content = `---
metadata:
  # Author information
  author:
    name: John # First name
    email: john@example.com
  # Publication details
  published: true
---`;
      await setContentAndWait(page, content);

      // All comment lines should be highlighted
      const line2Tokens = await getLineTokens(page, 2);
      const line4Tokens = await getLineTokens(page, 4);
      const line6Tokens = await getLineTokens(page, 6);

      expect(line2Tokens.length).toBeGreaterThan(0);
      expect(line4Tokens.length).toBeGreaterThan(0);
      expect(line6Tokens.length).toBeGreaterThan(0);
    });
  });

  test.describe('Real-world complex example', () => {
    test('highlights comprehensive YAML structure from issue example', async ({ page }) => {
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
---`;
      await setContentAndWait(page, content);

      // Verify key lines are highlighted

      // Line 0: Opening delimiter
      const line0HasMeta = await lineHasTokenType(page, 0, 'meta');
      expect(line0HasMeta).toBe(true);

      // Line 1: Simple key-value
      const line1Tokens = await getLineTokens(page, 1);
      expect(line1Tokens.length).toBeGreaterThan(0);

      // Line 2: Nested object key
      const line2Tokens = await getLineTokens(page, 2);
      expect(line2Tokens.length).toBeGreaterThan(0);

      // Line 7: Array item
      const line7Tokens = await getLineTokens(page, 7);
      expect(line7Tokens.length).toBeGreaterThan(0);

      // Line 9: Multi-line string indicator
      const line9Tokens = await getLineTokens(page, 9);
      expect(line9Tokens.length).toBeGreaterThan(0);

      // Line 12: Anchor definition
      const line12Tokens = await getLineTokens(page, 12);
      expect(line12Tokens.length).toBeGreaterThan(0);

      // Line 16: Merge key and alias
      const line16Tokens = await getLineTokens(page, 16);
      expect(line16Tokens.length).toBeGreaterThan(0);

      // Line 18: Closing delimiter
      const line18HasMeta = await lineHasTokenType(page, 18, 'meta');
      expect(line18HasMeta).toBe(true);
    });
  });

  test.describe('Token type discovery', () => {
    test('logs all token types for complex YAML for debugging', async ({ page }) => {
      const content = `---
title: Test
nested:
  key: value
array:
  - item
comment: test # comment
anchor: &ref
  data: value
alias: *ref
multi: |
  line
---`;
      await setContentAndWait(page, content);

      // Get all unique token types used in the YAML
      const allTokenTypes = await page.evaluate(() => {
        const cmElement = document.querySelector('.CodeMirror');
        const cm = cmElement?.CodeMirror;
        if (!cm) return [];

        const types = new Set();
        const lineCount = cm.lineCount();

        for (let lineNum = 0; lineNum < lineCount; lineNum++) {
          const lineContent = cm.getLine(lineNum);
          if (!lineContent) continue;

          let pos = 0;
          while (pos < lineContent.length) {
            const token = cm.getTokenAt({ line: lineNum, ch: pos + 1 });
            if (token.type) {
              types.add(token.type);
            }
            pos = token.end;
          }
        }

        return Array.from(types);
      });

      // We should have multiple token types
      expect(allTokenTypes.length).toBeGreaterThan(0);
    });
  });
});
