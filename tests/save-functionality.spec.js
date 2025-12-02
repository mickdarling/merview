// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

test.describe('Save Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for CodeMirror to initialize (it creates a .CodeMirror wrapper)
    await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    // Wait for the editor API to be ready
    await page.waitForFunction(() => typeof globalThis.setEditorContent === 'function', { timeout: 5000 });
  });

  test.describe('Save As Button', () => {
    test('should prompt for filename when clicking Save As', async ({ page }) => {
      // Set up dialog handler before triggering
      let dialogMessage = '';
      let dialogDefaultValue = '';
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        dialogDefaultValue = dialog.defaultValue();
        await dialog.accept('test-document.md');
      });

      // Click Save As button using onclick attribute selector
      const downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFileAs()"]');
      await downloadPromise;

      // Verify prompt was shown with default filename
      expect(dialogMessage).toBe('Save as:');
      expect(dialogDefaultValue).toBe('document.md');
    });

    test('should download file with entered filename', async ({ page }) => {
      // Handle the prompt dialog
      page.once('dialog', async dialog => {
        await dialog.accept('my-test-file.md');
      });

      // Set up download listener
      const downloadPromise = page.waitForEvent('download');

      // Click Save As
      await page.click('button[onclick="saveFileAs()"]');

      // Wait for download
      const download = await downloadPromise;

      // Verify filename
      expect(download.suggestedFilename()).toBe('my-test-file.md');
    });

    test('should add .md extension if not provided', async ({ page }) => {
      page.once('dialog', async dialog => {
        await dialog.accept('my-document');
      });

      const downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFileAs()"]');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe('my-document.md');
    });

    test('should not add extra .md if already present', async ({ page }) => {
      page.once('dialog', async dialog => {
        await dialog.accept('already-has.md');
      });

      const downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFileAs()"]');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe('already-has.md');
    });

    test('should not download if prompt is cancelled', async ({ page }) => {
      page.once('dialog', async dialog => {
        await dialog.dismiss();
      });

      // Try to detect if download starts (it shouldn't)
      let downloadStarted = false;
      page.once('download', () => {
        downloadStarted = true;
      });

      await page.click('button[onclick="saveFileAs()"]');

      // Wait for status to update (indicates operation completed) instead of arbitrary timeout
      await page.waitForFunction(() => {
        const status = document.getElementById('status');
        return status && status.textContent !== '';
      }, { timeout: 2000 }).catch((error) => {
        // Expected: Status might not update on cancel - this is acceptable behavior
        // We suppress this timeout error as it indicates the user cancelled the dialog
        console.debug('Status update timeout after dialog cancel (expected):', error.message);
      });

      expect(downloadStarted).toBe(false);
    });

    test('should save editor content correctly', async ({ page }) => {
      const testContent = '# Test Heading\n\nThis is test content.';

      // Check if CodeMirror loaded
      const hasCodeMirror = await page.evaluate(() => typeof globalThis.setEditorContent === 'function');

      if (hasCodeMirror) {
        // Set editor content using CodeMirror's global helper
        await page.evaluate((content) => {
          globalThis.setEditorContent(content);
        }, testContent);
      } else {
        // Skip this test if CodeMirror didn't load
        test.skip();
        return;
      }

      page.once('dialog', async dialog => {
        await dialog.accept('content-test.md');
      });

      const downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFileAs()"]');
      const download = await downloadPromise;

      // Save to temp location and verify content (platform-independent)
      const downloadPath = path.join(os.tmpdir(), 'playwright-download-test.md');
      await download.saveAs(downloadPath);

      const savedContent = fs.readFileSync(downloadPath, 'utf-8');
      expect(savedContent).toBe(testContent);

      // Cleanup (with error handling)
      try {
        fs.unlinkSync(downloadPath);
      } catch (e) {
        // Expected: Cleanup may fail if file already deleted or permissions issue
        // This is acceptable in test cleanup - we don't want test to fail on cleanup
        console.debug('Test cleanup: unable to delete temp file (non-critical):', e.message);
      }
    });
  });

  test.describe('Save Button', () => {
    test('should prompt for filename on first save (no current filename)', async ({ page }) => {
      let promptShown = false;
      page.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
          promptShown = true;
        }
        await dialog.accept('first-save.md');
      });

      const downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFile()"]');
      await downloadPromise;

      expect(promptShown).toBe(true);
    });

    test('should use remembered filename on subsequent saves', async ({ page }) => {
      // First save - set the filename
      let promptCount = 0;
      page.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
          promptCount++;
        }
        await dialog.accept('remembered-file.md');
      });

      // First save (will prompt)
      let downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFile()"]');
      let download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('remembered-file.md');
      expect(promptCount).toBe(1);

      // Modify content if CodeMirror is available (optional for this test)
      const hasCodeMirror = await page.evaluate(() => typeof globalThis.setEditorContent === 'function');
      if (hasCodeMirror) {
        await page.evaluate(() => {
          globalThis.setEditorContent('# Modified content');
        });
      }

      // Second save (should NOT prompt, use remembered filename)
      downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFile()"]');
      download = await downloadPromise;

      expect(download.suggestedFilename()).toBe('remembered-file.md');
      expect(promptCount).toBe(1); // Should still be 1, no new prompt
    });
  });

  test.describe('Keyboard Shortcut Ctrl+S', () => {
    test('should trigger save on Ctrl+S', async ({ page }) => {
      page.once('dialog', async dialog => {
        await dialog.accept('keyboard-save.md');
      });

      const downloadPromise = page.waitForEvent('download');

      // Focus editor and press Ctrl+S
      await page.focus('#editor');
      await page.keyboard.press('Control+s');

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('keyboard-save.md');
    });

    test('should trigger save on Cmd+S (Mac)', async ({ page }) => {
      page.once('dialog', async dialog => {
        await dialog.accept('mac-save.md');
      });

      const downloadPromise = page.waitForEvent('download');

      await page.focus('#editor');
      await page.keyboard.press('Meta+s');

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('mac-save.md');
    });

    test('should prevent default browser save dialog', async ({ page }) => {
      // This test verifies that Ctrl+S doesn't open browser's save page dialog
      page.once('dialog', async dialog => {
        // This should be our custom prompt, not browser's save dialog
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('prevent-default.md');
      });

      const downloadPromise = page.waitForEvent('download');
      await page.focus('#editor');
      await page.keyboard.press('Control+s');
      await downloadPromise;
    });
  });

  test.describe('Filename Tracking with File Drop', () => {
    test('should remember filename after Save As and use it for subsequent Save', async ({ page }) => {
      // This tests the filename tracking behavior - when a file is saved with a name,
      // subsequent saves should use that name without prompting

      // First, do a Save As to establish a filename
      let promptCount = 0;
      page.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
          promptCount++;
          await dialog.accept('tracked-file.md');
        }
      });

      // Save As to set the filename
      let downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFileAs()"]');
      let download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('tracked-file.md');
      expect(promptCount).toBe(1);

      // Now use Save (not Save As) - it should NOT prompt
      downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFile()"]');
      download = await downloadPromise;

      // Should still be 1 prompt (from Save As), Save used remembered filename
      expect(promptCount).toBe(1);
      expect(download.suggestedFilename()).toBe('tracked-file.md');
    });
  });

  test.describe('Clear Editor Resets Filename', () => {
    test('should reset filename when editor is cleared', async ({ page }) => {
      // Set up a single dialog handler that tracks prompt count
      let promptCount = 0;

      page.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
          promptCount++;
          await dialog.accept('will-be-cleared.md');
        } else if (dialog.type() === 'confirm') {
          // Accept the clear confirmation
          await dialog.accept();
        }
      });

      // Save to establish a filename
      let downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFileAs()"]');
      await downloadPromise;
      expect(promptCount).toBe(1);

      // Clear the editor (this will show a confirm dialog)
      await page.click('button[onclick="clearEditor()"]');

      // Wait for editor to be cleared (content should be empty or have sample)
      await page.waitForFunction(() => {
        const editor = document.querySelector('.CodeMirror');
        if (editor && editor.CodeMirror) {
          const content = editor.CodeMirror.getValue();
          // After clear, content will be empty or reset to sample
          return content === '' || content.startsWith('# ');
        }
        return false;
      }, { timeout: 2000 });

      // Try to save again - should prompt because filename was reset
      downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFile()"]');
      await downloadPromise;

      // Should have prompted twice total (first save + after clear)
      expect(promptCount).toBe(2);
    });
  });

  test.describe('Status Messages', () => {
    test('should show status message after save', async ({ page }) => {
      page.once('dialog', async dialog => {
        await dialog.accept('status-test.md');
      });

      const downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFileAs()"]');
      await downloadPromise;

      // Check status message appears
      const status = page.locator('#status');
      await expect(status).toContainText('Saved: status-test.md');
      await expect(status).toHaveClass(/show/);
    });
  });

  test.describe('Save As Default Value', () => {
    test('should show current filename in Save As prompt after previous save', async ({ page }) => {
      // First save with a specific filename
      page.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
          if (dialog.defaultValue() === 'document.md') {
            // First prompt - use custom name
            await dialog.accept('my-custom-name.md');
          } else {
            // Second prompt should have the custom name as default
            expect(dialog.defaultValue()).toBe('my-custom-name.md');
            await dialog.accept('my-custom-name.md');
          }
        }
      });

      // First save
      let downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFileAs()"]');
      await downloadPromise;

      // Second Save As should show the previous filename as default
      downloadPromise = page.waitForEvent('download');
      await page.click('button[onclick="saveFileAs()"]');
      await downloadPromise;
    });
  });
});
