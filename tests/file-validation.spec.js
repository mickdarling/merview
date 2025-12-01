// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests for file validation functionality (Issue #12)
 *
 * The isValidMarkdownFile() function should:
 * - Accept valid markdown MIME types: text/plain, text/markdown, text/x-markdown
 * - Accept empty MIME type (some browsers don't set it for .md files)
 * - Accept files with valid extensions: .md, .markdown, .txt, .text
 * - Reject invalid MIME types like text/html, text/css, text/javascript
 */

/**
 * Helper function to test file validation - eliminates code duplication
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} fileDescriptor - File descriptor with type and name
 * @param {boolean} expectedResult - Expected validation result
 */
async function testFileValidation(page, fileDescriptor, expectedResult) {
  const isValid = await page.evaluate((file) => {
    // @ts-ignore - isValidMarkdownFile is defined in the app
    return !!globalThis.isValidMarkdownFile(file);
  }, fileDescriptor);
  expect(isValid).toBe(expectedResult);
}

test.describe('File Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize
    await page.waitForSelector('.CodeMirror', { timeout: 15000 });
  });

  test.describe('MIME Type Validation', () => {
    // Data-driven tests for valid MIME types
    const validMimeTypes = [
      { type: 'text/plain', name: 'test.md', description: 'text/plain MIME type' },
      { type: 'text/markdown', name: 'test.md', description: 'text/markdown MIME type' },
      { type: 'text/x-markdown', name: 'test.md', description: 'text/x-markdown MIME type' },
      { type: '', name: 'test.md', description: 'empty MIME type (browser compatibility)' }
    ];

    validMimeTypes.forEach(({ type, name, description }) => {
      test(`should accept ${description}`, async ({ page }) => {
        await testFileValidation(page, { type, name }, true);
      });
    });

    // Data-driven tests for invalid MIME types
    const invalidMimeTypes = [
      { type: 'text/html', name: 'test.html', description: 'text/html MIME type' },
      { type: 'text/css', name: 'style.css', description: 'text/css MIME type' },
      { type: 'text/javascript', name: 'script.js', description: 'text/javascript MIME type' },
      { type: 'application/json', name: 'data.json', description: 'application/json MIME type' }
    ];

    invalidMimeTypes.forEach(({ type, name, description }) => {
      test(`should reject ${description}`, async ({ page }) => {
        await testFileValidation(page, { type, name }, false);
      });
    });
  });

  test.describe('File Extension Validation', () => {
    // Data-driven tests for valid extensions
    const validExtensions = [
      { type: 'application/octet-stream', name: 'readme.md', description: '.md extension regardless of MIME type' },
      { type: '', name: 'document.markdown', description: '.markdown extension' },
      { type: '', name: 'notes.txt', description: '.txt extension' },
      { type: '', name: 'document.text', description: '.text extension' },
      { type: '', name: 'README.MD', description: 'uppercase extensions (.MD)' },
      { type: '', name: 'Document.Markdown', description: 'mixed case extensions (.Markdown)' }
    ];

    validExtensions.forEach(({ type, name, description }) => {
      test(`should accept ${description}`, async ({ page }) => {
        await testFileValidation(page, { type, name }, true);
      });
    });

    // Data-driven tests for invalid extensions
    const invalidExtensions = [
      { type: '', name: 'page.html', description: '.html extension without valid MIME' },
      { type: '', name: 'script.js', description: '.js extension' },
      { type: '', name: 'style.css', description: '.css extension' }
    ];

    invalidExtensions.forEach(({ type, name, description }) => {
      test(`should reject ${description}`, async ({ page }) => {
        await testFileValidation(page, { type, name }, false);
      });
    });
  });

  test.describe('Edge Cases', () => {
    // Data-driven tests for edge cases
    const edgeCases = [
      { type: 'text/plain', name: 'README', expected: true, description: 'files with no extension' },
      { type: '', name: 'my.document.notes.md', expected: true, description: 'files with multiple dots in name' },
      { type: 'text/plain', name: 'my document.md', expected: true, description: 'filenames with spaces' },
      { type: '', name: 'file.md.backup', expected: false, description: 'file with .md in middle of name but wrong extension' }
    ];

    edgeCases.forEach(({ type, name, expected, description }) => {
      test(`should handle ${description}`, async ({ page }) => {
        await testFileValidation(page, { type, name }, expected);
      });
    });
  });

  test.describe('Security - Blocked MIME Types', () => {
    // Data-driven tests for security-blocked MIME types
    const blockedMimeTypes = [
      { type: 'text/xml', name: 'data.xml', description: 'text/xml MIME type' },
      { type: 'image/png', name: 'image.png', description: 'image MIME types' },
      { type: 'application/x-httpd-php', name: 'script.php', description: 'application/x-httpd-php' }
    ];

    blockedMimeTypes.forEach(({ type, name, description }) => {
      test(`should reject ${description}`, async ({ page }) => {
        await testFileValidation(page, { type, name }, false);
      });
    });
  });
});
