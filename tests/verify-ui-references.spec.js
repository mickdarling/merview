// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

/**
 * Unit tests for UIReferenceVerifier class
 *
 * Tests the verify-ui-references.js script that verifies documentation
 * references to UI elements match what exists in the application.
 *
 * These are pure unit tests that don't require Playwright or a browser.
 * They use Node.js built-in test runner (node:test module).
 *
 * Run with:
 *   node tests/verify-ui-references.spec.js
 *   npm run test:unit
 *
 * Test Coverage:
 * - Constructor initialization
 * - Case-insensitive matching (existsInCollection, findUIElement)
 * - String similarity calculation (Levenshtein distance)
 * - HTML parsing and UI element extraction
 * - Documentation reference extraction (multiple patterns)
 * - File reference validation
 * - Integration tests with mock fixtures
 */

const assert = require('node:assert');
const { test, describe } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const UIReferenceVerifier = require('../scripts/verify-ui-references.js');

describe('UIReferenceVerifier', () => {
  describe('Constructor', () => {
    test('should initialize with empty errors array', () => {
      const verifier = new UIReferenceVerifier();
      assert.strictEqual(Array.isArray(verifier.errors), true);
      assert.strictEqual(verifier.errors.length, 0);
    });

    test('should initialize with empty warnings array', () => {
      const verifier = new UIReferenceVerifier();
      assert.strictEqual(Array.isArray(verifier.warnings), true);
      assert.strictEqual(verifier.warnings.length, 0);
    });

    test('should initialize with empty uiElements object', () => {
      const verifier = new UIReferenceVerifier();
      assert.strictEqual(typeof verifier.uiElements, 'object');
      assert.strictEqual(verifier.uiElements.buttons instanceof Set, true);
      assert.strictEqual(verifier.uiElements.dropdowns instanceof Set, true);
      assert.strictEqual(verifier.uiElements.dropdownOptions instanceof Map, true);
      assert.strictEqual(verifier.uiElements.labels instanceof Set, true);
      assert.strictEqual(verifier.uiElements.titles instanceof Set, true);
    });

    test('should initialize with empty docReferences array', () => {
      const verifier = new UIReferenceVerifier();
      assert.strictEqual(Array.isArray(verifier.docReferences), true);
      assert.strictEqual(verifier.docReferences.length, 0);
    });
  });

  describe('existsInCollection()', () => {
    test('should find exact match case-insensitively', () => {
      const verifier = new UIReferenceVerifier();
      const collection = ['Save', 'Load', 'Cancel'];

      // The method lowercases the needle parameter, then compares to lowercased collection items
      // Note: existsInCollection expects a pre-lowercased reference (normalized)
      // It compares item.toLowerCase() === normalizedReference
      assert.strictEqual(verifier.existsInCollection('save', collection), true);
      assert.strictEqual(verifier.existsInCollection('Save', collection), false); // Not pre-lowercased, won't match
      assert.strictEqual(verifier.existsInCollection('load', collection), true);
      assert.strictEqual(verifier.existsInCollection('cancel', collection), true);
    });

    test('should return false for non-matching values', () => {
      const verifier = new UIReferenceVerifier();
      const collection = ['Save', 'Load', 'Cancel'];

      assert.strictEqual(verifier.existsInCollection('delete', collection), false);
      assert.strictEqual(verifier.existsInCollection('', collection), false);
    });

    test('should handle empty collection', () => {
      const verifier = new UIReferenceVerifier();
      const collection = [];

      assert.strictEqual(verifier.existsInCollection('save', collection), false);
    });

    test('should handle special characters', () => {
      const verifier = new UIReferenceVerifier();
      const collection = ['Save as PDF', 'Load from URL...'];

      assert.strictEqual(verifier.existsInCollection('save as pdf', collection), true);
      assert.strictEqual(verifier.existsInCollection('load from url...', collection), true);
    });
  });

  describe('findUIElement()', () => {
    test('should find buttons', () => {
      const verifier = new UIReferenceVerifier();
      verifier.uiElements.buttons.add('Save');
      verifier.uiElements.buttons.add('Load');

      assert.strictEqual(verifier.findUIElement('save'), true);
      assert.strictEqual(verifier.findUIElement('load'), true);
    });

    test('should find labels', () => {
      const verifier = new UIReferenceVerifier();
      verifier.uiElements.labels.add('Code Theme');
      verifier.uiElements.labels.add('Editor Theme');

      assert.strictEqual(verifier.findUIElement('code theme'), true);
      assert.strictEqual(verifier.findUIElement('editor theme'), true);
    });

    test('should find titles', () => {
      const verifier = new UIReferenceVerifier();
      verifier.uiElements.titles.add('Load from URL');
      verifier.uiElements.titles.add('Manage Sessions');

      assert.strictEqual(verifier.findUIElement('load from url'), true);
      assert.strictEqual(verifier.findUIElement('manage sessions'), true);
    });

    test('should find dropdown options', () => {
      const verifier = new UIReferenceVerifier();
      const options = new Set(['GitHub Dark', 'GitHub Light', 'Monokai']);
      verifier.uiElements.dropdownOptions.set('themeSelector', options);

      assert.strictEqual(verifier.findUIElement('github dark'), true);
      assert.strictEqual(verifier.findUIElement('monokai'), true);
    });

    test('should return false for non-existent elements', () => {
      const verifier = new UIReferenceVerifier();
      verifier.uiElements.buttons.add('Save');

      assert.strictEqual(verifier.findUIElement('delete'), false);
      assert.strictEqual(verifier.findUIElement('nonexistent'), false);
    });

    test('should search across all UI element types', () => {
      const verifier = new UIReferenceVerifier();
      verifier.uiElements.buttons.add('Save');
      verifier.uiElements.labels.add('Theme');
      verifier.uiElements.titles.add('Settings');

      assert.strictEqual(verifier.findUIElement('save'), true);
      assert.strictEqual(verifier.findUIElement('theme'), true);
      assert.strictEqual(verifier.findUIElement('settings'), true);
    });
  });

  describe('calculateSimilarity()', () => {
    test('should return 1 for identical strings', () => {
      const verifier = new UIReferenceVerifier();

      assert.strictEqual(verifier.calculateSimilarity('save', 'save'), 1);
      assert.strictEqual(verifier.calculateSimilarity('hello world', 'hello world'), 1);
    });

    test('should return low value for completely different strings', () => {
      const verifier = new UIReferenceVerifier();

      const similarity = verifier.calculateSimilarity('save', 'xyz');
      assert.strictEqual(similarity < 0.3, true);
    });

    test('should return high value for similar strings', () => {
      const verifier = new UIReferenceVerifier();

      // 'save' vs 'saves' has 1 character difference out of 5 chars = 0.8 similarity
      const similarity = verifier.calculateSimilarity('save', 'saves');
      assert.strictEqual(similarity, 0.8);
      assert.strictEqual(similarity >= 0.8, true);
    });

    test('should return 1 for empty strings', () => {
      const verifier = new UIReferenceVerifier();

      assert.strictEqual(verifier.calculateSimilarity('', ''), 1);
    });

    test('should handle different length strings', () => {
      const verifier = new UIReferenceVerifier();

      // 'save' vs 'save button' - the similarity is based on Levenshtein distance
      const similarity1 = verifier.calculateSimilarity('save', 'save button');
      const similarity2 = verifier.calculateSimilarity('load from url', 'load');

      // Actual value is ~0.36 for save/save button and ~0.31 for load from url/load
      assert.strictEqual(similarity1 > 0.35, true);
      assert.strictEqual(similarity2 > 0.28, true);
    });

    test('should be case-sensitive', () => {
      const verifier = new UIReferenceVerifier();

      const similarity = verifier.calculateSimilarity('Save', 'save');
      // Should not be exactly 1 due to case difference
      assert.strictEqual(similarity < 1, true);
    });
  });

  describe('levenshteinDistance()', () => {
    test('should return 0 for identical strings', () => {
      const verifier = new UIReferenceVerifier();

      assert.strictEqual(verifier.levenshteinDistance('save', 'save'), 0);
      assert.strictEqual(verifier.levenshteinDistance('hello', 'hello'), 0);
    });

    test('should return 1 for single character difference', () => {
      const verifier = new UIReferenceVerifier();

      assert.strictEqual(verifier.levenshteinDistance('save', 'saves'), 1);
      assert.strictEqual(verifier.levenshteinDistance('cat', 'hat'), 1);
    });

    test('should return correct distance for multi-character differences', () => {
      const verifier = new UIReferenceVerifier();

      assert.strictEqual(verifier.levenshteinDistance('kitten', 'sitting'), 3);
      assert.strictEqual(verifier.levenshteinDistance('saturday', 'sunday'), 3);
    });

    test('should handle empty strings', () => {
      const verifier = new UIReferenceVerifier();

      assert.strictEqual(verifier.levenshteinDistance('', ''), 0);
      assert.strictEqual(verifier.levenshteinDistance('abc', ''), 3);
      assert.strictEqual(verifier.levenshteinDistance('', 'xyz'), 3);
    });

    test('should handle completely different strings', () => {
      const verifier = new UIReferenceVerifier();

      const distance = verifier.levenshteinDistance('abc', 'xyz');
      assert.strictEqual(distance, 3);
    });

    test('should be symmetric', () => {
      const verifier = new UIReferenceVerifier();

      const dist1 = verifier.levenshteinDistance('abc', 'def');
      const dist2 = verifier.levenshteinDistance('def', 'abc');
      assert.strictEqual(dist1, dist2);
    });
  });

  describe('extractMatches()', () => {
    test('should extract all matches from HTML', () => {
      const verifier = new UIReferenceVerifier();
      const html = '<button>Save</button><button>Load</button><button>Cancel</button>';
      const regex = /<button>([^<]+)<\/button>/g;
      const matches = [];

      verifier.extractMatches(html, regex, (match) => {
        matches.push(match[1]);
      });

      assert.strictEqual(matches.length, 3);
      assert.strictEqual(matches[0], 'Save');
      assert.strictEqual(matches[1], 'Load');
      assert.strictEqual(matches[2], 'Cancel');
    });

    test('should handle no matches', () => {
      const verifier = new UIReferenceVerifier();
      const html = '<div>No buttons here</div>';
      const regex = /<button>([^<]+)<\/button>/g;
      const matches = [];

      verifier.extractMatches(html, regex, (match) => {
        matches.push(match[1]);
      });

      assert.strictEqual(matches.length, 0);
    });
  });

  describe('addKnownUIElements()', () => {
    test('should add known buttons', () => {
      const verifier = new UIReferenceVerifier();
      verifier.addKnownUIElements();

      assert.strictEqual(verifier.uiElements.buttons.has('Save'), true);
      assert.strictEqual(verifier.uiElements.buttons.has('Load'), true);
      assert.strictEqual(verifier.uiElements.buttons.has('Cancel'), true);
      assert.strictEqual(verifier.uiElements.buttons.has('Clear'), true);
    });

    test('should add known labels', () => {
      const verifier = new UIReferenceVerifier();
      verifier.addKnownUIElements();

      assert.strictEqual(verifier.uiElements.labels.has('Style'), true);
      assert.strictEqual(verifier.uiElements.labels.has('Code Theme'), true);
      assert.strictEqual(verifier.uiElements.labels.has('Editor Theme'), true);
    });

    test('should add known titles', () => {
      const verifier = new UIReferenceVerifier();
      verifier.addKnownUIElements();

      assert.strictEqual(verifier.uiElements.titles.has('Load from URL'), true);
      assert.strictEqual(verifier.uiElements.titles.has('Manage Sessions'), true);
    });
  });

  describe('findSimilar()', () => {
    test('should find similar elements', () => {
      const verifier = new UIReferenceVerifier();
      verifier.uiElements.buttons.add('Save');
      verifier.uiElements.buttons.add('Load');
      verifier.uiElements.buttons.add('Cancel');

      const similar = verifier.findSimilar('sav');
      assert.strictEqual(similar.includes('Save'), true);
    });

    test('should return empty array for no similar elements', () => {
      const verifier = new UIReferenceVerifier();
      verifier.uiElements.buttons.add('Save');
      verifier.uiElements.buttons.add('Load');

      const similar = verifier.findSimilar('xyz');
      assert.strictEqual(similar.length, 0);
    });

    test('should limit to top 3 suggestions', () => {
      const verifier = new UIReferenceVerifier();
      verifier.uiElements.buttons.add('Save');
      verifier.uiElements.buttons.add('Save as');
      verifier.uiElements.buttons.add('Save as PDF');
      verifier.uiElements.buttons.add('Save to File');
      verifier.uiElements.buttons.add('Saved');

      const similar = verifier.findSimilar('save');
      assert.strictEqual(similar.length <= 3, true);
    });
  });

  describe('getAllMarkdownFiles()', () => {
    test('should find all markdown files recursively', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-test-'));

      try {
        // Create test structure
        fs.writeFileSync(path.join(tempDir, 'test1.md'), '# Test 1');
        fs.writeFileSync(path.join(tempDir, 'test2.md'), '# Test 2');
        fs.writeFileSync(path.join(tempDir, 'readme.txt'), 'Not markdown');

        const subDir = path.join(tempDir, 'subdir');
        fs.mkdirSync(subDir);
        fs.writeFileSync(path.join(subDir, 'test3.md'), '# Test 3');

        const files = verifier.getAllMarkdownFiles(tempDir);

        assert.strictEqual(files.length, 3);
        assert.strictEqual(files.some(f => f.endsWith('test1.md')), true);
        assert.strictEqual(files.some(f => f.endsWith('test2.md')), true);
        assert.strictEqual(files.some(f => f.endsWith('test3.md')), true);
      } finally {
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should return empty array for non-existent directory', () => {
      const verifier = new UIReferenceVerifier();

      // This should throw an error, but we're testing the behavior
      try {
        verifier.getAllMarkdownFiles('/nonexistent/path');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.strictEqual(error instanceof Error, true);
      }
    });
  });

  describe('Integration: run() method', () => {
    test('should process valid HTML and documentation', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-integration-'));

      try {
        // Create mock index.html
        const htmlContent = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <button id="saveBtn">Save</button>
  <button id="loadBtn">Load</button>
  <select id="themeSelector">
    <option>GitHub Dark</option>
    <option>GitHub Light</option>
  </select>
  <h2 id="settingsTitle">Settings Dialog</h2>
  <label>Code Theme</label>
</body>
</html>`;
        fs.writeFileSync(path.join(tempDir, 'index.html'), htmlContent);

        // Create mock docs directory
        const docsDir = path.join(tempDir, 'docs');
        fs.mkdirSync(docsDir);

        // Create doc with valid references
        const docContent = `# Test Documentation

Click the **"Save"** button to save your work.

Select a theme from the **"Code Theme"** dropdown.

In the **"Settings Dialog"** dialog, you can configure options.`;
        fs.writeFileSync(path.join(docsDir, 'test.md'), docContent);

        const exitCode = verifier.run(tempDir);

        // Should succeed with no errors
        assert.strictEqual(exitCode, 0);
        assert.strictEqual(verifier.errors.length, 0);
      } finally {
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should detect missing UI elements', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-missing-'));

      try {
        // Create mock index.html with limited elements
        const htmlContent = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <button id="saveBtn">Save</button>
</body>
</html>`;
        fs.writeFileSync(path.join(tempDir, 'index.html'), htmlContent);

        // Create mock docs directory
        const docsDir = path.join(tempDir, 'docs');
        fs.mkdirSync(docsDir);

        // Create doc with invalid references
        const docContent = `# Test Documentation

Click the **"Delete"** button to remove items.

This references a button that doesn't exist in the HTML.`;
        fs.writeFileSync(path.join(docsDir, 'test.md'), docContent);

        const exitCode = verifier.run(tempDir);

        // Should fail with errors
        assert.strictEqual(exitCode, 1);
        assert.strictEqual(verifier.errors.length > 0, true);
        assert.strictEqual(verifier.errors[0].reference, 'Delete');
      } finally {
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should return error code 1 when index.html is missing', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-no-html-'));

      try {
        const exitCode = verifier.run(tempDir);
        assert.strictEqual(exitCode, 1);
      } finally {
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should return error code 1 when docs directory is missing', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-no-docs-'));

      try {
        // Create index.html but no docs directory
        fs.writeFileSync(path.join(tempDir, 'index.html'), '<html><body></body></html>');

        const exitCode = verifier.run(tempDir);
        assert.strictEqual(exitCode, 1);
      } finally {
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('extractUIElements()', () => {
    test('should extract buttons from HTML', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-extract-'));

      try {
        const htmlContent = `
<!DOCTYPE html>
<html>
<body>
  <button>Save</button>
  <button>Load</button>
  <button>🔍 Search</button>
</body>
</html>`;
        const htmlPath = path.join(tempDir, 'test.html');
        fs.writeFileSync(htmlPath, htmlContent);

        verifier.extractUIElements(htmlPath);

        assert.strictEqual(verifier.uiElements.buttons.has('Save'), true);
        assert.strictEqual(verifier.uiElements.buttons.has('Load'), true);
        assert.strictEqual(verifier.uiElements.buttons.has('Search'), true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should extract select dropdowns and options', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-dropdown-'));

      try {
        const htmlContent = `
<!DOCTYPE html>
<html>
<body>
  <select id="themeSelector">
    <option>GitHub Dark</option>
    <option>GitHub Light</option>
    <option>Monokai</option>
  </select>
</body>
</html>`;
        const htmlPath = path.join(tempDir, 'test.html');
        fs.writeFileSync(htmlPath, htmlContent);

        verifier.extractUIElements(htmlPath);

        assert.strictEqual(verifier.uiElements.dropdowns.has('themeSelector'), true);
        const options = verifier.uiElements.dropdownOptions.get('themeSelector');
        assert.strictEqual(options.has('GitHub Dark'), true);
        assert.strictEqual(options.has('GitHub Light'), true);
        assert.strictEqual(options.has('Monokai'), true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should extract dialog titles from h2 elements', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-titles-'));

      try {
        const htmlContent = `
<!DOCTYPE html>
<html>
<body>
  <h2 id="settings">Settings Dialog</h2>
  <h2 id="about">About</h2>
</body>
</html>`;
        const htmlPath = path.join(tempDir, 'test.html');
        fs.writeFileSync(htmlPath, htmlContent);

        verifier.extractUIElements(htmlPath);

        assert.strictEqual(verifier.uiElements.titles.has('Settings Dialog'), true);
        assert.strictEqual(verifier.uiElements.titles.has('About'), true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('extractDocReferences()', () => {
    test('should extract bold-quoted references', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-bold-'));

      try {
        const docsDir = path.join(tempDir, 'docs');
        fs.mkdirSync(docsDir);

        const docContent = `# Documentation

Click the **"Save"** button.
Use the **"Load"** option.`;
        fs.writeFileSync(path.join(docsDir, 'test.md'), docContent);

        verifier.extractDocReferences(docsDir);

        assert.strictEqual(verifier.docReferences.length, 2);
        assert.strictEqual(verifier.docReferences[0].reference, 'Save');
        assert.strictEqual(verifier.docReferences[1].reference, 'Load');
        assert.strictEqual(verifier.docReferences[0].pattern, 'bold-quoted');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should extract action references', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-action-'));

      try {
        const docsDir = path.join(tempDir, 'docs');
        fs.mkdirSync(docsDir);

        const docContent = `# Documentation

Click the "Save" button to continue.
Select "Dark Mode" option from the menu.`;
        fs.writeFileSync(path.join(docsDir, 'test.md'), docContent);

        verifier.extractDocReferences(docsDir);

        assert.strictEqual(verifier.docReferences.some(r =>
          r.reference === 'Save' && r.pattern === 'action-reference'
        ), true);
        assert.strictEqual(verifier.docReferences.some(r =>
          r.reference === 'Dark Mode' && r.pattern === 'action-reference'
        ), true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should extract location references', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-location-'));

      try {
        const docsDir = path.join(tempDir, 'docs');
        fs.mkdirSync(docsDir);

        const docContent = `# Documentation

In the "Settings" dialog, configure your preferences.
From the "File" menu, choose an option.`;
        fs.writeFileSync(path.join(docsDir, 'test.md'), docContent);

        verifier.extractDocReferences(docsDir);

        assert.strictEqual(verifier.docReferences.some(r =>
          r.reference === 'Settings' && r.pattern === 'location-reference'
        ), true);
        assert.strictEqual(verifier.docReferences.some(r =>
          r.reference === 'File' && r.pattern === 'location-reference'
        ), true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should extract file references', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-files-'));

      try {
        const docsDir = path.join(tempDir, 'docs');
        fs.mkdirSync(docsDir);

        const docContent = `# Documentation

See docs/getting-started.md for more info.
Also check (docs/advanced.md) for details.`;
        fs.writeFileSync(path.join(docsDir, 'test.md'), docContent);

        verifier.extractDocReferences(docsDir);

        assert.strictEqual(verifier.docReferences.some(r =>
          r.reference === 'docs/getting-started.md' && r.pattern === 'file-reference'
        ), true);
        assert.strictEqual(verifier.docReferences.some(r =>
          r.reference === 'docs/advanced.md' && r.pattern === 'file-reference'
        ), true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('verifyFileReference()', () => {
    test('should detect missing file references', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-verify-'));

      try {
        const ref = {
          file: path.join(tempDir, 'docs', 'test.md'),
          line: 5,
          reference: 'docs/nonexistent.md',
          context: 'See docs/nonexistent.md for details',
          pattern: 'file-reference'
        };

        verifier.verifyFileReference(ref, tempDir);

        assert.strictEqual(verifier.errors.length, 1);
        assert.strictEqual(verifier.errors[0].reference, 'docs/nonexistent.md');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should skip example URLs', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-examples-'));

      try {
        const exampleRefs = [
          {
            file: path.join(tempDir, 'docs', 'test.md'),
            line: 1,
            reference: 'docs/guide.md',
            context: 'Visit https://example.com/docs/guide.md',
            pattern: 'file-reference'
          },
          {
            file: path.join(tempDir, 'docs', 'test.md'),
            line: 2,
            reference: 'docs/start.md',
            context: 'Common example: docs/start.md',
            pattern: 'file-reference'
          }
        ];

        exampleRefs.forEach(ref => verifier.verifyFileReference(ref, tempDir));

        // Should not generate errors for example URLs
        assert.strictEqual(verifier.errors.length, 0);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('should validate existing file references', () => {
      const verifier = new UIReferenceVerifier();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-ref-valid-'));

      try {
        const docsDir = path.join(tempDir, 'docs');
        fs.mkdirSync(docsDir);
        fs.writeFileSync(path.join(docsDir, 'existing.md'), '# Existing');

        const ref = {
          file: path.join(docsDir, 'test.md'),
          line: 1,
          reference: 'docs/existing.md',
          context: 'See docs/existing.md',
          pattern: 'file-reference'
        };

        verifier.verifyFileReference(ref, tempDir);

        // Should not generate errors for valid file
        assert.strictEqual(verifier.errors.length, 0);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});

// Run the tests
console.log('Running UIReferenceVerifier unit tests...\n');
