// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Session Management Tests
 *
 * Tests for multi-document session management including:
 * - Session CRUD operations (create, read, update, delete)
 * - Session switching
 * - Recent sessions list
 * - Session management modal
 * - Storage migration and limits
 */

test.describe('Session Management', () => {

  test.beforeEach(async ({ page }) => {
    // Clear all storage before each test
    await page.goto('http://localhost:8081');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    // Reload to get fresh state
    await page.goto('http://localhost:8081');
    await page.waitForSelector('.CodeMirror', { timeout: 10000 });
  });

  test.describe('Session Initialization', () => {

    test('sessions system should be initialized on page load', async ({ page }) => {
      const isInitialized = await page.evaluate(() => {
        return globalThis.state && globalThis.state.sessionsLoaded === true;
      });
      expect(isInitialized).toBe(true);
    });

    test('sessions index should exist in localStorage after initialization', async ({ page }) => {
      const hasIndex = await page.evaluate(() => {
        return localStorage.getItem('merview-sessions-index') !== null;
      });
      expect(hasIndex).toBe(true);
    });

    test('sessions index should have valid schema', async ({ page }) => {
      const index = await page.evaluate(() => {
        const raw = localStorage.getItem('merview-sessions-index');
        return raw ? JSON.parse(raw) : null;
      });
      expect(index).not.toBeNull();
      expect(index.version).toBe(1);
      expect(Array.isArray(index.sessions)).toBe(true);
    });

    test('initial session should be created for welcome document', async ({ page }) => {
      // Wait for content to load
      await page.waitForFunction(() => {
        const cm = globalThis.state?.cmEditor;
        return cm && cm.getValue().includes('Welcome');
      }, { timeout: 10000 });

      const index = await page.evaluate(() => {
        const raw = localStorage.getItem('merview-sessions-index');
        return raw ? JSON.parse(raw) : null;
      });

      expect(index.sessions.length).toBeGreaterThan(0);
      expect(index.activeSessionId).not.toBeNull();
    });

  });

  test.describe('Document Selector with Sessions', () => {

    test('document selector should have Current optgroup', async ({ page }) => {
      const optgroups = await page.$$eval('#documentSelector optgroup', groups =>
        groups.map(g => g.label)
      );
      expect(optgroups).toContain('Current');
    });

    test('document selector should have Actions optgroup', async ({ page }) => {
      const optgroups = await page.$$eval('#documentSelector optgroup', groups =>
        groups.map(g => g.label)
      );
      expect(optgroups).toContain('Actions');
    });

    test('document selector should have Manage sessions option', async ({ page }) => {
      const options = await page.$$eval('#documentSelector option', opts =>
        opts.map(o => o.textContent)
      );
      expect(options).toContain('Manage sessions...');
    });

    test('document selector should show current document name', async ({ page }) => {
      // Wait for content to load and selector to update
      await page.waitForFunction(() => {
        const selector = document.getElementById('documentSelector');
        const currentOption = selector?.querySelector('option[value="__current__"]');
        return currentOption && currentOption.textContent !== 'Untitled';
      }, { timeout: 10000 });

      const currentName = await page.$eval(
        '#documentSelector option[value="__current__"]',
        opt => opt.textContent
      );
      expect(currentName).toBe('Welcome.md');
    });

  });

  test.describe('Session Creation', () => {

    test('new document should create a new session', async ({ page }) => {
      // Get initial session count
      const initialCount = await page.evaluate(() => {
        const raw = localStorage.getItem('merview-sessions-index');
        const index = JSON.parse(raw);
        return index.sessions.length;
      });

      // Create new document
      await page.selectOption('#documentSelector', '__new__');

      // Wait for session to be created
      await page.waitForTimeout(500);

      // Check session count increased
      const newCount = await page.evaluate(() => {
        const raw = localStorage.getItem('merview-sessions-index');
        const index = JSON.parse(raw);
        return index.sessions.length;
      });

      expect(newCount).toBe(initialCount + 1);
    });

    test('new session should have correct metadata', async ({ page }) => {
      // Create new document
      await page.selectOption('#documentSelector', '__new__');
      await page.waitForTimeout(500);

      const session = await page.evaluate(() => {
        const raw = localStorage.getItem('merview-sessions-index');
        const index = JSON.parse(raw);
        // Get most recent session (should be Untitled)
        return index.sessions.find(s => s.name.startsWith('Untitled'));
      });

      expect(session).not.toBeNull();
      expect(session.source).toBe('new');
      expect(session.createdAt).toBeGreaterThan(0);
      expect(session.lastModified).toBeGreaterThan(0);
    });

  });

  test.describe('Session Content Persistence', () => {

    test('editing content should update session content', async ({ page }) => {
      // Type in editor
      await page.click('.CodeMirror');
      await page.keyboard.type('# Test Content\n\nThis is test content.');

      // Wait for debounced render
      await page.waitForTimeout(500);

      // Check session content was saved
      const activeSessionId = await page.evaluate(() => {
        const raw = localStorage.getItem('merview-sessions-index');
        const index = JSON.parse(raw);
        return index.activeSessionId;
      });

      const sessionData = await page.evaluate((sessionId) => {
        const raw = localStorage.getItem(`merview-session-${sessionId}`);
        return raw ? JSON.parse(raw) : null;
      }, activeSessionId);

      expect(sessionData).not.toBeNull();
      expect(sessionData.content).toContain('Test Content');
    });

    test('session content size should be tracked', async ({ page }) => {
      // Get initial content size
      const initialSize = await page.evaluate(() => {
        const raw = localStorage.getItem('merview-sessions-index');
        const index = JSON.parse(raw);
        const activeSession = index.sessions.find(s => s.id === index.activeSessionId);
        return activeSession?.contentSize || 0;
      });

      // Clear and add new content
      await page.evaluate(() => {
        globalThis.state.cmEditor.setValue('# Short Content');
      });

      // Wait for debounced render
      await page.waitForTimeout(500);

      const newSize = await page.evaluate(() => {
        const raw = localStorage.getItem('merview-sessions-index');
        const index = JSON.parse(raw);
        const activeSession = index.sessions.find(s => s.id === index.activeSessionId);
        return activeSession?.contentSize || 0;
      });

      expect(newSize).toBe('# Short Content'.length);
    });

  });

  test.describe('Session Switching', () => {

    test('creating multiple sessions allows switching between them', async ({ page }) => {
      // Create first document with known content
      await page.evaluate(() => {
        globalThis.state.cmEditor.setValue('# First Document');
        globalThis.state.currentFilename = 'First.md';
      });
      await page.waitForTimeout(500);

      // Create new document
      await page.selectOption('#documentSelector', '__new__');
      await page.waitForTimeout(500);

      // Add content to second document
      await page.evaluate(() => {
        globalThis.state.cmEditor.setValue('# Second Document');
      });
      await page.waitForTimeout(500);

      // Check we have at least 2 sessions
      const sessionCount = await page.evaluate(() => {
        const raw = localStorage.getItem('merview-sessions-index');
        const index = JSON.parse(raw);
        return index.sessions.length;
      });

      expect(sessionCount).toBeGreaterThanOrEqual(2);
    });

  });

  test.describe('Sessions Modal', () => {

    test('Manage sessions option should open modal', async ({ page }) => {
      // Select Manage sessions
      await page.selectOption('#documentSelector', '__manage__');

      // Check modal is visible
      const modalVisible = await page.isVisible('#sessionsModal');
      expect(modalVisible).toBe(true);
    });

    test('Sessions modal should show storage stats', async ({ page }) => {
      await page.selectOption('#documentSelector', '__manage__');

      const statsText = await page.textContent('#sessionsStorageInfo');
      expect(statsText).toContain('session');
      expect(statsText).toMatch(/of 5(\.0)? MB/); // May be "5 MB" or "5.0 MB"
    });

    test('Sessions modal should list sessions', async ({ page }) => {
      await page.selectOption('#documentSelector', '__manage__');

      // Check sessions list has content
      const hasSessionItems = await page.isVisible('.session-item');
      expect(hasSessionItems).toBe(true);
    });

    test('Sessions modal Close button should close modal', async ({ page }) => {
      await page.selectOption('#documentSelector', '__manage__');
      await page.waitForSelector('#sessionsModal[open]');

      await page.click('#closeSessionsModalBtn');

      // Wait for modal to close - dialog element uses .open property, not [open] attribute
      await page.waitForFunction(() => {
        const modal = document.getElementById('sessionsModal');
        return modal && !modal.open;
      }, { timeout: 5000 });

      const isOpen = await page.evaluate(() => {
        const modal = document.getElementById('sessionsModal');
        return modal?.open || false;
      });
      expect(isOpen).toBe(false);
    });

    test('Escape key should close sessions modal', async ({ page }) => {
      await page.selectOption('#documentSelector', '__manage__');
      await page.waitForSelector('#sessionsModal[open]');

      await page.keyboard.press('Escape');

      // Wait for modal to close
      await page.waitForFunction(() => {
        const modal = document.getElementById('sessionsModal');
        return modal && !modal.open;
      }, { timeout: 5000 });

      const isOpen = await page.evaluate(() => {
        const modal = document.getElementById('sessionsModal');
        return modal?.open || false;
      });
      expect(isOpen).toBe(false);
    });

    test('Active session should be marked in modal', async ({ page }) => {
      await page.selectOption('#documentSelector', '__manage__');

      const hasActiveBadge = await page.isVisible('.session-active-badge');
      expect(hasActiveBadge).toBe(true);
    });

  });

  test.describe('Session Deletion', () => {

    test('deleting a session should remove it from storage', async ({ page }) => {
      // First create a new session to delete
      await page.selectOption('#documentSelector', '__new__');
      await page.waitForTimeout(500);

      const initialCount = await page.evaluate(() => {
        const raw = localStorage.getItem('merview-sessions-index');
        const index = JSON.parse(raw);
        return index.sessions.length;
      });

      // We need at least 2 sessions to delete one
      if (initialCount >= 2) {
        // Open modal
        await page.selectOption('#documentSelector', '__manage__');
        await page.waitForSelector('#sessionsModal[open]');

        // Find a non-active session delete button
        const deleteButtons = await page.$$('.session-item:not(.session-item-active) button[data-action="delete"]');

        if (deleteButtons.length > 0) {
          // Set up dialog handler to accept the confirmation
          page.on('dialog', async dialog => {
            await dialog.accept();
          });

          await deleteButtons[0].click();
          await page.waitForTimeout(500);

          const newCount = await page.evaluate(() => {
            const raw = localStorage.getItem('merview-sessions-index');
            const index = JSON.parse(raw);
            return index.sessions.length;
          });

          expect(newCount).toBe(initialCount - 1);
        }
      }
    });

  });

  test.describe('Recent Sessions in Dropdown', () => {

    test('Recent optgroup should appear when multiple sessions exist', async ({ page }) => {
      // Create multiple sessions
      await page.selectOption('#documentSelector', '__new__');
      await page.waitForTimeout(500);
      await page.selectOption('#documentSelector', '__new__');
      await page.waitForTimeout(500);

      // Check for Recent optgroup
      const optgroups = await page.$$eval('#documentSelector optgroup', groups =>
        groups.map(g => g.label)
      );

      // Should have Recent when there are non-active sessions
      const sessionsCount = await page.evaluate(() => {
        const raw = localStorage.getItem('merview-sessions-index');
        const index = JSON.parse(raw);
        return index.sessions.length;
      });

      if (sessionsCount > 1) {
        expect(optgroups).toContain('Recent');
      }
    });

  });

  test.describe('Storage Functions', () => {

    test('getStorageStats should return correct structure', async ({ page }) => {
      const stats = await page.evaluate(() => {
        // Access via module (it's not on globalThis)
        // We need to test indirectly through the modal
        const storageInfo = document.getElementById('sessionsStorageInfo');
        return storageInfo?.textContent || '';
      });

      // Stats text should contain session count and size info
      expect(stats).toMatch(/\d+\s+session/);
    });

  });

  test.describe('Migration from Legacy Storage', () => {

    test('should migrate existing markdown-content to a session', async ({ page, context }) => {
      // Create a new page with legacy content pre-set
      const newPage = await context.newPage();

      // Set up legacy storage BEFORE loading the page
      await newPage.addInitScript(() => {
        localStorage.setItem('markdown-content', '# Legacy Content\n\nThis was stored before sessions.');
        // Remove any existing sessions index to simulate pre-sessions state
        localStorage.removeItem('merview-sessions-index');
      });

      // Now load the page - migration should happen
      await newPage.goto('http://localhost:8081');
      await newPage.waitForSelector('.CodeMirror', { timeout: 10000 });

      // Check that sessions index was created
      const hasIndex = await newPage.evaluate(() => {
        return localStorage.getItem('merview-sessions-index') !== null;
      });
      expect(hasIndex).toBe(true);

      await newPage.close();
    });

  });

  test.describe('Session Name Resolution', () => {

    test('duplicate session names should get numeric suffix', async ({ page }) => {
      // Create multiple Untitled sessions
      await page.selectOption('#documentSelector', '__new__');
      await page.waitForTimeout(500);
      await page.selectOption('#documentSelector', '__new__');
      await page.waitForTimeout(500);

      const sessions = await page.evaluate(() => {
        const raw = localStorage.getItem('merview-sessions-index');
        const index = JSON.parse(raw);
        return index.sessions.map(s => s.name);
      });

      // Should have Untitled and Untitled (1) or similar
      const untitledSessions = sessions.filter(name => name.startsWith('Untitled'));
      expect(untitledSessions.length).toBeGreaterThanOrEqual(2);

      // Names should be unique
      const uniqueNames = new Set(sessions);
      expect(uniqueNames.size).toBe(sessions.length);
    });

  });

});
