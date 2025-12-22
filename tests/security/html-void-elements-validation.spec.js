// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  waitForGlobalFunction,
  waitForElementClass,
  setCodeMirrorContent,
  renderMarkdownAndWait,
  WAIT_TIMES
} = require('../helpers/test-utils');

/**
 * Tests for HTML Void Elements Validation
 *
 * These tests ensure that HTML void elements (self-closing tags like <br>, <img>, etc.)
 * are properly handled by the validation system and do not trigger false positive warnings.
 *
 * Related to Issue #280 and PR #281.
 */
test.describe('HTML Void Elements Validation', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
    await waitForGlobalFunction(page, 'toggleLintPanel');
    await waitForGlobalFunction(page, 'validateCode');
  });

  test('should NOT warn for HTML with void elements', async ({ page }) => {
    // Enable lint panel
    await page.click('#lintToggle');
    await waitForElementClass(page, '#lintPanel', 'show');

    // Create markdown with valid HTML containing void elements
    const markdown = `
# HTML Void Elements Test

This HTML block contains void elements that should NOT trigger warnings:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="style.css">
    <title>Valid HTML</title>
</head>
<body>
    <h1>Hello World</h1>
    <p>A paragraph with a line break:<br>New line here.</p>
    <img src="logo.png" alt="Logo">
    <hr>
    <input type="text" name="username">
</body>
</html>
\`\`\`
`;

    await setCodeMirrorContent(page, markdown);
    await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

    // Wait for validation to complete
    await page.waitForTimeout(WAIT_TIMES.MEDIUM);

    // Check lint panel content
    const lintContent = await page.$eval('#lintContent', el => el.textContent);

    // Should show "No issues found" - void elements should not cause warnings
    expect(lintContent).toContain('No issues found');
    expect(lintContent).not.toContain('Possible unclosed HTML tags');
  });

  test('should still warn for actually unclosed tags', async ({ page }) => {
    // Enable lint panel
    await page.click('#lintToggle');
    await waitForElementClass(page, '#lintPanel', 'show');

    // Create markdown with HTML that has genuinely unclosed tags
    const markdown = `
# Unclosed Tags Test

This HTML block has real unclosed tags:

\`\`\`html
<div>
    <p>This paragraph is not closed
    <span>Neither is this span
</div>
\`\`\`
`;

    await setCodeMirrorContent(page, markdown);
    await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

    // Wait for validation to complete (validation runs with 500ms debounce)
    await page.waitForTimeout(WAIT_TIMES.VALIDATION_DEBOUNCE);

    // Check lint panel content
    const lintContent = await page.$eval('#lintContent', el => el.textContent);

    // Should show warning for unclosed tags
    expect(lintContent).toContain('Possible unclosed HTML tags');
    expect(lintContent).toContain('WARNING');
    expect(lintContent).toContain('HTML');
  });

  test('should handle self-closing void elements', async ({ page }) => {
    // Enable lint panel
    await page.click('#lintToggle');
    await waitForElementClass(page, '#lintPanel', 'show');

    // Create markdown with self-closing void elements (e.g., <br />, <img />)
    const markdown = `
# Self-Closing Void Elements Test

This HTML uses self-closing syntax for void elements:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="style.css" />
    <title>Self-Closing Test</title>
</head>
<body>
    <h1>Testing Self-Closing Tags</h1>
    <p>Line break with self-close:<br />New line.</p>
    <img src="logo.png" alt="Logo" />
    <hr />
    <input type="text" name="field" />
</body>
</html>
\`\`\`
`;

    await setCodeMirrorContent(page, markdown);
    await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

    // Wait for validation to complete
    await page.waitForTimeout(WAIT_TIMES.MEDIUM);

    // Check lint panel content
    const lintContent = await page.$eval('#lintContent', el => el.textContent);

    // Should show "No issues found" - self-closing void elements are valid
    expect(lintContent).toContain('No issues found');
    expect(lintContent).not.toContain('Possible unclosed HTML tags');
  });

  test('should handle self-closing tags without space before slash', async ({ page }) => {
    // Enable lint panel
    await page.click('#lintToggle');
    await waitForElementClass(page, '#lintPanel', 'show');

    // Test self-closing syntax WITHOUT space before slash (e.g., <br/> vs <br />)
    // This is a common variation that should also be handled correctly
    const markdown = `
# No-Space Self-Closing Test

Testing self-closing tags without space before slash:

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <link rel="stylesheet" href="style.css"/>
    <title>No-Space Test</title>
</head>
<body>
    <h1>Testing No-Space Self-Closing</h1>
    <p>Line break:<br/>New line.</p>
    <img src="logo.png" alt="Logo"/>
    <hr/>
    <input type="text" name="field"/>
</body>
</html>
\`\`\`
`;

    await setCodeMirrorContent(page, markdown);
    await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

    // Wait for validation to complete
    await page.waitForTimeout(WAIT_TIMES.MEDIUM);

    // Check lint panel content
    const lintContent = await page.$eval('#lintContent', el => el.textContent);

    // Should show "No issues found" - self-closing without space is also valid
    expect(lintContent).toContain('No issues found');
    expect(lintContent).not.toContain('Possible unclosed HTML tags');
  });

  test('should handle mix of void elements and regular tags', async ({ page }) => {
    // Enable lint panel
    await page.click('#lintToggle');
    await waitForElementClass(page, '#lintPanel', 'show');

    // Create markdown with mixed void and regular elements
    const markdown = `
# Mixed Elements Test

\`\`\`html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Mixed Tags</title>
</head>
<body>
    <div>
        <h1>Title</h1>
        <img src="test.jpg" alt="Test">
        <p>Paragraph with <br> break.</p>
        <input type="text">
        <hr>
    </div>
</body>
</html>
\`\`\`
`;

    await setCodeMirrorContent(page, markdown);
    await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

    // Wait for validation to complete
    await page.waitForTimeout(WAIT_TIMES.MEDIUM);

    // Check lint panel content
    const lintContent = await page.$eval('#lintContent', el => el.textContent);

    // Should show "No issues found" - all tags properly balanced
    expect(lintContent).toContain('No issues found');
  });

  test('should load code-validation demo without void element warnings', async ({ page }) => {
    // Load the code-validation demo
    await page.goto('/?url=docs/demos/code-validation.md');
    await page.waitForSelector('.CodeMirror', { timeout: 15000 });

    // Wait for content to load and render
    await page.waitForTimeout(WAIT_TIMES.CONTENT_LOAD);

    // Enable lint panel
    await page.click('#lintToggle');
    await waitForElementClass(page, '#lintPanel', 'show');

    // Wait for validation to complete
    await page.waitForTimeout(WAIT_TIMES.MEDIUM);

    // =============================================================================
    // COUNTING STRATEGY EXPLANATION
    // =============================================================================
    // The code-validation demo contains a mix of:
    //   - Valid HTML blocks (with void elements like <meta>, <br>, <img>)
    //   - Intentionally invalid HTML blocks (with actual unclosed tags)
    //
    // We use a counting strategy rather than checking specific blocks because:
    //   1. It's more resilient to demo content changes
    //   2. It tests the real behavior: void elements should NOT cause false positives
    //   3. We compare unclosed-tag warnings vs total HTML warnings
    //
    // If void elements caused false positives, EVERY HTML block would trigger
    // "Possible unclosed HTML tags" warnings. By verifying that unclosedWarnings
    // is LESS than totalHtmlWarnings, we confirm some blocks pass validation.
    // =============================================================================

    const lintContent = await page.$eval('#lintContent', el => el.textContent);

    // Verify validation is working - the demo has intentional errors, so should NOT be empty
    expect(lintContent).toBeDefined();
    expect(lintContent).not.toContain('No issues found');

    // Count occurrences of specific warning types:
    // - unclosedWarnings: How many "Possible unclosed HTML tags" messages appear
    // - totalHtmlWarnings: How many HTML blocks were validated (look for "HTML - Block #N")
    const unclosedWarnings = (lintContent.match(/Possible unclosed HTML tags/g) || []).length;
    const totalHtmlWarnings = (lintContent.match(/HTML - Block #/g) || []).length;

    // THE KEY ASSERTION:
    // If void elements were causing false positives, unclosed warnings would equal
    // total HTML warnings (every block would fail). Verify that's not the case -
    // some HTML blocks (those with only void elements) should be clean.
    expect(unclosedWarnings).toBeLessThan(totalHtmlWarnings);
  });

  test('should handle all standard HTML5 void elements', async ({ page }) => {
    // Enable lint panel
    await page.click('#lintToggle');
    await waitForElementClass(page, '#lintPanel', 'show');

    // Test all HTML5 void elements
    const markdown = `
# All Void Elements Test

\`\`\`html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <base href="/">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <img src="test.jpg" alt="Test">
    <br>
    <hr>
    <input type="text">
    <area shape="rect" coords="0,0,100,100" href="link.html">
    <embed src="video.mp4">
    <param name="autoplay" value="true">
    <source src="audio.mp3" type="audio/mpeg">
    <track src="subtitles.vtt" kind="subtitles">
    <wbr>
    <col>
</body>
</html>
\`\`\`
`;

    await setCodeMirrorContent(page, markdown);
    await renderMarkdownAndWait(page, WAIT_TIMES.LONG);

    // Wait for validation to complete
    await page.waitForTimeout(WAIT_TIMES.MEDIUM);

    // Check lint panel content
    const lintContent = await page.$eval('#lintContent', el => el.textContent);

    // Should show "No issues found" - all void elements properly handled
    expect(lintContent).toContain('No issues found');
    expect(lintContent).not.toContain('Possible unclosed HTML tags');
  });
});
