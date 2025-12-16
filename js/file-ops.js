/**
 * File Operations Module - File I/O, drag-and-drop, and PDF export
 *
 * This module handles:
 * - Opening and loading markdown files (file picker + drag-and-drop)
 * - Saving markdown files (Save, Save As)
 * - Loading markdown from URLs
 * - File validation (markdown MIME types and extensions)
 * - PDF export (print dialog and new tab)
 * - Sample markdown content loading
 *
 * DEPRECATION NOTE (PR #203, Issue #199):
 * The exportToPDFDirect() function was removed in this PR. It opened the preview
 * in a new tab/window and triggered print dialog, allowing better control over
 * what gets printed. This functionality is no longer accessible from the UI
 * (no button or menu item calls it), but was still being maintained. The function
 * can be restored from git history if needed in the future.
 */

import { state } from './state.js';
import { getElements } from './dom.js';
import { showStatus, setURLParameter, clearURLParameter } from './utils.js';
import { isAllowedMarkdownURL, normalizeGitHubContentUrl, isCorsError, getCorsErrorMessage } from './security.js';
import { renderMarkdown } from './renderer.js';
import { restorePanelWidths } from './resize.js';

/**
 * Validate file type (text or markdown)
 * Security: Only accept specific MIME types or valid markdown extensions
 * Empty MIME type requires valid extension (some browsers don't set MIME for .md files)
 * @param {File} file - The file to validate
 * @returns {boolean} True if file is a valid markdown/text file
 */
export function isValidMarkdownFile(file) {
    const validMimeTypes = ['text/plain', 'text/markdown', 'text/x-markdown'];
    const validExtensions = /\.(md|markdown|txt|text)$/i;

    // If MIME type is set and valid, accept
    if (file.type && validMimeTypes.includes(file.type)) {
        return true;
    }
    // If MIME type is empty or not in whitelist, require valid extension
    return validExtensions.test(file.name);
}

/**
 * Shared file loading logic (used by both file picker and drag-and-drop)
 * Loads a markdown file into the editor and updates the current filename
 * @param {File} file - The file to load
 * @returns {Promise<boolean>} True if successful, false on error
 */
export async function loadMarkdownFile(file) {
    try {
        const content = await file.text();
        const { cmEditor } = state;

        if (cmEditor) {
            cmEditor.setValue(content);
        }

        state.currentFilename = file.name;
        state.loadedFromURL = null; // Clear URL source when loading from file

        // Clear URL parameter from address bar when loading local file (Issue #204)
        clearURLParameter();

        // Update document selector to show the new name
        if (typeof globalThis.updateDocumentSelector === 'function') {
            globalThis.updateDocumentSelector();
        }

        await renderMarkdown();

        // Restore panel widths after loading new content (Issue #285)
        restorePanelWidths();

        showStatus(`Loaded: ${file.name}`);
        return true;
    } catch (error) {
        console.error('Error loading file:', error);
        showStatus(`Error loading file: ${error.message}`);
        return false;
    }
}

/** Fetch timeout in milliseconds (10 seconds) */
const FETCH_TIMEOUT_MS = 10000;

/** Maximum content size in bytes (10 MB) */
const MAX_CONTENT_SIZE = 10 * 1024 * 1024;

/**
 * Validate Content-Type header for markdown content
 * Defense-in-depth check to ensure we're loading text content
 *
 * Allowed types:
 * - text/* (text/plain, text/markdown, text/x-markdown, etc.)
 * - application/octet-stream (GitHub's default for raw files)
 * - No Content-Type header (some servers don't send it)
 *
 * Blocked types:
 * - application/javascript, text/javascript (executable code)
 * - text/html (could contain scripts)
 * - Binary types (application/zip, image/*, etc.)
 *
 * @param {string|null} contentType - The Content-Type header value
 * @returns {boolean} True if content type is acceptable
 */
export function isValidMarkdownContentType(contentType) {
    // No Content-Type header is acceptable (some servers don't send it)
    if (!contentType) {
        return true;
    }

    // Extract MIME type (ignore charset and other parameters)
    const mimeType = contentType.split(';')[0].trim().toLowerCase();

    // Block dangerous executable types first
    // Note: This validation relies on server sending truthful headers.
    // A compromised allowlisted domain could still send malicious content
    // with a spoofed Content-Type. Domain allowlisting is the primary defense.
    const blockedTypes = [
        'application/javascript',
        'text/javascript',
        'text/html',
        'application/x-javascript',
        'text/vbscript'  // Legacy VBScript (Windows IE)
    ];
    if (blockedTypes.includes(mimeType)) {
        console.warn('Content-Type blocked:', mimeType);
        return false;
    }

    // Allow text/* types (text/plain, text/markdown, etc.)
    if (mimeType.startsWith('text/')) {
        return true;
    }

    // Allow application/octet-stream (GitHub's default for raw files)
    if (mimeType === 'application/octet-stream') {
        return true;
    }

    // Block everything else (binary types, etc.)
    console.warn('Content-Type not allowed for markdown:', mimeType);
    return false;
}

/**
 * Load markdown from URL (with domain validation, timeout, size limits, and Content-Type validation)
 *
 * Security features:
 * - Gist URL normalization (converts gist.github.com to raw URLs)
 * - Domain allowlist validation
 * - 10 second fetch timeout (prevents hanging on slow endpoints)
 * - 10 MB content size limit (prevents loading extremely large files)
 * - Content-Type validation (blocks executable/binary content)
 *
 * @param {string} url - The URL to load markdown from
 * @returns {Promise<boolean>} True if successful, false on error
 */
export async function loadMarkdownFromURL(url) {
    // Normalize GitHub URLs (gist.github.com and github.com/blob) to raw URLs
    const normalizedUrl = normalizeGitHubContentUrl(url);

    if (!isAllowedMarkdownURL(normalizedUrl)) {
        showStatus('URL not allowed. Must be HTTPS, no credentials, valid length.');
        return false;
    }

    // Set up abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response = null;
    try {
        showStatus('Loading from URL...');
        // NOSONAR: Client-side request with user-controlled URL is intentional for this markdown viewer.
        // Security mitigations: HTTPS required, credentials blocked, homograph detection, content sanitized by DOMPurify
        response = await fetch(normalizedUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        // Check Content-Length header if available (first line of defense)
        const contentLength = response.headers.get('content-length');
        if (contentLength && Number.parseInt(contentLength, 10) > MAX_CONTENT_SIZE) {
            throw new Error(`File too large (${Math.round(Number.parseInt(contentLength, 10) / 1024 / 1024)}MB, max 10MB)`);
        }

        // Validate Content-Type header (defense-in-depth)
        const contentType = response.headers.get('content-type');
        if (!isValidMarkdownContentType(contentType)) {
            throw new Error('Invalid content type: expected text');
        }

        // Read response text (second line of defense - streaming check)
        const markdown = await response.text();

        // Verify actual content size (in case Content-Length was missing or incorrect)
        if (markdown.length > MAX_CONTENT_SIZE) {
            throw new Error(`File too large (${Math.round(markdown.length / 1024 / 1024)}MB, max 10MB)`);
        }

        const { cmEditor } = state;

        if (cmEditor) {
            cmEditor.setValue(markdown);
        }

        // Extract filename from normalized URL for display
        const urlPath = new URL(normalizedUrl).pathname;
        state.currentFilename = urlPath.split('/').pop() || 'remote.md';
        state.loadedFromURL = normalizedUrl; // Track URL source

        // Persist the original URL (not normalized) in address bar for sharing (Issue #204)
        // Use the original URL parameter so users can copy/share the exact URL they provided
        setURLParameter(url);

        // Update document selector to show the new name
        if (typeof globalThis.updateDocumentSelector === 'function') {
            globalThis.updateDocumentSelector();
        }

        await renderMarkdown();

        // Restore panel widths after loading new content (Issue #285)
        restorePanelWidths();

        showStatus(`Loaded: ${state.currentFilename}`);
        return true;
    } catch (error) {
        clearTimeout(timeoutId);

        // Provide user-friendly error messages
        if (error.name === 'AbortError') {
            console.error('Error loading URL: Request timed out');
            showStatus('Error loading URL: Request timed out (10s limit)');
        } else if (isCorsError(error, response)) {
            // CORS-specific error with helpful guidance
            const corsMessage = getCorsErrorMessage(normalizedUrl);
            console.error('CORS error loading URL:', error);
            showStatus(corsMessage);
        } else {
            console.error('Error loading URL:', error);
            showStatus(`Error loading URL: ${error.message}`);
        }
        return false;
    }
}

/**
 * Open file using native file picker
 * Triggers the hidden file input to show browser's file selection dialog
 */
export function openFile() {
    const mdFileInput = document.getElementById('mdFileInput');
    if (mdFileInput) {
        mdFileInput.click();
    }
}

/**
 * Save file (uses current filename or prompts for one)
 * If a filename is already set, saves directly. Otherwise calls saveFileAs()
 */
export function saveFile() {
    if (state.currentFilename) {
        downloadFile(state.currentFilename);
    } else {
        saveFileAs();
    }
}

/**
 * Save As - always prompts for filename
 * Shows a prompt dialog for the user to enter a filename
 */
export function saveFileAs() {
    const defaultName = state.currentFilename || 'document.md';
    const filename = prompt('Save as:', defaultName);

    if (filename) {
        // Ensure .md extension
        const finalName = filename.endsWith('.md') ? filename : filename + '.md';
        state.currentFilename = finalName;
        downloadFile(finalName);
    }
}

/**
 * Download the markdown content as a file
 * Creates a blob and triggers a download via a temporary anchor element
 * @param {string} filename - The filename to save as
 */
function downloadFile(filename) {
    const { cmEditor } = state;
    const content = cmEditor ? cmEditor.getValue() : '';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    // Clear URL parameter when saving (user is taking ownership of content) (Issue #204)
    clearURLParameter();

    showStatus(`Saved: ${filename}`);
}

/**
 * Centralized file drop handler
 * Handles drag-and-drop of markdown files onto the editor
 * @param {DragEvent} e - The drop event
 */
export async function handleFileDrop(e) {
    const files = e.dataTransfer.files;

    if (files.length === 0) {
        showStatus('No file dropped');
        return;
    }

    const file = files[0];

    // Validate file type
    if (!isValidMarkdownFile(file)) {
        showStatus('Please drop a text or markdown file');
        return;
    }

    await loadMarkdownFile(file);
}

/**
 * Export to PDF using browser's print dialog
 * Uses the browser's native print functionality with @media print CSS rules
 */
export function exportToPDF() {
    const { wrapper } = getElements();

    // Validate content exists
    if (!wrapper.innerHTML || wrapper.innerHTML.trim() === '') {
        showStatus('Error: No content to export');
        return;
    }

    // Use the browser's native print dialog
    // This will use our @media print CSS rules
    showStatus('Opening print dialog...');

    // Small delay to allow status message to show
    setTimeout(() => {
        globalThis.print();
    }, 100);
}


/**
 * Welcome page cache configuration
 *
 * Cache Lifetime & Invalidation Strategy:
 * - Cache persists for the duration of the page session (until page refresh)
 * - No automatic TTL expiration - content is static and rarely changes
 * - Cache is invalidated on:
 *   1. Page refresh (cache is in-memory only)
 *   2. Explicit call to clearWelcomePageCache()
 * - For development: manually call clearWelcomePageCache() or refresh to see changes
 *
 * @type {{content: string|null, timestamp: number|null}}
 */
const welcomeCache = {
    content: null,
    timestamp: null
};

/**
 * Cache TTL in milliseconds (optional, for development scenarios)
 * Set to 0 or null to disable TTL (default behavior - cache never expires)
 * Example: 5 * 60 * 1000 = 5 minutes for development
 * @type {number|null}
 */
const WELCOME_CACHE_TTL = null;

/**
 * Clear the welcome page cache (useful for testing and development)
 * @returns {void}
 */
export function clearWelcomePageCache() {
    welcomeCache.content = null;
    welcomeCache.timestamp = null;
}

/**
 * Check if the cache is valid (not expired)
 * @returns {boolean}
 */
function isCacheValid() {
    if (!welcomeCache.content) return false;
    if (!WELCOME_CACHE_TTL) return true; // No TTL, cache never expires
    if (!welcomeCache.timestamp) return false;
    return (Date.now() - welcomeCache.timestamp) < WELCOME_CACHE_TTL;
}

/**
 * Load welcome page markdown content
 * Loads the welcome document from docs/welcome.md with caching
 * to avoid repeated network requests when users click Welcome multiple times.
 */
export async function loadWelcomePage() {
    try {
        let content;

        // Use cached content if available and valid, otherwise fetch
        if (isCacheValid()) {
            content = welcomeCache.content;
        } else {
            const response = await fetch('docs/welcome.md');
            if (!response.ok) {
                throw new Error(`Failed to load welcome page: ${response.status} ${response.statusText}`);
            }
            content = await response.text();
            // Cache for future use with timestamp
            welcomeCache.content = content;
            welcomeCache.timestamp = Date.now();
        }

        const { cmEditor } = state;
        if (cmEditor) {
            cmEditor.setValue(content);
        }

        // Set document name for the welcome page
        state.currentFilename = 'Welcome.md';
        state.loadedFromURL = null;

        // Clear URL parameter when loading welcome page (Issue #204)
        clearURLParameter();

        // Update document selector to show the new name
        if (typeof globalThis.updateDocumentSelector === 'function') {
            globalThis.updateDocumentSelector();
        }

        renderMarkdown();

        // Restore panel widths after loading new content (Issue #285)
        restorePanelWidths();
    } catch (error) {
        console.error('Error loading welcome page:', error);
        showStatus('Error loading welcome page. Using offline fallback.', 'warning');

        // Minimal fallback content when fetch fails
        // NOTE: Keep this in sync with the essential content from docs/welcome.md
        // This is intentionally minimal - just enough to help users get started
        const fallbackContent = `# Welcome to Merview

A client-side Markdown editor with first-class Mermaid diagram support.

**Note:** Unable to load full welcome page. Please check your connection.

## Quick Start
1. Start typing markdown in this editor
2. See live preview on the right
3. Add Mermaid diagrams with \`\`\`mermaid code blocks
4. Export to PDF when ready

[Visit GitHub](https://github.com/mickdarling/merview) for documentation.`;

        const { cmEditor } = state;
        if (cmEditor) {
            cmEditor.setValue(fallbackContent);
        }

        // Set document name for the fallback
        state.currentFilename = 'Welcome.md';
        state.loadedFromURL = null;

        renderMarkdown();

        // Restore panel widths after loading fallback content (Issue #285)
        restorePanelWidths();
    }
}

/**
 * Initialize file input handlers
 * Creates the hidden file input element and sets up event listeners
 * Should be called once during app initialization
 */
export function initFileInputHandlers() {
    // Create the hidden file input if it doesn't exist
    let mdFileInput = document.getElementById('mdFileInput');
    if (!mdFileInput) {
        mdFileInput = document.createElement('input');
        mdFileInput.type = 'file';
        mdFileInput.id = 'mdFileInput';
        mdFileInput.accept = '.md,.markdown,.txt,.text';
        mdFileInput.style.display = 'none';
        document.body.appendChild(mdFileInput);
    }

    // Handle file selection from file picker
    mdFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Defensive validation (browser's accept attribute can be bypassed)
        if (!isValidMarkdownFile(file)) {
            showStatus('Please select a text or markdown file');
            mdFileInput.value = '';
            return;
        }

        await loadMarkdownFile(file);

        // Reset input so the same file can be selected again
        mdFileInput.value = '';
    });
}
