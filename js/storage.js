/**
 * storage.js - LocalStorage management for Merview
 * Handles persistent storage of user preferences, content, and GitHub tokens
 */

// Token expiry buffer - check if token expires within this time window
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

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
 * Get stored GitHub access token for Gist functionality
 * @returns {string|null} Access token or null if expired/invalid
 */
export function getGitHubToken() {
    try {
        const stored = localStorage.getItem('github_gist_token');
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
    localStorage.setItem('github_gist_token', JSON.stringify({
        accessToken: tokenData.access_token,
        expiresAt: expiresAt,
        scope: tokenData.scope
    }));
}

/**
 * Clear stored GitHub access token
 */
export function clearGitHubToken() {
    localStorage.removeItem('github_gist_token');
}

/**
 * Check if a GitHub token is expired or will expire soon
 * @returns {boolean} True if token is expired or doesn't exist
 */
export function isTokenExpired() {
    try {
        const stored = localStorage.getItem('github_gist_token');
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
