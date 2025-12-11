// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForPageReady } = require('./helpers/test-utils');

test.describe('UI Cleanup - Dropdown Optgroups', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  const dropdowns = [
    { id: 'documentSelector', label: 'Current' },
    { id: 'editorThemeSelector', label: 'Editor Theme' },
    { id: 'styleSelector', label: 'Preview Style' },
    { id: 'syntaxThemeSelector', label: 'Code Block Theme' },
    { id: 'mermaidThemeSelector', label: 'Mermaid Theme' }
  ];

  for (const { id, label } of dropdowns) {
    test(`${id} should have optgroups for organization`, async ({ page }) => {
      // JavaScript dynamically populates optgroups at runtime
      // We just verify that optgroups exist for organization
      const optgroup = await page.$(`#${id} optgroup`);
      expect(optgroup).not.toBeNull();

      // The static HTML has one optgroup, but JS adds more at runtime
      // Just verify at least one exists
      const optgroupCount = await page.$$eval(`#${id} optgroup`, els => els.length);
      expect(optgroupCount).toBeGreaterThanOrEqual(1);
    });

    test(`${id} first optgroup should have label "${label}"`, async ({ page }) => {
      // Get the label attribute of the first optgroup in this dropdown
      const firstOptgroupLabel = await page.$eval(`#${id} optgroup`, el => el.getAttribute('label'));
      expect(firstOptgroupLabel).toBe(label);
    });
  }

  test('all dropdowns should have at least one optgroup each', async ({ page }) => {
    for (const { id } of dropdowns) {
      const optgroupCount = await page.$$eval(`#${id} optgroup`, els => els.length);
      expect(optgroupCount).toBeGreaterThanOrEqual(1);
    }
  });
});

test.describe('UI Cleanup - Consolidated Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test.describe('Save Button', () => {
    test('should have exactly one Save button', async ({ page }) => {
      const saveButtons = await page.$$('button:has-text("Save"):not(:has-text("PDF"))');
      expect(saveButtons.length).toBe(1);
    });

    test('Save button should call saveFile()', async ({ page }) => {
      const onclick = await page.$eval('button[onclick="saveFile()"]', el => el.getAttribute('onclick'));
      expect(onclick).toBe('saveFile()');
    });

    test('should NOT have a separate Save As button', async ({ page }) => {
      // Use exact text match to avoid matching "Save as PDF"
      const buttons = await page.$$('button');
      const buttonTexts = await Promise.all(buttons.map(btn => btn.textContent()));
      const hasSaveAsButton = buttonTexts.some(text => text && text.trim() === '💾 Save As');
      expect(hasSaveAsButton).toBe(false);
    });
  });

  test.describe('PDF Export Button', () => {
    test('should have exactly one Save as PDF button', async ({ page }) => {
      const pdfButtons = await page.$$('button:has-text("Save as PDF")');
      expect(pdfButtons.length).toBe(1);
    });

    test('Save as PDF button should call exportToPDF()', async ({ page }) => {
      const onclick = await page.$eval('button[onclick="exportToPDF()"]', el => el.getAttribute('onclick'));
      expect(onclick).toBe('exportToPDF()');
    });

    test('should NOT have a Print (New Tab) button', async ({ page }) => {
      const printNewTabButton = await page.$('button:has-text("Print (New Tab)")');
      expect(printNewTabButton).toBeNull();
    });

    test('should NOT have a button calling exportToPDFDirect()', async ({ page }) => {
      const directButton = await page.$('button[onclick="exportToPDFDirect()"]');
      expect(directButton).toBeNull();
    });
  });
});

test.describe('UI Cleanup - Button Labels', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test('Save button should have disk emoji', async ({ page }) => {
    const buttonText = await page.$eval('button[onclick="saveFile()"]', el => el.textContent);
    expect(buttonText).toContain('💾');
    expect(buttonText).toContain('Save');
  });

  test('Save as PDF button should have document emoji', async ({ page }) => {
    const buttonText = await page.$eval('button[onclick="exportToPDF()"]', el => el.textContent);
    expect(buttonText).toContain('📄');
    expect(buttonText).toContain('Save as PDF');
  });
});
