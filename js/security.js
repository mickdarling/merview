/**
 * Security Module - URL validation, token stripping, and private URL handling
 *
 * This module provides security-related functions for:
 * - Validating CSS and Markdown URLs against allowlists
 * - Stripping sensitive GitHub tokens from URLs
 * - Validating CSS background color values
 * - Managing the private URL warning modal
 */

import { ALLOWED_CSS_DOMAINS } from './config.js';
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
 * Maximum allowed URL length for security validation.
 * 2048 bytes is the de facto standard limit supported by most browsers and servers:
 * - Internet Explorer: 2,083 characters
 * - Chrome, Firefox, Safari: ~32KB but 2KB is safe for compatibility
 * - Apache default: 8,190 bytes
 * - IIS default: 4,096 bytes
 * Using 2048 provides a safe, widely-compatible limit that prevents DoS via extremely long URLs.
 */
const MAX_URL_LENGTH = 2048;

/**
 * Check if a string contains only printable ASCII characters (no spaces)
 * Used to detect IDN/punycode homograph attacks in hostnames
 * Allows: ! through ~ (0x21-0x7E) - printable ASCII excluding space
 * Rejects: non-ASCII (> 127), control characters (< 32), and space (0x20)
 * @param {string} str - The string to check
 * @returns {boolean} True if string contains only printable non-space ASCII
 */
function _isASCII(str) {
    // Only allow printable ASCII excluding space (0x21-0x7E)
    // Hostnames cannot contain spaces, so this is stricter than general printable ASCII
    return /^[\x21-\x7E]*$/.test(str);
}

/**
 * Detect potential homograph attacks using mixed-script lookalike characters
 *
 * A homograph attack uses visually similar characters from different scripts to impersonate
 * legitimate domains. For example: "rаw.github.com" using Cyrillic 'а' (U+0430) instead of Latin 'a'.
 *
 * This function detects suspicious mixing of Latin characters with Cyrillic or Greek lookalikes.
 * Legitimate international domain names (IDN) use consistent scripts within a domain, so they pass.
 *
 * Detected character sets:
 * - Cyrillic homoglyphs (lowercase): а(U+0430)=a, е(U+0435)=e, о(U+043E)=o, р(U+0440)=p,
 *   с(U+0441)=c, х(U+0445)=x, у(U+0443)=y
 * - Cyrillic homoglyphs (uppercase): А(U+0410)=A, В(U+0412)=B, Е(U+0415)=E, К(U+041A)=K,
 *   М(U+041C)=M, Н(U+041D)=H, О(U+041E)=O, Р(U+0420)=P, Т(U+0422)=T, У(U+0423)=Y, Х(U+0425)=X
 * - Greek homoglyphs (lowercase): α(U+03B1)=a, ο(U+03BF)=o, υ(U+03C5)=u, ι(U+03B9)=i
 * - Greek homoglyphs (uppercase): Α(U+0391)=A, Β(U+0392)=B, Ε(U+0395)=E, Η(U+0397)=H,
 *   Ι(U+0399)=I, Κ(U+039A)=K, Μ(U+039C)=M, Ν(U+039D)=N, Ο(U+039F)=O, Ρ(U+03A1)=P,
 *   Τ(U+03A4)=T, Υ(U+03A5)=Y, Χ(U+03A7)=X
 *
 * Examples:
 * - "rаw.githubusercontent.com" (Cyrillic 'а') → true (ATTACK - mixed scripts)
 * - "gitНub.com" (Cyrillic 'Н') → true (ATTACK - mixed scripts)
 * - "例え.jp" (Japanese) → false (safe - consistent script)
 * - "中文.com" (Chinese) → false (safe - consistent script)
 * - "github.com" (Latin) → false (safe - pure ASCII)
 *
 * @param {string} str - The hostname string to check
 * @returns {boolean} True if the string appears to be a homograph attack
 */
function containsHomoglyphs(str) {
    // Cyrillic characters that look like Latin letters
    // Lowercase: а(U+0430)=a, е(U+0435)=e, о(U+043E)=o, р(U+0440)=p, с(U+0441)=c, х(U+0445)=x, у(U+0443)=y
    // Uppercase: А(U+0410)=A, В(U+0412)=B, Е(U+0415)=E, К(U+041A)=K, М(U+041C)=M, Н(U+041D)=H, О(U+041E)=O, Р(U+0420)=P, Т(U+0422)=T, У(U+0423)=Y, Х(U+0425)=X
    const cyrillicHomoglyphs = /[\u0430\u0435\u043E\u0440\u0441\u0445\u0443\u0410\u0412\u0415\u041A\u041C\u041D\u041E\u0420\u0422\u0423\u0425]/;

    // Greek characters that look like Latin letters
    // Lowercase: α(U+03B1)=a, ο(U+03BF)=o, υ(U+03C5)=u, ι(U+03B9)=i
    // Uppercase: Α(U+0391)=A, Β(U+0392)=B, Ε(U+0395)=E, Η(U+0397)=H, Ι(U+0399)=I, Κ(U+039A)=K, Μ(U+039C)=M, Ν(U+039D)=N, Ο(U+039F)=O, Ρ(U+03A1)=P, Τ(U+03A4)=T, Υ(U+03A5)=Y, Χ(U+03A7)=X
    const greekHomoglyphs = /[\u03B1\u03BF\u03C5\u03B9\u0391\u0392\u0395\u0397\u0399\u039A\u039C\u039D\u039F\u03A1\u03A4\u03A5\u03A7]/;

    // Latin alphabet characters (a-z, A-Z)
    const latinChars = /[a-zA-Z]/;

    const hasCyrillic = cyrillicHomoglyphs.test(str);
    const hasGreek = greekHomoglyphs.test(str);
    const hasLatin = latinChars.test(str);

    // Suspicious if mixing Latin with lookalike Cyrillic or Greek characters
    // This catches attacks like "rаw.github.com" (mixed Latin + Cyrillic)
    // But allows pure scripts like "例え.jp" (pure Japanese) or "中文.com" (pure Chinese)
    return (hasCyrillic || hasGreek) && hasLatin;
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
 * Normalize gist.github.com URLs to gist.githubusercontent.com raw URLs
 *
 * Handles the following transformations:
 * - gist.github.com/{user}/{id} → gist.githubusercontent.com/{user}/{id}/raw
 * - gist.github.com/{user}/{id}/{filename} → gist.githubusercontent.com/{user}/{id}/raw/{filename}
 * - Preserves query parameters and fragments
 * - Returns original URL unchanged if not a gist.github.com URL
 *
 * Examples:
 * - Input:  https://gist.github.com/splch/cc419f65d0bedd84ff29f2aa1db9273a
 *   Output: https://gist.githubusercontent.com/splch/cc419f65d0bedd84ff29f2aa1db9273a/raw
 *
 * - Input:  https://gist.github.com/user/abc123/file.md
 *   Output: https://gist.githubusercontent.com/user/abc123/raw/file.md
 *
 * Note: This function is kept separate from normalizeGitHubUrl() because:
 * 1. Different URL structure (gists use 2 path segments vs 4+ for github blobs)
 * 2. Different raw URL format (gist.githubusercontent.com with /raw vs raw.githubusercontent.com)
 * 3. Different query parameter handling (gists preserve fragments, github blobs don't)
 * The shared URL parsing code is minimal and extracting it would add complexity without benefit.
 *
 * @param {string} url - The URL to normalize
 * @returns {string} The normalized URL or original URL if not a gist
 */
export function normalizeGistUrl(url) {
    try {
        const parsed = new URL(url);

        // Only process gist.github.com URLs
        if (parsed.hostname !== 'gist.github.com') {
            return url;
        }

        // Parse pathname: /{user}/{gist_id} or /{user}/{gist_id}/{filename}
        // Remove leading slash and split
        const pathParts = parsed.pathname.slice(1).split('/').filter(p => p.length > 0);

        // Need at least user and gist_id
        if (pathParts.length < 2) {
            return url;
        }

        const user = pathParts[0];
        const gistId = pathParts[1];
        const filename = pathParts.length > 2 ? pathParts.slice(2).join('/') : null;

        // Build raw URL
        let rawPath = `/${user}/${gistId}/raw`;
        if (filename) {
            rawPath += `/${filename}`;
        }

        // Construct new URL with gist.githubusercontent.com
        const rawUrl = new URL(`https://gist.githubusercontent.com${rawPath}`);

        // Preserve query parameters and fragment
        rawUrl.search = parsed.search;
        rawUrl.hash = parsed.hash;

        return rawUrl.toString();
    } catch {
        // Invalid URL - return unchanged
        return url;
    }
}

/**
 * Normalize github.com blob URLs to raw.githubusercontent.com URLs
 *
 * Handles the following transformations:
 * - github.com/{user}/{repo}/blob/{branch}/{path} → raw.githubusercontent.com/{user}/{repo}/{branch}/{path}
 * - Returns original URL unchanged if not a github.com blob URL
 *
 * Examples:
 * - Input:  https://github.com/DollhouseMCP/mcp-server/blob/main/README.md
 *   Output: https://raw.githubusercontent.com/DollhouseMCP/mcp-server/main/README.md
 *
 * - Input:  https://github.com/user/repo/blob/develop/docs/guide.md
 *   Output: https://raw.githubusercontent.com/user/repo/develop/docs/guide.md
 *
 * Note: This function is kept separate from normalizeGistUrl() because:
 * 1. Different URL structure (blobs need 4+ path segments vs 2 for gists)
 * 2. Different raw URL format (raw.githubusercontent.com vs gist.githubusercontent.com with /raw)
 * 3. Different path manipulation (need to remove "blob" segment vs insert "raw" segment)
 * The shared URL parsing code is minimal and extracting it would add complexity without benefit.
 *
 * @param {string} url - The URL to normalize
 * @returns {string} The normalized URL or original URL if not a github blob URL
 */
export function normalizeGitHubUrl(url) {
    try {
        const parsed = new URL(url);

        // Only process github.com URLs
        if (parsed.hostname !== 'github.com') {
            return url;
        }

        // Parse pathname: /{user}/{repo}/blob/{branch}/{...path}
        const pathParts = parsed.pathname.slice(1).split('/').filter(p => p.length > 0);

        // Need at least user, repo, "blob", branch, and at least one path segment
        if (pathParts.length < 5 || pathParts[2] !== 'blob') {
            return url;
        }

        const user = pathParts[0];
        const repo = pathParts[1];
        // pathParts[2] is 'blob' - skip it
        const branch = pathParts[3];
        const filePath = pathParts.slice(4).join('/');

        // Build raw URL
        const rawUrl = new URL(`https://raw.githubusercontent.com/${user}/${repo}/${branch}/${filePath}`);

        // Preserve query parameters (but not fragment - raw URLs don't use them)
        rawUrl.search = parsed.search;

        return rawUrl.toString();
    } catch {
        // Invalid URL - return unchanged
        return url;
    }
}

/**
 * Normalize any GitHub-related URL to its raw content URL
 * Combines normalizeGistUrl and normalizeGitHubUrl for convenience
 *
 * @param {string} url - The URL to normalize
 * @returns {string} The normalized URL or original URL if not a GitHub URL
 */
export function normalizeGitHubContentUrl(url) {
    // First try gist normalization
    const normalized = normalizeGistUrl(url);
    if (normalized !== url) {
        return normalized;
    }

    // Then try github.com blob normalization
    return normalizeGitHubUrl(url);
}

/**
 * Validate markdown URL with security protections
 *
 * Security checks performed:
 * 1. HTTPS protocol required (localhost exempted in dev mode)
 * 2. URL length limit (prevents DoS with extremely long URLs)
 * 3. No embedded credentials (user:pass@host)
 * 4. Homograph attack detection (blocks mixed-script lookalikes, allows legitimate IDN)
 *
 * International domain names (IDN) like 例え.jp or 中文.com are allowed.
 * Content is sanitized by DOMPurify, so any HTTPS URL is safe to load.
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

        // Check for homograph attacks BEFORE URL parsing (browser converts to punycode)
        // This catches mixed-script attacks like rаw.githubusercontent.com (Cyrillic 'а' U+0430)
        // while allowing legitimate international domains like 例え.jp (Japanese) or 中文.com (Chinese)
        const rawHostname = extractHostnameFromString(url);
        if (rawHostname && containsHomoglyphs(rawHostname)) {
            console.warn('Markdown URL blocked: hostname contains mixed-script homoglyphs (possible homograph attack)');
            return false;
        }

        const parsed = new URL(url);

        // Check if we're running in local development (prevents DNS rebinding attacks)
        const currentHost = globalThis.location?.hostname || '';
        const isLocalDev = currentHost === 'localhost' || currentHost === '127.0.0.1';

        // Require HTTPS (except localhost when running in local dev)
        const targetHostname = parsed.hostname.toLowerCase();
        const isLocalhostTarget = targetHostname === 'localhost' || targetHostname === '127.0.0.1';
        if (parsed.protocol !== 'https:' && !(isLocalDev && isLocalhostTarget)) {
            console.warn('Markdown URL blocked: HTTPS required, got', parsed.protocol);
            return false;
        }

        // Block URLs with embedded credentials (security risk)
        if (parsed.username || parsed.password) {
            console.warn('Markdown URL blocked: URLs with credentials not allowed');
            return false;
        }

        // All HTTPS URLs are allowed (content is sanitized by DOMPurify)
        // Localhost is only allowed when BOTH the app AND target are localhost (prevents DNS rebinding)
        return parsed.protocol === 'https:' || (isLocalDev && isLocalhostTarget);
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
 * Detect if an error is a CORS error
 *
 * CORS errors manifest as TypeErrors in fetch() with specific patterns:
 * - "Failed to fetch" - most common CORS error message
 * - "NetworkError" - Firefox CORS error
 * - "Load failed" - Safari CORS error
 * - "Network request failed" - general network/CORS error
 *
 * Note: Browsers intentionally make CORS errors indistinguishable from network errors
 * for security reasons. This detection uses common patterns but may have false positives.
 *
 * @param {Error} error - The error object from fetch()
 * @param {Response|null} response - The response object (null if fetch failed)
 * @returns {boolean} True if error appears to be a CORS error
 */
export function isCorsError(error, response) {
    // If we have a response, it's not a CORS error (CORS fails before response)
    if (response?.ok) {
        return false;
    }

    // Check error type and message for CORS patterns
    if (error.name === 'TypeError') {
        const message = error.message.toLowerCase();
        const corsPatterns = [
            'failed to fetch',
            'networkerror',
            'load failed',
            'network request failed',
            'cross-origin'
        ];
        return corsPatterns.some(pattern => message.includes(pattern));
    }

    return false;
}

/**
 * Get user-friendly CORS error message with helpful guidance
 *
 * @param {string} url - The URL that caused the CORS error
 * @returns {string} Formatted error message with link to documentation
 */
export function getCorsErrorMessage(url) {
    try {
        const hostname = new URL(url).hostname;
        return `CORS Error: The server at ${hostname} doesn't allow cross-origin requests. See CORS documentation: /?url=docs/cors-configuration.md`;
    } catch {
        return 'CORS Error: This server doesn\'t allow cross-origin requests. See CORS documentation: /?url=docs/cors-configuration.md';
    }
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
