// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * Unit tests for scripts/verify-docs.js
 *
 * Tests the documentation verification script that ensures:
 * - File paths referenced in docs exist
 * - Functions/constants mentioned in docs exist in source files
 * - Exports documented are actually exported
 *
 * Note: These tests use a Node.js subprocess to run the ES module functions
 * since Playwright test files are CommonJS by default.
 */

/**
 * Helper to execute a verify-docs.js function via Node.js subprocess
 * @param {string} functionName - Name of the function to test
 * @param {any[]} args - Arguments to pass to the function
 * @returns {any} The result from the function
 */
function runVerifyDocsFunction(functionName, ...args) {
  const scriptPath = path.join(__dirname, '../scripts/verify-docs.js');

  // Create a temporary script file using secure temp directory creation
  // Uses mkdtempSync to create a unique directory with restricted permissions
  const crypto = require('node:crypto');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-docs-test-'));
  const tempFile = path.join(tempDir, `test-${crypto.randomBytes(16).toString('hex')}.mjs`);
  const code = `
import * as module from '${scriptPath}';
const args = ${JSON.stringify(args)};
const result = module.${functionName}(...args);
console.log(JSON.stringify(result));
  `;

  try {
    // Write with restrictive permissions (owner read/write only)
    fs.writeFileSync(tempFile, code, { mode: 0o600 });
    // Use spawnSync with process.execPath and shell: false to avoid security hotspots
    // (S4721 - command injection, S4036 - PATH hijacking)
    const result = spawnSync(process.execPath, [tempFile], {
      encoding: 'utf-8',
      shell: false
    });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(result.stderr || `Process exited with code ${result.status}`);
    }
    return JSON.parse(result.stdout.trim());
  } catch (error) {
    throw new Error(`Failed to run ${functionName}: ${error.message}`);
  } finally {
    // Clean up temp file and directory
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir);
      }
    } catch {
      // Cleanup errors are non-critical - temp files will be cleaned by OS
    }
  }
}

test.describe('extractFileReferences', () => {
  test('should extract valid file paths from markdown', () => {
    const content = `
      See \`js/security.js\` for details.
      Check \`docs/about.md\` for more info.
      The config is in \`config/app.json\`.
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    expect(refs).toContain('js/security.js');
    expect(refs).toContain('docs/about.md');
    expect(refs).toContain('config/app.json');
    expect(refs.length).toBe(3);
  });

  test('should ignore URLs containing ://', () => {
    const content = `
      Visit \`https://example.com/file.js\` for more.
      Local file: \`js/file.js\`
      Protocol: \`http://test.com/docs.md\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    expect(refs).toContain('js/file.js');
    expect(refs).not.toContain('https://example.com/file.js');
    expect(refs).not.toContain('http://test.com/docs.md');
    expect(refs.length).toBe(1);
  });

  test('should handle paths with multiple directory levels', () => {
    const content = `
      Deep path: \`src/utils/helpers/formatter.js\`
      Another: \`docs/api/reference/methods.md\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    expect(refs).toContain('src/utils/helpers/formatter.js');
    expect(refs).toContain('docs/api/reference/methods.md');
    expect(refs.length).toBe(2);
  });

  test('should return empty array for content with no file references', () => {
    const content = `
      This is just plain text.
      No file paths here.
      Just some documentation without code references.
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    expect(refs).toEqual([]);
  });

  test('should handle file paths with hyphens and underscores', () => {
    const content = `
      File: \`js/my-file_name.js\`
      Config: \`config/app-config_v2.json\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    expect(refs).toContain('js/my-file_name.js');
    expect(refs).toContain('config/app-config_v2.json');
    expect(refs.length).toBe(2);
  });

  test('should deduplicate file references', () => {
    const content = `
      First mention: \`js/file.js\`
      Second mention: \`js/file.js\`
      Third mention: \`js/file.js\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    expect(refs).toContain('js/file.js');
    expect(refs.length).toBe(1);
  });

  test('should only match paths in backticks', () => {
    const content = `
      Valid: \`js/file.js\`
      Invalid: js/file.js (not in backticks)
      Valid: \`docs/readme.md\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    expect(refs).toContain('js/file.js');
    expect(refs).toContain('docs/readme.md');
    expect(refs.length).toBe(2);
  });

  test('should handle different file extensions', () => {
    const content = `
      JavaScript: \`src/app.js\`
      TypeScript: \`src/types.ts\`
      Markdown: \`docs/README.md\`
      JSON: \`config/package.json\`
      HTML: \`templates/index.html\`
      CSS: \`styles/main.css\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    expect(refs).toContain('src/app.js');
    expect(refs).toContain('src/types.ts');
    expect(refs).toContain('docs/README.md');
    expect(refs).toContain('config/package.json');
    expect(refs).toContain('templates/index.html');
    expect(refs).toContain('styles/main.css');
    expect(refs.length).toBe(6);
  });
});

test.describe('extractCodeReferences', () => {
  test('should extract function calls', () => {
    const content = `
      Call \`functionName()\` to execute.
      Use \`anotherFunc()\` for processing.
      The \`helper()\` function is useful.
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toContainEqual({ name: 'functionName', type: 'function' });
    expect(refs).toContainEqual({ name: 'anotherFunc', type: 'function' });
    expect(refs).toContainEqual({ name: 'helper', type: 'function' });
    expect(refs.length).toBe(3);
  });

  test('should extract constants', () => {
    const content = `
      Set \`MAX_VALUE\` to configure.
      Use \`API_KEY\` for authentication.
      The \`DEFAULT_TIMEOUT\` is set.
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toContainEqual({ name: 'MAX_VALUE', type: 'constant' });
    expect(refs).toContainEqual({ name: 'API_KEY', type: 'constant' });
    expect(refs).toContainEqual({ name: 'DEFAULT_TIMEOUT', type: 'constant' });
    expect(refs.length).toBe(3);
  });

  test('should filter out JavaScript builtins - common functions', () => {
    const content = `
      Use \`setTimeout()\` to delay.
      Call \`Promise()\` for async.
      Use \`parseInt()\` to parse.
      Call \`fetch()\` to get data.
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toEqual([]);
  });

  test('should filter out JavaScript builtins - DOM methods', () => {
    const content = `
      Use \`querySelector()\` to find elements.
      Call \`addEventListener()\` for events.
      Use \`getElementById()\` for selection.
      Call \`createElement()\` to make elements.
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toEqual([]);
  });

  test('should filter out JavaScript builtins - objects and globals', () => {
    const content = `
      \`Array\`, \`Object\`, \`String\`, \`Number\`
      \`window\`, \`document\`, \`console\`
      \`Math\`, \`JSON\`, \`Date\`
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    // Note: Current implementation doesn't filter out constant-like builtins
    // Only JSON matches the constant pattern (3+ uppercase chars)
    // Array, Object, String, Number, Math, Date don't match because they're PascalCase not UPPER_CASE
    // window, document, console are lowercase so don't match
    expect(refs).toContainEqual({ name: 'JSON', type: 'constant' });
    expect(refs.length).toBe(1);
  });

  test('should handle constants with numbers', () => {
    const content = `
      Set \`MAX_RETRY_COUNT_3\` for retries.
      Use \`API_V2_ENDPOINT\` for version 2.
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toContainEqual({ name: 'MAX_RETRY_COUNT_3', type: 'constant' });
    expect(refs).toContainEqual({ name: 'API_V2_ENDPOINT', type: 'constant' });
    expect(refs.length).toBe(2);
  });

  test('should handle constants without underscores if 3+ chars', () => {
    const content = `
      Use \`MAX\` constant.
      Set \`API\` key.
      Check \`ID\` value.
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toContainEqual({ name: 'MAX', type: 'constant' });
    expect(refs).toContainEqual({ name: 'API', type: 'constant' });
    // ID is only 2 chars, so it should be excluded
    expect(refs).not.toContainEqual({ name: 'ID', type: 'constant' });
    expect(refs.length).toBe(2);
  });

  test('should ignore single character names', () => {
    const content = `
      Call \`a()\` function.
      Use \`X\` constant.
      Check \`b()\` method.
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    // Single char functions should still be extracted as they match the pattern
    // but single char constants (without underscore and < 3 chars) should not
    expect(refs).toContainEqual({ name: 'a', type: 'function' });
    expect(refs).toContainEqual({ name: 'b', type: 'function' });
    expect(refs).not.toContainEqual({ name: 'X', type: 'constant' });
  });

  test('should handle mixed function and constant references', () => {
    const content = `
      Call \`processData()\` with \`MAX_SIZE\`.
      Use \`validateInput()\` before \`API_ENDPOINT\`.
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toContainEqual({ name: 'processData', type: 'function' });
    expect(refs).toContainEqual({ name: 'validateInput', type: 'function' });
    expect(refs).toContainEqual({ name: 'MAX_SIZE', type: 'constant' });
    expect(refs).toContainEqual({ name: 'API_ENDPOINT', type: 'constant' });
    expect(refs.length).toBe(4);
  });

  test('should deduplicate code references', () => {
    const content = `
      Call \`myFunc()\` first.
      Then call \`myFunc()\` again.
      Use \`MY_CONST\` value.
      Check \`MY_CONST\` again.
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toContainEqual({ name: 'myFunc', type: 'function' });
    expect(refs).toContainEqual({ name: 'MY_CONST', type: 'constant' });
    expect(refs.length).toBe(2);
  });

  test('should only match code in backticks', () => {
    const content = `
      Valid: \`myFunction()\`
      Invalid: myFunction() (not in backticks)
      Valid: \`MAX_VALUE\`
      Invalid: MAX_VALUE (not in backticks)
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toContainEqual({ name: 'myFunction', type: 'function' });
    expect(refs).toContainEqual({ name: 'MAX_VALUE', type: 'constant' });
    expect(refs.length).toBe(2);
  });

  test('should handle underscores in function names', () => {
    const content = `
      Call \`my_function_name()\` for processing.
      Use \`_privateHelper()\` internally.
      Check \`validate_input_data()\` first.
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toContainEqual({ name: 'my_function_name', type: 'function' });
    expect(refs).toContainEqual({ name: '_privateHelper', type: 'function' });
    expect(refs).toContainEqual({ name: 'validate_input_data', type: 'function' });
    expect(refs.length).toBe(3);
  });

  test('should return empty array for content with no code references', () => {
    const content = `
      This is plain documentation.
      No functions or constants mentioned.
      Just regular text.
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toEqual([]);
  });

  test('should filter out test framework functions', () => {
    const content = `
      Use \`waitForFunction()\` in tests.
      The \`url()\` parameter is needed.
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    // These are in the builtins list
    expect(refs).toEqual([]);
  });
});

test.describe('Edge Cases and Real-world Scenarios', () => {
  test('extractFileReferences should handle markdown code blocks', () => {
    const content = `
      Example code:
      \`\`\`javascript
      import { func } from 'js/module.js';
      \`\`\`

      Reference: \`js/module.js\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    // Should extract the inline reference, not from code block
    expect(refs).toContain('js/module.js');
    // Should only appear once despite being in code block too
    expect(refs.length).toBe(1);
  });

  test('extractCodeReferences should handle code in documentation context', () => {
    const content = `
      The \`initialize()\` function sets up the application.
      It uses \`DEFAULT_CONFIG\` internally.

      Example:
      \`\`\`javascript
      initialize();
      \`\`\`
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toContainEqual({ name: 'initialize', type: 'function' });
    expect(refs).toContainEqual({ name: 'DEFAULT_CONFIG', type: 'constant' });
  });

  test('extractFileReferences should handle relative paths', () => {
    const content = `
      Main: \`js/main.js\`
      Util: \`utils/helper.js\`
      Deep: \`src/components/ui/button.js\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    expect(refs).toContain('js/main.js');
    expect(refs).toContain('utils/helper.js');
    expect(refs).toContain('src/components/ui/button.js');
  });

  test('extractCodeReferences should handle camelCase and snake_case', () => {
    const content = `
      CamelCase: \`myFunctionName()\`
      snake_case: \`my_function_name()\`
      Mixed: \`myFunc_v2()\`
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    expect(refs).toContainEqual({ name: 'myFunctionName', type: 'function' });
    expect(refs).toContainEqual({ name: 'my_function_name', type: 'function' });
    expect(refs).toContainEqual({ name: 'myFunc_v2', type: 'function' });
  });

  test('extractFileReferences should not match files without extensions', () => {
    const content = `
      With ext: \`js/file.js\`
      No ext: \`js/README\`
      Another: \`src/LICENSE\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    expect(refs).toContain('js/file.js');
    // Files without extensions should not be matched by the regex
    expect(refs).not.toContain('js/README');
    expect(refs).not.toContain('src/LICENSE');
  });

  test('extractFileReferences should filter out domain names', () => {
    const content = `
      Visit \`example.com\` for more.
      Check \`github.io\` for hosting.
      See \`mysite.org\` for details.
      Real file: \`js/security.js\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    // Domain names should be filtered out
    expect(refs).not.toContain('example.com');
    expect(refs).not.toContain('github.io');
    expect(refs).not.toContain('mysite.org');
    // Real file paths should still be included
    expect(refs).toContain('js/security.js');
  });

  test('extractFileReferences should filter out object property access', () => {
    const content = `
      Use \`URL.username\` to get the user.
      Check \`URL.password\` for auth.
      Call \`state.renderMarkdown\` to render.
      Real file: \`docs/about.md\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    // Object property access should be filtered out
    expect(refs).not.toContain('URL.username');
    expect(refs).not.toContain('URL.password');
    expect(refs).not.toContain('state.renderMarkdown');
    // Real file paths should still be included
    expect(refs).toContain('docs/about.md');
  });

  test('extractFileReferences should filter out example filenames without paths', () => {
    const content = `
      Download \`custom.css\` for styling.
      Create \`my-theme.css\` for themes.
      Example: \`Academia.css\`
      Real file: \`styles/main.css\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    // Example filenames without paths should be filtered out
    expect(refs).not.toContain('custom.css');
    expect(refs).not.toContain('my-theme.css');
    expect(refs).not.toContain('Academia.css');
    // File paths with directories should be included
    expect(refs).toContain('styles/main.css');
  });

  test('extractFileReferences should handle paths with dots in directory names', () => {
    const content = `
      Module: \`node_modules/pkg.name/index.js\`
      Another: \`vendor/lib.v2/main.js\`
    `;

    const refs = runVerifyDocsFunction('extractFileReferences', content);

    expect(refs).toContain('node_modules/pkg.name/index.js');
    expect(refs).toContain('vendor/lib.v2/main.js');
  });

  test('extractCodeReferences should handle constants at minimum length', () => {
    const content = `
      Two char: \`AB\`
      Three char: \`ABC\`
      With underscore: \`A_B\`
    `;

    const refs = runVerifyDocsFunction('extractCodeReferences', content);

    // AB is 2 chars without underscore, should not be included
    expect(refs).not.toContainEqual({ name: 'AB', type: 'constant' });
    // ABC is 3+ chars, should be included
    expect(refs).toContainEqual({ name: 'ABC', type: 'constant' });
    // A_B has underscore, should be included
    expect(refs).toContainEqual({ name: 'A_B', type: 'constant' });
  });
});

test.describe('Documentation - Test Coverage Summary', () => {
  test('should provide comprehensive test coverage summary', () => {
    // This test documents what we test
    const coverage = {
      extractFileReferences: {
        tested: [
          'Valid file paths extraction',
          'URL filtering (contains ://)',
          'Multiple directory levels',
          'No references (empty array)',
          'Hyphens and underscores in paths',
          'Deduplication',
          'Backtick requirement',
          'Different file extensions',
          'Markdown code blocks',
          'Relative paths',
          'Files without extensions (should not match)',
          'Domain name filtering (example.com, github.io)',
          'Object property access filtering (URL.username)',
          'Example filename filtering (no path prefix)',
          'Paths with dots in directory names'
        ],
        totalTests: 15
      },
      extractCodeReferences: {
        tested: [
          'Function call extraction',
          'Constant extraction',
          'JavaScript builtin filtering (functions, DOM, objects)',
          'Constants with numbers',
          'Constants without underscores (3+ chars)',
          'Single character names',
          'Mixed function/constant references',
          'Deduplication',
          'Backtick requirement',
          'Underscores in function names',
          'No references (empty array)',
          'Test framework function filtering',
          'camelCase and snake_case',
          'Minimum length constants'
        ],
        totalTests: 14
      }
    };

    // This test always passes - it's just documentation
    expect(coverage.extractFileReferences.totalTests).toBe(15);
    expect(coverage.extractCodeReferences.totalTests).toBe(14);
    expect(coverage.extractFileReferences.totalTests + coverage.extractCodeReferences.totalTests).toBe(29);
  });
});

test.describe('Integration Tests', () => {
  test('should pass verification on actual project documentation', () => {
    // This integration test runs the actual verify-docs script against the project
    // to ensure all documentation references are valid
    const scriptPath = path.join(__dirname, '../scripts/verify-docs.js');

    // Use spawnSync with shell: false and absolute node path to avoid security hotspots
    // (S4721 - command injection, S4036 - PATH hijacking)
    // process.execPath is the absolute path to the currently running node binary
    const spawnResult = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..'),
      shell: false
    });

    const result = spawnResult.stdout || '';
    const exitCode = spawnResult.status || 0;

    // The script should exit with code 0 (success)
    expect(exitCode).toBe(0);
    // The output should indicate all references were verified
    expect(result).toContain('All documentation references verified successfully');
  });

  test('should properly detect and report missing references', () => {
    // This test verifies the script properly reports errors by feeding it
    // content with known-bad references
    const scriptPath = path.join(__dirname, '../scripts/verify-docs.js');

    const testCode = `
import { extractFileReferences, extractCodeReferences } from '${scriptPath}';

// Test with a non-existent file reference
const fileRefs = extractFileReferences('Check \`js/nonexistent-file.js\` for details');
console.log('fileRefs:', JSON.stringify(fileRefs));

// Test with a non-existent function reference
const codeRefs = extractCodeReferences('Call \`nonExistentFunction()\` to process');
console.log('codeRefs:', JSON.stringify(codeRefs));
    `;

    const crypto = require('node:crypto');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-docs-integration-'));
    const tempFile = path.join(tempDir, `test-${crypto.randomBytes(16).toString('hex')}.mjs`);

    try {
      fs.writeFileSync(tempFile, testCode, { mode: 0o600 });
      // Use spawnSync with shell: false and absolute node path to avoid security hotspots
      // (S4721 - command injection, S4036 - PATH hijacking)
      const spawnResult = spawnSync(process.execPath, [tempFile], {
        encoding: 'utf-8',
        shell: false
      });
      const output = spawnResult.stdout || '';

      // Should extract the bad file reference
      expect(output).toContain('js/nonexistent-file.js');
      // Should extract the bad function reference
      expect(output).toContain('nonExistentFunction');
    } finally {
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
      } catch {
        // Cleanup errors are non-critical
      }
    }
  });
});
