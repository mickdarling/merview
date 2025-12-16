// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  waitForElementClass
} = require('./helpers/test-utils');

/**
 * Simple integration test for real-time validation (Issue #135)
 *
 * This test verifies that validation is called when content changes
 * and the lint panel is enabled.
 */
test.describe('Lint Panel Real-Time Validation - Simple Integration', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test('validation should be triggered when lint panel is enabled and content changes', async ({ page }) => {
    // Open the lint panel (enables lintEnabled state)
    await page.click('#lintToggle');
    await waitForElementClass(page, '#lintPanel', 'show');

    // Set content with invalid JSON to verify validation runs
    await page.evaluate(async () => {
      const editor = globalThis.state?.cmEditor;
      if (editor) {
        editor.setValue('```json\n{"invalid syntax"\n```');
      }
      // Manually trigger render to test the validation hook
      if (globalThis.renderMarkdown) {
        await globalThis.renderMarkdown();
      }
    });

    // Wait for validation to complete - use waitForFunction instead of fixed timeout
    // to handle system load variations (the validation debounce is 500ms)
    const VALIDATION_TIMEOUT_MS = 3000;
    await page.waitForFunction(
      () => (globalThis.state?.codeIssues?.length || 0) > 0,
      { timeout: VALIDATION_TIMEOUT_MS }
    );

    // Verify validation ran by checking codeIssues were populated
    const hasIssues = await page.evaluate(() => {
      return (globalThis.state?.codeIssues?.length || 0) > 0;
    });

    // If validation didn't run, codeIssues would still be empty
    expect(hasIssues).toBe(true);
  });

  test('validation should NOT be triggered when lint panel is closed', async ({ page }) => {
    // Track if validateCode is called
    await page.evaluate(() => {
      globalThis.validationCalled = false;
      const originalValidateCode = globalThis.validateCode;
      globalThis.validateCode = function() {
        globalThis.validationCalled = true;
        return originalValidateCode.apply(this, arguments);
      };
    });

    // Ensure lint panel is closed
    const isOpen = await page.evaluate(() => {
      return globalThis.state?.lintEnabled || false;
    });

    if (isOpen) {
      await page.click('#lintToggle');
      await page.waitForTimeout(500);
    }

    // Reset the flag
    await page.evaluate(() => {
      globalThis.validationCalled = false;
    });

    // Change content to trigger render
    await page.evaluate(() => {
      const editor = globalThis.state?.cmEditor;
      if (editor) {
        editor.setValue('# Test 2');
      }
    });

    // Wait for debounced render
    await page.waitForTimeout(1000);

    // Verify validateCode was NOT called
    const wasCalled = await page.evaluate(() => globalThis.validationCalled);
    expect(wasCalled).toBe(false);
  });

  test('validation should use separate debounce from rendering', async ({ page }) => {
    // Open lint panel
    await page.click('#lintToggle');
    await waitForElementClass(page, '#lintPanel', 'show');

    // Check that both timeout properties are defined in state
    const hasBothDefined = await page.evaluate(() => {
      return 'renderTimeout' in globalThis.state && 'validationTimeout' in globalThis.state;
    });

    expect(hasBothDefined).toBe(true);
  });
});
