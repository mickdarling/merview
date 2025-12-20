/**
 * Utility functions for Merview
 * @module utils
 */

import { getElements } from './dom.js';

/** Brightness threshold for dark/light detection (0-255 scale, 127.5 = middle) */
const DARK_THEME_BRIGHTNESS_THRESHOLD = 127.5;

/**
 * URL length thresholds for warnings
 * - 2000 chars: Conservative limit that works across all major browsers
 * - Some browsers support up to 64KB, but 2000 is a safe practical limit
 * - IE11 had a 2083 char limit (no longer supported, but good reference point)
 * - Very long URLs are hard to share via email/chat/social media
 */
const URL_LENGTH_WARNING_THRESHOLD = 2000;
const URL_LENGTH_ERROR_THRESHOLD = 8000; // Hard limit before things break

/**
 * Escape HTML entities to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML text
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Convert text to URL-safe slug
 * @param {string} text - Text to slugify
 * @returns {string} URL-safe slug
 */
export function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replaceAll(/[^\w\s-]/g, '')   // Remove special chars (keeps letters, numbers, underscore, hyphen, space)
        .replaceAll(/[\s_]+/g, '-')    // Replace spaces and underscores with hyphens
        .replaceAll(/-+/g, '-')        // Collapse multiple hyphens
        .replaceAll(/(^-)|(-$)/g, '');     // Trim leading/trailing hyphens
}

/**
 * Parse a color string to RGB values
 * Supports hex (#fff, #ffffff), rgb(), rgba(), and common named colors
 * @param {string} colorString - CSS color value
 * @returns {{r: number, g: number, b: number}|null} RGB values (0-255) or null if unparseable
 */
export function parseColorToRGB(colorString) {
    if (!colorString || typeof colorString !== 'string') return null;

    const color = colorString.trim().toLowerCase();

    // Named colors (common dark/light ones)
    const namedColors = {
        'white': { r: 255, g: 255, b: 255 },
        'black': { r: 0, g: 0, b: 0 },
        'transparent': { r: 255, g: 255, b: 255 }, // Treat transparent as white
        'darkgray': { r: 169, g: 169, b: 169 },
        'darkgrey': { r: 169, g: 169, b: 169 },
        'lightgray': { r: 211, g: 211, b: 211 },
        'lightgrey': { r: 211, g: 211, b: 211 },
        'gray': { r: 128, g: 128, b: 128 },
        'grey': { r: 128, g: 128, b: 128 },
    };

    if (namedColors[color]) {
        return namedColors[color];
    }

    // Hex color (#fff or #ffffff)
    const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(color);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        return {
            r: Number.parseInt(hex.substring(0, 2), 16),
            g: Number.parseInt(hex.substring(2, 4), 16),
            b: Number.parseInt(hex.substring(4, 6), 16)
        };
    }

    // RGB/RGBA color
    const rgbMatch = /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
    if (rgbMatch) {
        return {
            r: Number.parseInt(rgbMatch[1], 10),
            g: Number.parseInt(rgbMatch[2], 10),
            b: Number.parseInt(rgbMatch[3], 10)
        };
    }

    return null; // Cannot parse (CSS variables, gradients, etc.)
}

/**
 * Calculate relative luminance (brightness) of a color
 * Uses WCAG formula for perceptual brightness
 * @param {string} colorString - CSS color value
 * @returns {number} Brightness value 0 (black) to 255 (white), or 127.5 if unparseable
 */
export function getBrightness(colorString) {
    const rgb = parseColorToRGB(colorString);
    if (!rgb) return DARK_THEME_BRIGHTNESS_THRESHOLD; // Default to medium if parse fails

    // WCAG relative luminance formula (weighted for human perception)
    return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

/**
 * Determine if a color is dark (for theme selection)
 * @param {string} colorString - CSS color value
 * @returns {boolean} True if dark, false if light or unparseable
 */
export function isDarkColor(colorString) {
    return getBrightness(colorString) < DARK_THEME_BRIGHTNESS_THRESHOLD;
}

/**
 * Show status message to user
 * @param {string} message - Message to display
 * @param {string} type - Message type ('success', 'warning', or 'error')
 */
export function showStatus(message, type = 'success') {
    const { statusDiv } = getElements();
    statusDiv.textContent = message;
    statusDiv.classList.remove('warning', 'error');
    if (type === 'warning') {
        statusDiv.classList.add('warning');
    } else if (type === 'error') {
        statusDiv.classList.add('error');
    }
    statusDiv.classList.add('show');
    // Errors and warnings show longer (6s) than success messages (3s)
    const duration = (type === 'warning' || type === 'error') ? 6000 : 3000;
    setTimeout(() => {
        statusDiv.classList.remove('show', 'warning', 'error');
    }, duration);
}

/**
 * Update the URL parameter in the browser address bar without page reload
 * Used to persist the source URL for sharing/bookmarking (Issue #204)
 *
 * CHARACTER ENCODING STRATEGY (for future maintainers):
 * =====================================================
 * This function uses a minimal encoding approach to balance readability with URL correctness.
 *
 * CHARACTERS KEPT READABLE (NOT encoded):
 * - Alphanumeric: A-Z, a-z, 0-9
 * - Unreserved characters (RFC 3986 Section 2.3): - _ . ~
 * - Common URL delimiters: / : (needed for https://example.com/path structure)
 *
 * CHARACTERS THAT ARE ENCODED:
 * - Spaces → %20
 * - Query string special chars: & ? = # (would break URL parsing)
 * - Percent sign: % (reserved for encoding itself)
 * - Other special characters: @ ! $ ' ( ) * + , ; [ ] etc.
 *
 * WHY THIS APPROACH?
 * ------------------
 * Full encodeURIComponent() would turn:
 *   https://raw.githubusercontent.com/user/repo/main/file.md
 * Into:
 *   https%3A%2F%2Fraw.githubusercontent.com%2Fuser%2Frepo%2Fmain%2Efile.md
 *
 * This is technically correct but hard to read, making URLs less shareable.
 * By keeping / and : readable, the URL remains human-friendly while still
 * being functionally correct as a query parameter value.
 *
 * REFERENCE:
 * - RFC 3986 (URI Syntax): https://datatracker.ietf.org/doc/html/rfc3986
 *   - Section 2.3: Unreserved Characters
 *   - Section 3.4: Query component
 *
 * NOTE: Browser URL length limits apply (see URL_LENGTH_WARNING_THRESHOLD below)
 *
 * @param {string} url - The URL to set in the ?url= parameter
 */
export function setURLParameter(url) {
    try {
        const newUrl = new URL(globalThis.location.href);
        // Clear existing search params
        newUrl.search = '';
        // Manually construct search with minimal encoding
        // Characters we KEEP readable: / : . - _ ~ (safe in query values per RFC 3986)
        // Characters we MUST encode: space, &, #, ?, =, %, and other special chars
        const minimallyEncoded = url.replaceAll(/[^A-Za-z0-9\-._~:/]/g, (char) => {
            return encodeURIComponent(char);
        });
        newUrl.search = `?url=${minimallyEncoded}`;
        const finalUrl = newUrl.toString();

        // Check URL length (Issue #207 - URL length warnings)
        if (finalUrl.length > URL_LENGTH_ERROR_THRESHOLD) {
            console.error(`URL is extremely long (${finalUrl.length} chars, max recommended ${URL_LENGTH_ERROR_THRESHOLD})`);
            console.error('This may cause issues in some browsers and sharing platforms.');
            showStatus(`Warning: URL is very long (${finalUrl.length} chars). May not work in all browsers.`, 'warning');
        } else if (finalUrl.length > URL_LENGTH_WARNING_THRESHOLD) {
            console.warn(`URL is longer than recommended (${finalUrl.length} chars, recommended max ${URL_LENGTH_WARNING_THRESHOLD})`);
            console.warn('Consider using a URL shortener or hosting the content at a shorter URL.');
            // Only show subtle warning, don't block the user
            showStatus(`Note: Long URL (${finalUrl.length} chars). May be hard to share.`, 'warning');
        }

        history.replaceState(null, '', finalUrl);
    } catch (error) {
        console.error('Error updating URL parameter:', error);
    }
}

/**
 * Clear the URL parameter from the browser address bar
 * Called when loading local content or starting fresh (Issue #204)
 */
export function clearURLParameter() {
    try {
        const newUrl = new URL(globalThis.location.href);
        newUrl.searchParams.delete('url');
        history.replaceState(null, '', newUrl.toString());
    } catch (error) {
        console.error('Error clearing URL parameter:', error);
    }
}

/**
 * Check if a URL is relative (not absolute) and should be resolved
 * @param {string} url - URL to check
 * @returns {boolean} True if the URL is relative and should be resolved
 */
export function isRelativeUrl(url) {
    if (!url || typeof url !== 'string') return false;

    // Anchor links (starting with #) should not be resolved - they're page-internal
    if (url.startsWith('#')) return false;

    // Root-relative URLs (starting with /) should not be resolved - they're absolute paths
    // Examples: /docs/about.md, /?sample, /?url=...
    if (url.startsWith('/')) return false;

    // Absolute URLs start with protocol (http://, https://, etc.) or protocol-relative (//)
    // Also check for data: URIs, javascript:, mailto:, tel:, and other URI schemes
    const absolutePatterns = /^([a-z][a-z0-9+.-]*:|\/\/)/i;
    return !absolutePatterns.test(url);
}

/**
 * Extract the base URL (directory) from a full URL
 * For https://example.com/path/to/file.md returns https://example.com/path/to/
 * @param {string} url - Full URL to extract base from
 * @returns {string|null} Base URL (directory) or null if invalid
 */
export function getBaseUrl(url) {
    if (!url || typeof url !== 'string') return null;

    try {
        const urlObj = new URL(url);
        // Get the path and remove the filename (everything after last /)
        const pathParts = urlObj.pathname.split('/');
        pathParts.pop(); // Remove the filename
        urlObj.pathname = pathParts.join('/') + '/';
        // Return just origin + pathname (no query string or hash)
        return urlObj.origin + urlObj.pathname;
    } catch {
        return null;
    }
}

/**
 * Resolve a relative URL against a base URL
 * Handles ./, ../, and simple relative paths
 *
 * @param {string} relativeUrl - Relative URL to resolve (e.g., "./other.md", "../folder/file.md")
 * @param {string} baseUrl - Base URL to resolve against (can be a file URL, directory is inferred)
 * @returns {string|null} Resolved absolute URL or null if resolution fails
 *
 * @example
 * resolveRelativeUrl('./other.md', 'https://example.com/docs/guide.md')
 * // Returns: 'https://example.com/docs/other.md'
 *
 * @example
 * resolveRelativeUrl('../README.md', 'https://example.com/docs/guide.md')
 * // Returns: 'https://example.com/README.md'
 */
export function resolveRelativeUrl(relativeUrl, baseUrl) {
    if (!relativeUrl || !baseUrl) return null;

    // If it's already absolute, return as-is
    if (!isRelativeUrl(relativeUrl)) {
        return relativeUrl;
    }

    try {
        // The URL constructor's second parameter handles base URL resolution directly.
        // It correctly infers the directory from a file URL (e.g., /docs/guide.md → /docs/)
        // and resolves relative paths (./, ../, simple names) against it.
        const resolved = new URL(relativeUrl, baseUrl);
        return resolved.href;
    } catch {
        return null;
    }
}

/**
 * Check if a URL points to a markdown or mermaid file
 * @param {string} url - URL to check
 * @returns {boolean} True if the URL appears to be a markdown or mermaid file
 */
export function isMarkdownUrl(url) {
    if (!url || typeof url !== 'string') return false;

    // Check file extension (case-insensitive) - includes .mermaid/.mmd (#367)
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith('.md') ||
           lowerUrl.endsWith('.markdown') ||
           lowerUrl.endsWith('.mermaid') ||
           lowerUrl.endsWith('.mmd');
}
