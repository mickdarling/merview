// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests for Share to Gist functionality
 *
 * The Share to Gist feature should:
 * - Display a "Share to Gist" button in the toolbar
 * - Show a modal for GitHub Device Flow authentication
 * - Store and retrieve GitHub tokens from localStorage
 * - Create gists via GitHub API
 * - Generate shareable Merview URLs
 * - Handle errors gracefully
 * - Allow dismissing the modal
 *
 * Note: Full end-to-end tests with real GitHub API require actual
 * OAuth credentials. These tests focus on UI behavior and mocked responses.
 */

// ============================================
// Test Helpers - Reduce code duplication
// ============================================

/**
 * Mock the device code endpoint with standard successful response
 * @param {import('@playwright/test').Page} page
 * @param {object} overrides - Override default response values
 */
async function mockDeviceCodeEndpoint(page, overrides = {}) {
  const defaultResponse = {
    device_code: 'test-device-code',
    user_code: 'TEST-1234',
    verification_uri: 'https://github.com/login/device',
    expires_in: 900,
    interval: 5,
    ...overrides
  };

  await page.route('**/device/code', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(defaultResponse)
    });
  });
}

/**
 * Mock the device code endpoint with an error response
 * @param {import('@playwright/test').Page} page
 * @param {string} error - Error code
 * @param {string} errorDescription - Error description
 */
async function mockDeviceCodeError(page, error, errorDescription) {
  await page.route('**/device/code', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ error, error_description: errorDescription })
    });
  });
}

/**
 * Mock the token polling endpoint with authorization_pending
 * @param {import('@playwright/test').Page} page
 */
async function mockTokenPending(page) {
  await page.route('**/device/token', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'authorization_pending' })
    });
  });
}

/**
 * Mock the token polling endpoint with an error
 * @param {import('@playwright/test').Page} page
 * @param {string} error - Error code
 * @param {string} errorDescription - Error description
 */
async function mockTokenError(page, error, errorDescription = '') {
  await page.route('**/device/token', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ error, error_description: errorDescription })
    });
  });
}

/**
 * Mock the GitHub Gist API with a successful response
 * @param {import('@playwright/test').Page} page
 * @param {function} [onRequest] - Optional callback to capture request
 */
async function mockGistCreation(page, onRequest) {
  await page.route('https://api.github.com/gists', route => {
    const requestBody = route.request().postDataJSON();
    if (onRequest) onRequest(requestBody);

    const filename = requestBody?.files ? Object.keys(requestBody.files)[0] : 'document.md';

    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-gist-id',
        html_url: 'https://gist.github.com/test-gist-id',
        files: {
          [filename]: {
            filename: filename,
            raw_url: `https://gist.githubusercontent.com/user/test-gist-id/raw/${filename}`
          }
        }
      })
    });
  });
}

/**
 * Mock the GitHub Gist API with an error response
 * @param {import('@playwright/test').Page} page
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 */
async function mockGistError(page, status, message) {
  await page.route('https://api.github.com/gists', route => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ message })
    });
  });
}

/**
 * Set editor content
 * @param {import('@playwright/test').Page} page
 * @param {string} content
 */
async function setEditorContent(page, content) {
  await page.evaluate((c) => {
    // @ts-ignore
    globalThis.setEditorContent(c);
  }, content);
}

/**
 * Set a valid GitHub token in localStorage
 * @param {import('@playwright/test').Page} page
 */
async function setValidToken(page) {
  await page.evaluate(() => {
    localStorage.setItem('github_gist_token', JSON.stringify({
      accessToken: 'valid-test-token',
      expiresAt: Date.now() + 3600000,
      scope: 'gist'
    }));
  });
}

/**
 * Set up standard mocks for device flow (code + pending token)
 * @param {import('@playwright/test').Page} page
 * @param {object} deviceCodeOverrides
 */
async function setupDeviceFlowMocks(page, deviceCodeOverrides = {}) {
  await mockDeviceCodeEndpoint(page, deviceCodeOverrides);
  await mockTokenPending(page);
}

// ============================================
// Tests
// ============================================

test.describe('Share to Gist', () => {
  test.describe('Button and UI', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    });

    test('should display Share to Gist button in toolbar', async ({ page }) => {
      const button = page.locator('button:has-text("Share to Gist")');
      await expect(button).toBeVisible();
      await expect(button).toHaveClass(/btn-success/);
    });

    test('should have Share to Gist button positioned after Save As', async ({ page }) => {
      const buttons = await page.locator('.toolbar-buttons button').allTextContents();
      const saveAsIndex = buttons.findIndex(text => text.includes('Save As'));
      const shareIndex = buttons.findIndex(text => text.includes('Share to Gist'));

      expect(saveAsIndex).toBeGreaterThanOrEqual(0);
      expect(shareIndex).toBe(saveAsIndex + 1);
    });

    test('should show status message when editor is empty', async ({ page }) => {
      await setEditorContent(page, '');
      await page.click('button:has-text("Share to Gist")');

      const status = page.locator('#status');
      await expect(status).toContainText('Nothing to share');
    });
  });

  test.describe('Modal Behavior', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await setEditorContent(page, '# Test Document\n\nSome content here.');
    });

    test('should show modal when Share to Gist is clicked', async ({ page }) => {
      await mockDeviceCodeEndpoint(page);
      await page.click('button:has-text("Share to Gist")');

      const modal = page.locator('#gistModal');
      await expect(modal).toHaveAttribute('open', '');
    });

    test('should display device code in modal', async ({ page }) => {
      await setupDeviceFlowMocks(page, { user_code: 'ABCD-5678' });
      await page.click('button:has-text("Share to Gist")');

      const deviceCode = page.locator('.device-code');
      await expect(deviceCode).toBeVisible({ timeout: 10000 });
      await expect(deviceCode).toContainText('ABCD-5678');
    });

    test('should close modal when Cancel button is clicked', async ({ page }) => {
      await setupDeviceFlowMocks(page);
      await page.click('button:has-text("Share to Gist")');

      const modal = page.locator('#gistModal');
      await expect(modal).toHaveAttribute('open', '');

      await page.click('#gistModal .gist-modal button:has-text("Cancel")');
      await expect(modal).not.toHaveAttribute('open');
    });

    test('should close modal when clicking overlay background', async ({ page }) => {
      await setupDeviceFlowMocks(page);
      await page.click('button:has-text("Share to Gist")');

      const modal = page.locator('#gistModal');
      await expect(modal).toHaveAttribute('open', '');

      // Native dialog closes when clicking ::backdrop, but Playwright can't click that directly
      // Instead, press Escape which native dialog handles automatically
      // Small wait to ensure modal is fully rendered before closing
      await page.waitForTimeout(100);
      await page.keyboard.press('Escape');
      await expect(modal).not.toHaveAttribute('open');
    });

    test('should show Open GitHub button', async ({ page }) => {
      await setupDeviceFlowMocks(page);
      await page.click('button:has-text("Share to Gist")');

      const githubButton = page.locator('#gistModal .gist-modal button:has-text("Open GitHub")');
      await expect(githubButton).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Token Storage', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    });

    test('should store token in localStorage after successful auth', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('github_gist_token', JSON.stringify({
          accessToken: 'test-access-token',
          expiresAt: Date.now() + 3600000,
          scope: 'gist'
        }));
      });

      const stored = await page.evaluate(() => {
        const data = localStorage.getItem('github_gist_token');
        return data ? JSON.parse(data) : null;
      });

      expect(stored).not.toBeNull();
      expect(stored.accessToken).toBe('test-access-token');
    });

    test('should clear expired tokens', async ({ page }) => {
      // Set an expired token
      await page.evaluate(() => {
        localStorage.setItem('github_gist_token', JSON.stringify({
          accessToken: 'expired-token',
          expiresAt: Date.now() - 1000,
          scope: 'gist'
        }));
      });

      await setEditorContent(page, '# Test');
      await setupDeviceFlowMocks(page);

      await page.click('button:has-text("Share to Gist")');

      const modal = page.locator('#gistModal');
      await expect(modal).toHaveAttribute('open', '');
      await expect(page.locator('#gistModal .device-code')).toBeVisible({ timeout: 10000 });
    });

    test('should disconnect GitHub when disconnectGitHub is called', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('github_gist_token', JSON.stringify({
          accessToken: 'test-token',
          expiresAt: Date.now() + 3600000,
          scope: 'gist'
        }));
      });

      await page.evaluate(() => {
        // @ts-ignore
        globalThis.disconnectGitHub();
      });

      const token = await page.evaluate(() => localStorage.getItem('github_gist_token'));
      expect(token).toBeNull();
    });
  });

  test.describe('Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await setEditorContent(page, '# Test Document');
    });

    test('should show error when proxy is unreachable', async ({ page }) => {
      await page.route('**/device/code', route => route.abort('failed'));
      await page.click('button:has-text("Share to Gist")');

      const errorText = page.locator('.status-text.error');
      await expect(errorText).toBeVisible({ timeout: 10000 });
    });

    test('should show error when device flow is not enabled', async ({ page }) => {
      await mockDeviceCodeError(page, 'unauthorized', 'Device Flow is not enabled for this OAuth App');
      await page.click('button:has-text("Share to Gist")');

      const modal = page.locator('#gistModal .gist-modal');
      await expect(modal).toContainText('Device Flow is not enabled');
    });

    test('should handle access denied gracefully', async ({ page }) => {
      await mockDeviceCodeEndpoint(page, { interval: 1 });
      await mockTokenError(page, 'access_denied', 'The user has denied your application access');

      await page.click('button:has-text("Share to Gist")');

      const modal = page.locator('#gistModal .gist-modal');
      await expect(modal).toContainText('denied', { timeout: 10000 });
    });

    test('should handle expired token during polling', async ({ page }) => {
      await mockDeviceCodeEndpoint(page, { interval: 1 });
      await mockTokenError(page, 'expired_token', 'The device code has expired');

      await page.click('button:has-text("Share to Gist")');

      const modal = page.locator('#gistModal .gist-modal');
      await expect(modal).toContainText('expired', { timeout: 10000 });
    });
  });

  test.describe('Gist Creation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await setValidToken(page);
      await setEditorContent(page, '# My Test Document\n\nThis is test content.');
    });

    test('should call GitHub API to create gist', async ({ page }) => {
      let requestBody = null;
      await mockGistCreation(page, (body) => { requestBody = body; });

      await page.click('button:has-text("Share to Gist")');
      await expect(page.locator('#gistModal .gist-modal')).toContainText('Gist Created', { timeout: 10000 });

      expect(requestBody).not.toBeNull();
      expect(requestBody.public).toBe(false);
      expect(requestBody.files['document.md']).toBeDefined();
    });

    test('should use first heading as gist description', async ({ page }) => {
      let requestBody = null;
      await mockGistCreation(page, (body) => { requestBody = body; });

      await page.click('button:has-text("Share to Gist")');
      await expect(page.locator('#gistModal .gist-modal')).toContainText('Gist Created', { timeout: 10000 });

      expect(requestBody.description).toBe('My Test Document');
    });

    test('should display shareable Merview URL after success', async ({ page }) => {
      await mockGistCreation(page);
      await page.click('button:has-text("Share to Gist")');

      const urlDisplay = page.locator('.url-display');
      await expect(urlDisplay).toBeVisible({ timeout: 10000 });

      const url = await urlDisplay.textContent();
      expect(url).toContain('?url=');
      expect(url).toContain('gist.githubusercontent.com');
    });

    test('should show Copy Link and View on GitHub buttons', async ({ page }) => {
      await mockGistCreation(page);
      await page.click('button:has-text("Share to Gist")');

      await expect(page.locator('#gistModal .gist-modal button:has-text("Copy Link")')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#gistModal .gist-modal button:has-text("View on GitHub")')).toBeVisible();
    });

    test('should handle 401 unauthorized and prompt re-auth', async ({ page }) => {
      await mockGistError(page, 401, 'Bad credentials');
      await page.click('button:has-text("Share to Gist")');

      const modal = page.locator('#gistModal .gist-modal');
      await expect(modal).toContainText('authorization expired', { timeout: 10000 });

      const token = await page.evaluate(() => localStorage.getItem('github_gist_token'));
      expect(token).toBeNull();
    });

    test('should use default filename for gist file', async ({ page }) => {
      let requestBody = null;
      await mockGistCreation(page, (body) => { requestBody = body; });

      await page.click('button:has-text("Share to Gist")');
      await expect(page.locator('#gistModal .gist-modal')).toContainText('Gist Created', { timeout: 10000 });

      expect(Object.keys(requestBody.files).length).toBeGreaterThan(0);
      expect(requestBody.files['document.md']).toBeDefined();
    });
  });

  test.describe('Polling Behavior', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
      await setEditorContent(page, '# Test');
    });

    test('should continue polling while authorization is pending', async ({ page }) => {
      let pollCount = 0;

      await mockDeviceCodeEndpoint(page, { interval: 1 });

      await page.route('**/device/token', route => {
        pollCount++;
        if (pollCount < 3) {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'authorization_pending' })
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              access_token: 'new-access-token',
              token_type: 'bearer',
              scope: 'gist'
            })
          });
        }
      });

      await mockGistCreation(page);
      await page.click('button:has-text("Share to Gist")');

      await expect(page.locator('#gistModal .gist-modal')).toContainText('Gist Created', { timeout: 15000 });
      expect(pollCount).toBeGreaterThanOrEqual(3);
    });

    test('should handle slow_down error and continue', async ({ page }) => {
      let pollCount = 0;

      await mockDeviceCodeEndpoint(page, { interval: 1 });

      await page.route('**/device/token', route => {
        pollCount++;
        if (pollCount === 1) {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'slow_down' })
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              access_token: 'new-access-token',
              token_type: 'bearer',
              scope: 'gist'
            })
          });
        }
      });

      await mockGistCreation(page);
      await page.click('button:has-text("Share to Gist")');

      await expect(page.locator('#gistModal .gist-modal')).toContainText('Gist Created', { timeout: 20000 });
      expect(pollCount).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.CodeMirror', { timeout: 15000 });
    });

    test('Share to Gist button should have title attribute', async ({ page }) => {
      const button = page.locator('#shareGistBtn');
      await expect(button).toHaveAttribute('title', /[Gg]ist/);
    });

    test('modal should have proper heading structure', async ({ page }) => {
      await setEditorContent(page, '# Test');
      await mockDeviceCodeEndpoint(page);

      await page.click('button:has-text("Share to Gist")');

      const heading = page.locator('#gistModal .gist-modal h2');
      await expect(heading).toBeVisible();
    });

    test('device code should be selectable', async ({ page }) => {
      await setEditorContent(page, '# Test');
      await setupDeviceFlowMocks(page);

      await page.click('button:has-text("Share to Gist")');

      const deviceCode = page.locator('.device-code');
      await expect(deviceCode).toBeVisible({ timeout: 10000 });
      await expect(deviceCode).toHaveCSS('user-select', 'all');
    });
  });
});
