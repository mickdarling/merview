/**
 * storage.js - LocalStorage management for Merview
 * Handles persistent storage of user preferences, content, and GitHub tokens
 *
 * localStorage Key Naming Convention:
 * - All keys use kebab-case (e.g., 'markdown-content', 'cached-bg-color')
 * - Multi-word keys are separated by hyphens
 * - Session-specific keys use 'merview-' prefix (e.g., 'merview-sessions-index')
 */

import { TOKEN_EXPIRY_BUFFER_MS } from './config.js';

/**
 * Get saved markdown content from localStorage
 * @returns {string|null} Saved markdown content or null if none exists
 */
export function getMarkdownContent() {
    return localStorage.getItem('markdown-content');
}

/**
 * Save markdown content to localStorage
 * @param {string} content - The markdown content to save
 */
export function saveMarkdownContent(content) {
    localStorage.setItem('markdown-content', content);
}

/**
 * Get saved preview style preference
 * @returns {string|null} Saved style name or null
 */
export function getMarkdownStyle() {
    return localStorage.getItem('markdown-style');
}

/**
 * Save preview style preference
 * @param {string} styleName - The style name to save
 */
export function saveMarkdownStyle(styleName) {
    localStorage.setItem('markdown-style', styleName);
}

/**
 * Get saved syntax highlighting theme preference
 * @returns {string|null} Saved theme name or null
 */
export function getSyntaxTheme() {
    return localStorage.getItem('syntax-theme');
}

/**
 * Save syntax highlighting theme preference
 * @param {string} themeName - The theme name to save
 */
export function saveSyntaxTheme(themeName) {
    localStorage.setItem('syntax-theme', themeName);
}

/**
 * Get saved editor theme preference
 * @returns {string|null} Saved theme name or null
 */
export function getEditorTheme() {
    return localStorage.getItem('editor-theme');
}

/**
 * Save editor theme preference
 * @param {string} themeName - The theme name to save
 */
export function saveEditorTheme(themeName) {
    localStorage.setItem('editor-theme', themeName);
}

/**
 * Get saved Mermaid theme preference
 * @returns {string|null} Saved theme name or null (defaults to 'Auto')
 */
export function getMermaidTheme() {
    return localStorage.getItem('mermaid-theme');
}

/**
 * Save Mermaid theme preference
 * @param {string} themeName - The theme name to save ('Auto', 'default', 'forest', 'dark', 'neutral', 'base')
 */
export function saveMermaidTheme(themeName) {
    localStorage.setItem('mermaid-theme', themeName);
}

/**
 * Get "Respect Style Layout" toggle preference
 * @returns {boolean} True if style layout should be respected
 */
export function getRespectStyleLayout() {
    return localStorage.getItem('respect-style-layout') === 'true';
}

/**
 * Save "Respect Style Layout" toggle preference
 * @param {boolean} respectLayout - Whether to respect style layout
 */
export function saveRespectStyleLayout(respectLayout) {
    localStorage.setItem('respect-style-layout', respectLayout);
}

/**
 * Get "HR as Page Break" toggle preference
 * @returns {boolean} True if horizontal rules should trigger page breaks (default: true)
 */
export function getHRAsPageBreak() {
    const stored = localStorage.getItem('hr-page-break');
    // Default to true if not set (preserves current behavior)
    return stored === null ? true : stored === 'true';
}

/**
 * Save "HR as Page Break" toggle preference
 * @param {boolean} enabled - Whether horizontal rules should trigger page breaks
 */
export function saveHRAsPageBreak(enabled) {
    localStorage.setItem('hr-page-break', enabled);
}

/**
 * Get stored GitHub access token for Gist functionality
 * @returns {string|null} Access token or null if expired/invalid
 */
export function getGitHubToken() {
    try {
        // Migration: Check for old snake_case key and migrate to kebab-case
        const oldKey = 'github_gist_token';
        const newKey = 'github-gist-token';
        const oldStored = localStorage.getItem(oldKey);

        if (oldStored && !localStorage.getItem(newKey)) {
            // Migrate old token to new key
            localStorage.setItem(newKey, oldStored);
            localStorage.removeItem(oldKey);
        }

        const stored = localStorage.getItem(newKey);
        if (!stored) return null;

        const data = JSON.parse(stored);

        // Check if token is expired (with buffer)
        if (data.expiresAt && Date.now() > data.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
            clearGitHubToken();
            return null;
        }

        return data.accessToken;
    } catch {
        clearGitHubToken();
        return null;
    }
}

/**
 * Store GitHub access token with expiration
 * @param {Object} tokenData - Token data from OAuth response
 * @param {string} tokenData.access_token - The access token
 * @param {number} [tokenData.expires_in] - Token lifetime in seconds
 * @param {string} [tokenData.scope] - Token scope
 */
export function saveGitHubToken(tokenData) {
    const expiresAt = tokenData.expires_in
        ? Date.now() + (tokenData.expires_in * 1000)
        : null;

    // Store in localStorage (accessible to all scripts on this origin).
    // This is acceptable for Merview because:
    // 1. Token only grants 'gist' scope (limited permissions)
    // 2. No sensitive user data is stored
    // 3. Token expires and can be revoked on GitHub
    // For higher security needs, consider sessionStorage or in-memory only.
    localStorage.setItem('github-gist-token', JSON.stringify({
        accessToken: tokenData.access_token,
        expiresAt: expiresAt,
        scope: tokenData.scope
    }));
}

/**
 * Clear stored GitHub access token
 */
export function clearGitHubToken() {
    localStorage.removeItem('github-gist-token');
}

/**
 * Check if a GitHub token is expired or will expire soon
 * @returns {boolean} True if token is expired or doesn't exist
 */
export function isTokenExpired() {
    try {
        const stored = localStorage.getItem('github-gist-token');
        if (!stored) return true;

        const data = JSON.parse(stored);

        // Check if token is expired (with buffer)
        if (data.expiresAt && Date.now() > data.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
            return true;
        }

        return false;
    } catch {
        return true;
    }
}

// Session key for tracking fresh visits
const SESSION_INITIALIZED_KEY = 'merview-session-initialized';

/**
 * Check if this is a fresh visit (new browser session/tab)
 *
 * Uses sessionStorage which is cleared when the tab is closed.
 * This allows us to distinguish between:
 * - Fresh visit (new tab): should load sample document
 * - Same session (refresh/navigation): should preserve localStorage content
 *
 * Why sessionStorage over other approaches:
 * 1. Tab-scoped: Each tab has isolated sessionStorage, so each new tab is "fresh"
 * 2. Auto-clearing: Cleared when tab closes, no manual cleanup needed
 * 3. Simple: Just a boolean flag, no expiration logic or timestamps
 * 4. Privacy-friendly: Prevents cached content from persisting indefinitely
 *
 * Note on multi-tab behavior: Opening merview.com in a new tab will always show
 * the sample document, even if another tab has edited content. This is intentional
 * for privacy and predictable UX - see issue #137 for details.
 *
 * Browser compatibility: sessionStorage is supported in all modern browsers
 * (IE8+, all evergreen browsers). If sessionStorage is unavailable (e.g., private
 * browsing in some older browsers, or storage disabled), the getItem call returns
 * null and isFreshVisit() returns true, defaulting to showing the sample document.
 * This is safe fallback behavior.
 *
 * @returns {boolean} True if this is a fresh visit
 */
export function isFreshVisit() {
    return !sessionStorage.getItem(SESSION_INITIALIZED_KEY);
}

/**
 * Mark the current session as initialized
 * Called after initial content is loaded to prevent reloading sample on refresh
 */
export function markSessionInitialized() {
    sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');
}

/**
 * Get cached preview background color
 * Used to prevent Mermaid theme flash on back navigation (issue #175)
 * @returns {string|null} Cached background color or null
 */
export function getCachedBackgroundColor() {
    return localStorage.getItem('cached-bg-color');
}

/**
 * Save preview background color to cache
 * Used to prevent Mermaid theme flash on back navigation (issue #175)
 * @param {string} bgColor - Background color to cache
 */
export function saveCachedBackgroundColor(bgColor) {
    localStorage.setItem('cached-bg-color', bgColor);
}
