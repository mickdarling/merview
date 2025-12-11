/**
 * Configuration Constants for Merview
 *
 * This module centralizes all configuration constants used throughout the application,
 * including theme definitions, security allowlists, and OAuth settings.
 */

// ==========================================
// SYNTAX HIGHLIGHTING THEMES (Preview)
// ==========================================

/**
 * SRI hashes for CDN security - only themes that exist on cdnjs are included.
 * These hashes verify the integrity of syntax highlighting theme CSS files.
 */
export const syntaxThemeSRI = {
    "github-dark": "sha384-wH75j6z1lH97ZOpMOInqhgKzFkAInZPPSPlZpYKYTOqsaizPvhQZmAtLcPKXpLyH",
    "github": "sha384-eFTL69TLRZTkNfYZOLM+G04821K1qZao/4QLJbet1pP4tcF+fdXq/9CdqAbWRl/L",
    "vs2015": "sha384-BE+nmfgoK1j3fBxbLI64Jzf52Mx/QAyw+4O7GyPYevJnAyrljCoRtQkYNfCfuWPF",
    "monokai": "sha384-88Jvj9Q2LiBDwL7w3yciRTcH5q2zzvMFYIm4xX9/evqxJsxA33Xk9XYKcvUlPITo",
    "atom-one-dark": "sha384-oaMLBGEzBOJx3UHwac0cVndtX5fxGQIfnAeFZ35RTgqPcYlbprH9o9PUV/F8Le07",
    "atom-one-light": "sha384-w6Ujm1VWa9HYFqGc89oAPn/DWDi2gUamjNrq9DRvEYm2X3ClItg9Y9xs1ViVo5b5",
    "nord": "sha384-O/y538KpolLjYHZH8xqC17hcGWgjOw79vqDDhXNIT6Q7q3O5KVr29xbsaq9k6fSL",
    "tokyo-night-dark": "sha384-6PRNB60loRkq5oYgj0ETV33K0YsTUlab8qtfTGXhRgW5Nz1IpzS2zwj6UmlJEnyV",
    "tokyo-night-light": "sha384-lz4BwxazQPl/J1rzkk6RsFZF7C3C9nqhym6EpONldqrEQ42XNaYx9Saeo6wpqiy2",
    "night-owl": "sha384-xMH/akAd4WIJSWGsUlveLGugns8GuYeJglqHRpASAW0sSbPNVM+BIa4Xa/50+uaJ",
    "obsidian": "sha384-8YFghPfkz+a3Ed4rE78f/ccgF16mVMS3jvYmTGEFK06nkeIXmcgZsDWgefgDzWlI",
    "agate": "sha384-Yno0F1TwvVYWd95R9B4ViD8Z/XeywVsysQN8gRKbgRFu/jzdbWtrXEVNuBuUWR5I"
};

/**
 * Available syntax highlighting themes for PREVIEW code blocks (highlight.js).
 * Themes are grouped using optgroup for better organization.
 */
export const syntaxThemes = [
    { name: 'GitHub Dark', file: 'github-dark', default: true, group: 'Code Block Theme' },
    { name: 'GitHub Light', file: 'github', group: 'Code Block Theme' },
    { name: 'VS Code Dark+', file: 'vs2015', group: 'Code Block Theme' },
    { name: 'Monokai', file: 'monokai', group: 'Code Block Theme' },
    { name: 'Atom One Dark', file: 'atom-one-dark', group: 'Code Block Theme' },
    { name: 'Atom One Light', file: 'atom-one-light', group: 'Code Block Theme' },
    { name: 'Nord', file: 'nord', group: 'Code Block Theme' },
    { name: 'Tokyo Night Dark', file: 'tokyo-night-dark', group: 'Code Block Theme' },
    { name: 'Tokyo Night Light', file: 'tokyo-night-light', group: 'Code Block Theme' },
    { name: 'Night Owl', file: 'night-owl', group: 'Code Block Theme' },
    { name: 'Obsidian', file: 'obsidian', group: 'Code Block Theme' },
    { name: 'Agate', file: 'agate', group: 'Code Block Theme' },
    { name: 'Load from file...', source: 'file', group: 'Import' },
    { name: 'Load from URL...', source: 'url', group: 'Import' }
];

// ==========================================
// EDITOR THEMES (CodeMirror)
// ==========================================

/**
 * Available EDITOR themes (CodeMirror - local CSS files you can customize).
 * Themes are grouped using optgroup for better organization.
 */
export const editorThemes = [
    { name: 'Material Darker', file: 'material-darker', default: true, group: 'Editor Theme' },
    { name: 'GitHub Dark', file: 'github-dark', group: 'Editor Theme' },
    { name: 'Monokai', file: 'monokai', group: 'Editor Theme' },
    { name: 'Dracula', file: 'dracula', group: 'Editor Theme' },
    { name: 'Solarized Dark', file: 'solarized-dark', group: 'Editor Theme' },
    { name: 'Solarized Light', file: 'solarized-light', group: 'Editor Theme' },
    { name: 'Load from file...', source: 'file', group: 'Import' },
    { name: 'Load from URL...', source: 'url', group: 'Import' }
];

// ==========================================
// MERMAID DIAGRAM THEMES
// ==========================================

/**
 * Available Mermaid diagram themes.
 * 'Auto' mode automatically switches between 'default' (light) and 'dark' based on preview background.
 * Themes are grouped using optgroup for better organization.
 */
export const mermaidThemes = [
    { name: 'Auto', value: 'auto', default: true, description: 'Auto-detect based on preview background', group: 'Mermaid Theme' },
    { name: 'Default', value: 'default', description: 'Blue/gray tones (light)', group: 'Mermaid Theme' },
    { name: 'Forest', value: 'forest', description: 'Green tones', group: 'Mermaid Theme' },
    { name: 'Dark', value: 'dark', description: 'Dark background', group: 'Mermaid Theme' },
    { name: 'Neutral', value: 'neutral', description: 'Grayscale', group: 'Mermaid Theme' },
    { name: 'Base', value: 'base', description: 'Minimal, customizable', group: 'Mermaid Theme' },
    { name: 'Load from file...', source: 'file', group: 'Import' },
    { name: 'Load from URL...', source: 'url', group: 'Import' }
];

// ==========================================
// PREVIEW STYLES
// ==========================================

/**
 * Built-in custom styles (MIT licensed - created by us).
 * Styles are grouped using optgroup for better organization.
 * Separators are no longer needed as optgroups provide visual separation.
 */
export const availableStyles = [
    { name: 'None (No CSS)', file: '', source: 'none', group: 'Preview Style' },
    { name: 'Clean', file: 'styles/clean.css', source: 'local', default: true, group: 'Preview Style' },
    { name: 'Academic', file: 'styles/academic.css', source: 'local', group: 'Preview Style' },
    { name: 'GitHub', file: 'styles/github.css', source: 'local', group: 'Preview Style' },
    { name: 'Dark Mode', file: 'styles/dark.css', source: 'local', group: 'Preview Style' },
    { name: 'Monospace', file: 'styles/monospace.css', source: 'local', group: 'Preview Style' },
    { name: 'Newspaper', file: 'styles/newspaper.css', source: 'local', group: 'Preview Style' },
    { name: 'Respect Style Layout', file: '', source: 'toggle', group: 'Options' },
    { name: 'Load from file...', file: '', source: 'file', group: 'Import' },
    { name: 'Load from URL...', file: '', source: 'url', group: 'Import' },
    { name: 'MarkedCustomStyles (external)', file: '', source: 'repository',
      url: 'https://cdn.jsdelivr.net/gh/ttscoff/MarkedCustomStyles@master/',
      note: 'Third-party styles (license unclear)', group: 'Import' }
];

// ==========================================
// DOCUMENTATION URL CONFIGURATION
// ==========================================

/** Cached docs base URL (computed once on first access) */
let cachedDocsBaseUrl = null;

/**
 * Get the base URL for documentation files.
 * In development (localhost), serves docs from local server.
 * In production, serves from GitHub raw content.
 * Result is cached for performance.
 *
 * @returns {string} The base URL for docs (no trailing slash)
 */
export function getDocsBaseUrl() {
    if (cachedDocsBaseUrl !== null) {
        return cachedDocsBaseUrl;
    }

    const hostname = globalThis.location?.hostname || '';
    const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';

    if (isLocalDev) {
        // Local development - serve from local server
        // Port detection: uses actual port from URL if present (e.g., localhost:3000)
        // When port is empty string (default port), use protocol-appropriate default
        const port = globalThis.location?.port ||
                     (globalThis.location?.protocol === 'https:' ? '443' : '80');
        // Omit port from URL if it's the default for the protocol
        const protocol = globalThis.location?.protocol || 'http:';
        const isDefaultPort = (protocol === 'http:' && port === '80') ||
                              (protocol === 'https:' && port === '443');
        cachedDocsBaseUrl = isDefaultPort
            ? `${protocol}//localhost`
            : `${protocol}//localhost:${port}`;
    } else {
        // Production - serve from GitHub raw
        cachedDocsBaseUrl = 'https://raw.githubusercontent.com/mickdarling/merview/main';
    }

    return cachedDocsBaseUrl;
}

/**
 * Resolve a relative doc path to a full URL.
 * Handles paths like "docs/about.md" or "/docs/about.md"
 *
 * @param {string} docPath - Relative path to a doc file (e.g., "docs/about.md")
 * @returns {string} Full URL to the doc file
 */
export function resolveDocUrl(docPath) {
    // Normalize path - remove leading slash if present
    const normalizedPath = docPath.startsWith('/') ? docPath.slice(1) : docPath;
    return `${getDocsBaseUrl()}/${normalizedPath}`;
}

/**
 * Check if a URL parameter is a relative doc path that needs resolution.
 * Case-sensitive match for "docs/" prefix (lowercase only).
 * @param {string} url - The URL or path to check
 * @returns {boolean} True if this is a relative doc path
 */
export function isRelativeDocPath(url) {
    // Match paths like "docs/about.md" or "/docs/about.md"
    // Case-sensitive: "docs/" must be lowercase, filename allows mixed case
    // Only allow safe filename characters: alphanumeric, hyphen, underscore
    // This prevents path traversal and special character attacks
    return /^\/?(docs\/[\w-]+\.md)$/.test(url);
}

// ==========================================
// SECURITY ALLOWLISTS
// ==========================================

/**
 * Allowed domains for loading external CSS (security allowlist).
 * Only HTTPS URLs from these domains are permitted.
 */
export const ALLOWED_CSS_DOMAINS = [
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    'raw.githubusercontent.com',
    'gist.githubusercontent.com',
    'unpkg.com'
];

/**
 * REMOVED: Domain allowlist for markdown URLs (issue #201)
 * All HTTPS URLs are now allowed - content is sanitized by DOMPurify.
 * Security checks in isAllowedMarkdownURL() still enforce:
 * - HTTPS protocol (localhost exempted in dev)
 * - URL length limits
 * - No embedded credentials
 * - ASCII-only hostnames (prevents homograph attacks)
 */

// ==========================================
// OAUTH CONFIGURATION
// ==========================================

/**
 * Determine worker URL based on current origin to prevent unauthorized usage.
 * Returns null for unauthorized origins to disable the feature.
 */
export function getOAuthProxyUrl() {
    const hostname = globalThis.location.hostname;

    // Allow production domains and localhost
    const allowedDomains = ['merview.com', 'www.merview.com', 'localhost', '127.0.0.1'];

    if (allowedDomains.includes(hostname)) {
        return 'https://merview-github-oauth.mick-eba.workers.dev';
    }

    // Unauthorized origin - disable feature
    return null;
}

/**
 * OAuth proxy URL (origin-aware).
 * Returns the Cloudflare Worker URL for authorized origins, or null otherwise.
 */
export const OAUTH_PROXY_URL = getOAuthProxyUrl();

/**
 * Token expiry buffer in milliseconds.
 * Tokens are considered expired 5 minutes before their actual expiry time.
 */
export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
