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

/** Maximum allowed URL length (matches common browser limits) */
const MAX_URL_LENGTH = 2048;

/**
 * Check if a string contains only printable ASCII characters (no spaces)
 * Used to detect IDN/punycode homograph attacks in hostnames
 * Allows: ! through ~ (0x21-0x7E) - printable ASCII excluding space
 * Rejects: non-ASCII (> 127), control characters (< 32), and space (0x20)
 * @param {string} str - The string to check
 * @returns {boolean} True if string contains only printable non-space ASCII
 */
function isASCII(str) {
    // Only allow printable ASCII excluding space (0x21-0x7E)
    // Hostnames cannot contain spaces, so this is stricter than general printable ASCII
    return /^[\x21-\x7E]*$/.test(str);
}

/**
 * Extract hostname from URL string without full parsing
 * Used to check for non-ASCII characters before browser normalizes to punycode
 *
 * This extracts the hostname portion between :// and the next / or : (port)
 * Example: "https://example.com:8080/path" → "example.com"
 *
 * Note: For URLs with credentials (user:pass@host), this extracts "user:pass@host"
 * which is semantically incorrect but doesn't affect security - the ASCII check
 * still works, and credentials are explicitly blocked in a separate check later.
 *
 * @param {string} url - The URL string to extract hostname from
 * @returns {string|null} The hostname (or user:pass@hostname) or null if extraction fails
 */
function extractHostnameFromString(url) {
    // Match content between :// and the next / or : (port) or end of string
    // Note: This intentionally doesn't strip credentials - see JSDoc above
    const hostnameRegex = /:\/\/([^/:]+)/;
    const match = hostnameRegex.exec(url);
    return match ? match[1] : null;
}

/**
 * Validate markdown URL against allowlist with security edge case protections
 *
 * Security checks performed:
 * 1. HTTPS protocol required
 * 2. URL length limit (prevents DoS with extremely long URLs)
 * 3. No embedded credentials (user:pass@host)
 * 4. ASCII-only hostname (prevents IDN homograph attacks)
 * 5. Domain must be in allowlist
 *
 * @param {string} url - The markdown URL to validate
 * @returns {boolean} True if URL is allowed
 */
export function isAllowedMarkdownURL(url) {
    try {
        // Check URL length before parsing (defense against DoS)
        if (url.length > MAX_URL_LENGTH) {
            console.warn('Markdown URL blocked: URL too long (' + url.length + ' chars, max ' + MAX_URL_LENGTH + ')');
            return false;
        }

        // Check for non-ASCII hostname BEFORE URL parsing (browser converts to punycode)
        // This catches IDN homograph attacks like rаw.githubusercontent.com (Cyrillic 'а' U+0430)
        const rawHostname = extractHostnameFromString(url);
        if (rawHostname && !isASCII(rawHostname)) {
            console.warn('Markdown URL blocked: non-ASCII hostname not allowed (possible homograph attack)');
            return false;
        }

        const parsed = new URL(url);

        // Require HTTPS
        if (parsed.protocol !== 'https:') {
            console.warn('Markdown URL blocked: HTTPS required, got', parsed.protocol);
            return false;
        }

        // Block URLs with embedded credentials (security risk)
        if (parsed.username || parsed.password) {
            console.warn('Markdown URL blocked: URLs with credentials not allowed');
            return false;
        }

        // Check against allowlist
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
