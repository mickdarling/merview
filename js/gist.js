/**
 * GitHub Gist Sharing Functionality for Merview
 * @module gist
 *
 * Handles creating and sharing markdown documents as GitHub Gists with OAuth device flow authentication.
 */

import { state } from './state.js';
import { getGitHubToken, saveGitHubToken, clearGitHubToken } from './storage.js';
import { getOAuthProxyUrl } from './config.js';
import { escapeHtml, showStatus } from './utils.js';

// ==========================================
// CONFIGURATION CONSTANTS
// ==========================================

// OAuth proxy URL (origin-aware)
const OAUTH_PROXY_URL = getOAuthProxyUrl();

// GitHub Device Flow constants
const MIN_POLL_INTERVAL_MS = 1000; // 1 second minimum
const POLL_INTERVAL_INCREMENT_MS = 5000; // 5 seconds added on slow_down

// ==========================================
// MODAL DISPLAY FUNCTIONS
// ==========================================

/**
 * Show the gist modal with specific content
 * @param {string} title - Modal title
 * @param {string} content - HTML content to display
 */
function showGistModal(title, content) {
    const modal = document.getElementById('gistModal');
    document.getElementById('gistModalTitle').textContent = title;
    document.getElementById('gistModalContent').innerHTML = content;
    modal.showModal();
}

/**
 * Hide the gist modal and cleanup state
 */
export function hideGistModal() {
    const modal = document.getElementById('gistModal');
    modal.close();
    // Cancel any ongoing polling
    if (state.gistAuthState.pollTimeoutId) {
        clearTimeout(state.gistAuthState.pollTimeoutId);
    }
    // Reset state to prevent stale data on retry
    state.gistAuthState = {
        deviceCode: null,
        userCode: null,
        verificationUri: null,
        expiresAt: null,
        interval: 5,
        pollTimeoutId: null
    };
}

// ==========================================
// MAIN ENTRY POINT
// ==========================================

/**
 * Main entry point for Share to Gist functionality
 * Checks for existing token or initiates OAuth device flow
 */
export async function shareToGist() {
    // Check if OAuth proxy is available
    if (!OAUTH_PROXY_URL) {
        showGistModal('Feature Unavailable', `
            <p class="status-text error">Share to Gist is not available for this origin.</p>
            <p>This feature is only available on authorized domains (merview.com) or localhost for development.</p>
            <div class="modal-buttons">
                <button class="btn" onclick="hideGistModal()">Close</button>
            </div>
        `);
        return;
    }

    // Prevent concurrent executions
    if (state.gistShareInProgress) {
        return;
    }

    state.gistShareInProgress = true;
    try {
        const content = state.cmEditor ? state.cmEditor.getValue() : '';

        if (!content.trim()) {
            showStatus('Nothing to share - editor is empty');
            return;
        }

        const token = getGitHubToken();

        if (token) {
            // Already authenticated, create gist directly
            await createGist(token, content);
        } else {
            // Need to authenticate first
            await startDeviceFlow();
        }
    } finally {
        state.gistShareInProgress = false;
    }
}

// ==========================================
// OAUTH DEVICE FLOW FUNCTIONS
// ==========================================

/**
 * Start the GitHub Device Flow authentication
 * Requests device and user codes from OAuth proxy
 */
export async function startDeviceFlow() {
    showGistModal('Connecting to GitHub...', `
        <p><span class="spinner"></span>Requesting authorization...</p>
    `);

    try {
        const response = await fetch(`${OAUTH_PROXY_URL}/device/code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error_description || data.error);
        }

        // Store device flow state
        state.gistAuthState = {
            deviceCode: data.device_code,
            userCode: data.user_code,
            verificationUri: data.verification_uri,
            expiresAt: Date.now() + (data.expires_in * 1000),
            interval: data.interval || 5,
            pollTimeoutId: null
        };

        // Show the user code to the user
        showDeviceCodeUI();

        // Start polling for token
        pollForToken();

    } catch (error) {
        console.error('Device flow error:', error);
        showGistModal('Connection Error', `
            <p class="status-text error">${escapeHtml(error.message)}</p>
            <p>Make sure the OAuth proxy is configured and running.</p>
            <div class="modal-buttons">
                <button class="btn" onclick="hideGistModal()">Close</button>
                <button class="btn btn-success" onclick="startDeviceFlow()">Retry</button>
            </div>
        `);
    }
}

/**
 * Show the device code UI for user to authorize
 */
function showDeviceCodeUI() {
    showGistModal('Authorize with GitHub', `
        <p>Enter this code at GitHub to authorize Merview:</p>
        <div class="device-code">${escapeHtml(state.gistAuthState.userCode)}</div>
        <p>The code expires in 15 minutes.</p>
        <div class="modal-buttons">
            <button class="btn" onclick="hideGistModal()">Cancel</button>
            <button class="btn btn-github" onclick="openGitHubAuth()">
                Open GitHub
            </button>
        </div>
        <p class="status-text"><span class="spinner"></span>Waiting for authorization...</p>
    `);
}

/**
 * Open GitHub's device authorization page in new tab
 */
export function openGitHubAuth() {
    globalThis.open(state.gistAuthState.verificationUri, '_blank', 'noopener,noreferrer');
}

/**
 * Poll for access token after user authorizes
 * Implements GitHub's OAuth device flow polling mechanism
 */
async function pollForToken() {
    // Check if expired
    if (Date.now() > state.gistAuthState.expiresAt) {
        showGistModal('Authorization Expired', `
            <p class="status-text error">The authorization code has expired.</p>
            <div class="modal-buttons">
                <button class="btn" onclick="hideGistModal()">Cancel</button>
                <button class="btn btn-success" onclick="startDeviceFlow()">Try Again</button>
            </div>
        `);
        return;
    }

    try {
        const response = await fetch(`${OAUTH_PROXY_URL}/device/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_code: state.gistAuthState.deviceCode })
        });

        const data = await response.json();

        if (data.error) {
            if (data.error === 'authorization_pending') {
                // User hasn't authorized yet, keep polling
                const pollInterval = Math.max(state.gistAuthState.interval * 1000, MIN_POLL_INTERVAL_MS);
                state.gistAuthState.pollTimeoutId = setTimeout(pollForToken, pollInterval);
                return;
            } else if (data.error === 'slow_down') {
                // Increase polling interval
                state.gistAuthState.interval += (POLL_INTERVAL_INCREMENT_MS / 1000);
                const pollInterval = Math.max(state.gistAuthState.interval * 1000, MIN_POLL_INTERVAL_MS);
                state.gistAuthState.pollTimeoutId = setTimeout(pollForToken, pollInterval);
                return;
            } else if (data.error === 'expired_token') {
                showGistModal('Authorization Expired', `
                    <p class="status-text error">The authorization code has expired.</p>
                    <div class="modal-buttons">
                        <button class="btn" onclick="hideGistModal()">Cancel</button>
                        <button class="btn btn-success" onclick="startDeviceFlow()">Try Again</button>
                    </div>
                `);
                return;
            } else if (data.error === 'access_denied') {
                showGistModal('Authorization Denied', `
                    <p class="status-text error">You denied the authorization request.</p>
                    <div class="modal-buttons">
                        <button class="btn" onclick="hideGistModal()">Close</button>
                        <button class="btn btn-success" onclick="startDeviceFlow()">Try Again</button>
                    </div>
                `);
                return;
            } else {
                throw new Error(data.error_description || data.error);
            }
        }

        // Success! We have an access token
        if (data.access_token) {
            saveGitHubToken(data);

            // Now create the gist
            const content = state.cmEditor ? state.cmEditor.getValue() : '';
            await createGist(data.access_token, content);
        }

    } catch (error) {
        console.error('Token polling error:', error);
        showGistModal('Authorization Error', `
            <p class="status-text error">${escapeHtml(error.message)}</p>
            <div class="modal-buttons">
                <button class="btn" onclick="hideGistModal()">Cancel</button>
                <button class="btn btn-success" onclick="startDeviceFlow()">Try Again</button>
            </div>
        `);
    }
}

// ==========================================
// GIST CREATION FUNCTION
// ==========================================

/**
 * Create a GitHub Gist with the current content
 * @param {string} token - GitHub OAuth access token
 * @param {string} content - Markdown content to share
 */
async function createGist(token, content) {
    showGistModal('Creating Gist...', `
        <p><span class="spinner"></span>Uploading to GitHub...</p>
    `);

    // Determine filename
    const filename = state.currentFilename || 'document.md';

    // Extract first heading or use generic description
    const firstLine = content.split('\n').find(line => line.trim().startsWith('#'));
    const description = firstLine
        ? firstLine.replace(/^#+\s*/, '').trim().substring(0, 100)
        : 'Shared from Merview';

    // Set up AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: description,
                public: false, // Secret gist (unlisted but accessible via URL)
                files: {
                    [filename]: {
                        content: content
                    }
                }
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            // Handle token expiration
            if (response.status === 401) {
                clearGitHubToken();
                throw new Error('GitHub authorization expired. Please authorize again.');
            }

            throw new Error(errorData.message || `GitHub API error: ${response.status}`);
        }

        const gist = await response.json();

        // Build the shareable Merview URL
        const rawUrl = gist.files[filename].raw_url;
        const mviewUrl = `${globalThis.location.origin}${globalThis.location.pathname}?url=${encodeURIComponent(rawUrl)}`;

        // Show success with the URL
        showGistModal('Gist Created!', `
            <p class="status-text success">Your document has been shared!</p>
            <p>Shareable link:</p>
            <div class="url-display">${escapeHtml(mviewUrl)}</div>
            <div class="modal-buttons">
                <button class="btn" onclick="hideGistModal()">Close</button>
                <button class="btn btn-success" data-copy-url="${escapeHtml(mviewUrl)}">
                    Copy Link
                </button>
                <button class="btn btn-github" data-open-url="${escapeHtml(gist.html_url)}">
                    View on GitHub
                </button>
            </div>
        `);

        // Also copy to clipboard automatically
        try {
            await navigator.clipboard.writeText(mviewUrl);
            showStatus('Link copied to clipboard!');
        } catch (error) {
            // Intentionally silent - clipboard access may be denied by browser policy.
            // User can use the "Copy Link" button as an alternative.
            console.debug('Auto-copy to clipboard failed (expected if permissions denied):', error.message);
        }

    } catch (error) {
        clearTimeout(timeoutId);
        console.error('Gist creation error:', error);

        // Handle abort/timeout error
        if (error.name === 'AbortError') {
            showGistModal('Request Timeout', `
                <p class="status-text error">The request to GitHub timed out after 30 seconds.</p>
                <p>Please check your connection and try again.</p>
                <div class="modal-buttons">
                    <button class="btn" onclick="hideGistModal()">Close</button>
                    <button class="btn btn-success" onclick="shareToGist()">Retry</button>
                </div>
            `);
            return;
        }

        // If auth expired, prompt to re-auth
        if (error.message.includes('authorization expired')) {
            showGistModal('Authorization Expired', `
                <p class="status-text error">${escapeHtml(error.message)}</p>
                <div class="modal-buttons">
                    <button class="btn" onclick="hideGistModal()">Cancel</button>
                    <button class="btn btn-success" onclick="startDeviceFlow()">Authorize Again</button>
                </div>
            `);
        } else {
            showGistModal('Error Creating Gist', `
                <p class="status-text error">${escapeHtml(error.message)}</p>
                <div class="modal-buttons">
                    <button class="btn" onclick="hideGistModal()">Close</button>
                    <button class="btn btn-success" onclick="shareToGist()">Retry</button>
                </div>
            `);
        }
    }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Copy gist URL to clipboard
 * @param {string} url - URL to copy
 */
export async function copyGistUrl(url) {
    try {
        await navigator.clipboard.writeText(url);
        showStatus('Link copied to clipboard!');
    } catch (error) {
        // Clipboard API may fail due to permissions or browser support
        console.debug('Clipboard copy failed:', error.message);
        showStatus('Failed to copy - please copy manually');
    }
}

/**
 * Disconnect GitHub (clear token)
 * Can be called from console for debugging
 */
export function disconnectGitHub() {
    clearGitHubToken();
    showStatus('GitHub disconnected');
}

// ==========================================
// EVENT LISTENERS
// ==========================================

// Close modal when clicking backdrop (outside modal content)
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('gistModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            // Close if clicking on the dialog backdrop itself
            if (e.target === modal) {
                hideGistModal();
            }
        });

        // Handle data-copy-url buttons (prevents XSS via onclick)
        modal.addEventListener('click', function(e) {
            const copyBtn = e.target.closest('[data-copy-url]');
            if (copyBtn) {
                const url = copyBtn.dataset.copyUrl;
                if (url) {
                    copyGistUrl(url);
                }
            }
        });

        // Handle data-open-url buttons (prevents XSS via onclick)
        modal.addEventListener('click', function(e) {
            const openBtn = e.target.closest('[data-open-url]');
            if (openBtn) {
                const url = openBtn.dataset.openUrl;
                if (url) {
                    window.open(url, '_blank');
                }
            }
        });
    }

    // Note: ESC key is handled automatically by <dialog> element
});

// Cleanup polling on page unload
window.addEventListener('beforeunload', function() {
    if (state.gistAuthState.pollTimeoutId) {
        clearTimeout(state.gistAuthState.pollTimeoutId);
        state.gistAuthState.pollTimeoutId = null;
    }
});
