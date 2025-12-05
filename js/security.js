/**
 * Security Module - URL validation, token stripping, and private URL handling
 *
 * This module provides security-related functions for:
 * - Validating CSS and Markdown URLs against allowlists
 * - Stripping sensitive GitHub tokens from URLs
 * - Validating CSS background color values
 * - Managing the private URL warning modal
 */

import { ALLOWED_CSS_DOMAINS, ALLOWED_MARKDOWN_DOMAINS } from './config.js';
import { state } from './state.js';

/**
 * Validate URL against allowlist (HTTPS only, case-insensitive)
 * @param {string} url - The CSS URL to validate
 * @returns {boolean} True if URL is allowed
 */
export function isAllowedCSSURL(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
            console.warn('CSS URL blocked: HTTPS required, got', parsed.protocol);
            return false;
        }
        const isAllowed = ALLOWED_CSS_DOMAINS.includes(parsed.hostname.toLowerCase());
        if (isAllowed) {
            return true;
        }
        console.warn('CSS URL blocked: domain not in allowlist:', parsed.hostname);
        return false;
    } catch (error) {
        console.warn('CSS URL blocked: invalid URL format:', url, error.message);
        return false;
    }
}

/**
 * Validate markdown URL against allowlist (HTTPS only, case-insensitive)
 * @param {string} url - The markdown URL to validate
 * @returns {boolean} True if URL is allowed
 */
export function isAllowedMarkdownURL(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
            console.warn('Markdown URL blocked: HTTPS required, got', parsed.protocol);
            return false;
        }
        const isAllowed = ALLOWED_MARKDOWN_DOMAINS.includes(parsed.hostname.toLowerCase());
        if (!isAllowed) {
            console.warn('Markdown URL blocked: domain not in allowlist:', parsed.hostname);
        }
        return isAllowed;
    } catch (error) {
        console.warn('Markdown URL blocked: invalid URL format:', url, error.message);
        return false;
    }
}

/**
 * Security: Strip sensitive tokens from GitHub URLs
 * Private repo raw URLs contain ?token=XXX which should not be shared
 * @param {string} url - The URL to check and strip
 * @returns {Object} { cleanUrl, hadToken } where cleanUrl has token removed
 */
export function stripGitHubToken(url) {
    try {
        const parsed = new URL(url);
        // Check for token parameter on GitHub raw URLs
        if (parsed.hostname === 'raw.githubusercontent.com' && parsed.searchParams.has('token')) {
            parsed.searchParams.delete('token');
            return { cleanUrl: parsed.toString(), hadToken: true };
        }
        return { cleanUrl: url, hadToken: false };
    } catch {
        return { cleanUrl: url, hadToken: false };
    }
}

/**
 * Validate that a CSS value is a safe background color.
 * Prevents potentially malicious values like javascript: URLs.
 * @param {string} value - The CSS background value to validate
 * @returns {boolean} True if the value is a safe color format
 */
export function isValidBackgroundColor(value) {
    const trimmed = value.trim().toLowerCase();
    // Block dangerous patterns first (returns false to reject malicious input)
    if (trimmed.includes('javascript:') || trimmed.includes('url(')) { // NOSONAR S1523 - This BLOCKS dangerous URLs, doesn't execute them
        return false;
    }
    // Allow safe color formats:
    // - Hex: #fff, #ffffff, #ffffffff (with alpha)
    // - RGB/RGBA: rgb(0,0,0), rgba(0,0,0,0.5)
    // - HSL/HSLA: hsl(0,0%,0%), hsla(0,0%,0%,0.5)
    // - Named colors: white, black, transparent, etc.
    const safePatterns = [
        /^#[0-9a-f]{3,8}$/,                    // hex colors
        /^rgba?\s*\([^)]+\)$/,                 // rgb/rgba
        /^hsla?\s*\([^)]+\)$/,                 // hsl/hsla
        /^[a-z]+$/                             // named colors (no special chars)
    ];
    return safePatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Show the private URL security modal
 * Security: Strip URL from browser immediately when modal shows
 * This prevents users from copying the token-containing URL before choosing
 * @param {string} originalUrl - The URL with token (for fetching)
 * @returns {Promise<string>} Resolves to 'view-local', 'share-gist', or 'dismissed'
 */
export function showPrivateUrlModal(originalUrl) {
    // Security: Strip URL from browser immediately when modal shows
    // This prevents users from copying the token-containing URL before choosing
    globalThis.history.replaceState(null, '', globalThis.location.pathname);

    return new Promise((resolve) => {
        state.privateUrlState = { originalUrl, resolve };
        const modal = document.getElementById('privateUrlModal');
        modal.showModal();
    });
}

/**
 * Hide the private URL modal
 */
export function hidePrivateUrlModal() {
    const modal = document.getElementById('privateUrlModal');
    modal.close();
}

/**
 * Reset private URL state to prevent memory leaks
 */
export function resetPrivateUrlState() {
    state.privateUrlState = { originalUrl: null, resolve: null };
}

/**
 * Initialize private URL modal event handlers
 * Sets up button clicks and backdrop close handling
 * Should be called once during app initialization
 */
export function initPrivateUrlModalHandlers() {
    const privateModal = document.getElementById('privateUrlModal');
    if (!privateModal) {
        console.warn('Private URL modal not found in DOM');
        return;
    }

    // Handle option button clicks
    privateModal.addEventListener('click', async function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        // Capture state before hiding modal (in case of race conditions)
        const { originalUrl, resolve } = state.privateUrlState;
        hidePrivateUrlModal();

        // Import loadMarkdown and shareToGist dynamically to avoid circular dependencies
        const { loadMarkdownFromURL } = await import('./file-ops.js');
        const { shareToGist } = await import('./gist.js');
        const { showStatus } = await import('./utils.js');

        if (action === 'view-local') {
            // Load the content (URL already stripped when modal was shown)
            await loadMarkdownFromURL(originalUrl);
            showStatus('Content loaded locally (URL not shareable)', 'warning');

            if (resolve) resolve('view-local');
            resetPrivateUrlState();
        } else if (action === 'share-gist') {
            // Load content then trigger gist flow (URL already stripped)
            await loadMarkdownFromURL(originalUrl);
            shareToGist();

            if (resolve) resolve('share-gist');
            resetPrivateUrlState();
        }
    });

    // Close on backdrop click
    privateModal.addEventListener('click', async function(e) {
        if (e.target === privateModal) {
            // Capture state before hiding modal
            const { originalUrl, resolve } = state.privateUrlState;
            hidePrivateUrlModal();

            // If user dismisses, just load locally (URL already stripped)
            if (originalUrl) {
                const { loadMarkdownFromURL } = await import('./file-ops.js');
                const { showStatus } = await import('./utils.js');
                await loadMarkdownFromURL(originalUrl);
                showStatus('Content loaded locally (URL not shareable)', 'warning');
            }
            if (resolve) resolve('dismissed');
            resetPrivateUrlState();
        }
    });
}
