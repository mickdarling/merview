/**
 * main.js
 * Entry point module for the Merview application
 * Orchestrates all modules and handles initialization
 */

import { state } from './state.js';
import { initCodeMirror, getEditorContent, setEditorContent } from './editor.js';
import { renderMarkdown, scheduleRender } from './renderer.js';
import { initStyleSelector, initSyntaxThemeSelector, initEditorThemeSelector, initMermaidThemeSelector, initPreviewDragDrop, initURLModalHandlers, changeStyle, changeSyntaxTheme, changeEditorTheme, changeMermaidTheme, applyPreviewBackground } from './themes.js';
import { loadMarkdownFromURL, loadSample, openFile, saveFile, saveFileAs, isValidMarkdownFile, isValidMarkdownContentType, exportToPDF, initFileInputHandlers } from './file-ops.js';
import { initDocumentSelector, changeDocument, updateDocumentSelector } from './documents.js';
import { shareToGist, hideGistModal, openGitHubAuth, startDeviceFlow, copyGistUrl, disconnectGitHub } from './gist.js';
import { toggleLintPanel, validateCode } from './validation.js';
import { initMermaidFullscreen } from './mermaid-fullscreen.js';
import { isAllowedMarkdownURL, isAllowedCSSURL, stripGitHubToken, showPrivateUrlModal, initPrivateUrlModalHandlers, normalizeGistUrl, normalizeGitHubContentUrl } from './security.js';
import { isRelativeDocPath, resolveDocUrl } from './config.js';
import { getMarkdownContent, isFreshVisit, markSessionInitialized } from './storage.js';
import { showStatus } from './utils.js';
import { initResizeHandle } from './resize.js';
import { initSessions } from './sessions.js';
import { initSessionsModalHandlers } from './components/sessions-modal.js';

/**
 * Clear the editor content
 */
function clearEditor() {
    if (confirm('Are you sure you want to clear the editor?')) {
        if (state.cmEditor) {
            state.cmEditor.setValue('');
        }
        state.currentFilename = null;
        state.loadedFromURL = null;

        updateDocumentSelector();
        renderMarkdown();
        showStatus('Editor cleared');
    }
}

/**
 * Expose functions to globalThis for onclick handlers in HTML
 */
function exposeGlobalFunctions() {
    // State - exposed for testing and debugging
    // WARNING: Do not store sensitive data in state. See js/state.js for details.
    globalThis.state = state;

    // Editor functions
    globalThis.getEditorContent = getEditorContent;
    globalThis.setEditorContent = setEditorContent;
    globalThis.clearEditor = clearEditor;

    // Rendering functions
    globalThis.renderMarkdown = renderMarkdown;
    globalThis.loadSample = loadSample;

    // Gist/sharing functions
    globalThis.shareToGist = shareToGist;
    globalThis.hideGistModal = hideGistModal;
    globalThis.openGitHubAuth = openGitHubAuth;
    globalThis.startDeviceFlow = startDeviceFlow;
    globalThis.copyGistUrl = copyGistUrl;
    globalThis.disconnectGitHub = disconnectGitHub;

    // File operation functions
    globalThis.openFile = openFile;
    globalThis.saveFile = saveFile;
    globalThis.saveFileAs = saveFileAs;
    globalThis.isValidMarkdownFile = isValidMarkdownFile;
    globalThis.isValidMarkdownContentType = isValidMarkdownContentType;
    globalThis.exportToPDF = exportToPDF;

    // Document management functions
    // Only changeDocument needs to be global (for keyboard shortcuts)
    // updateDocumentSelector is needed globally due to circular dependency with file-ops.js
    // newDocument is internal - called via changeDocument('__new__')
    globalThis.changeDocument = changeDocument;
    globalThis.updateDocumentSelector = updateDocumentSelector;

    // Validation functions
    globalThis.toggleLintPanel = toggleLintPanel;
    globalThis.validateCode = validateCode;

    // Security functions
    globalThis.isAllowedMarkdownURL = isAllowedMarkdownURL;
    globalThis.isAllowedCSSURL = isAllowedCSSURL;
    globalThis.stripGitHubToken = stripGitHubToken;
    globalThis.normalizeGistUrl = normalizeGistUrl;
    globalThis.normalizeGitHubContentUrl = normalizeGitHubContentUrl;

    // Utility functions
    globalThis.showStatus = showStatus;
    globalThis.changeStyle = changeStyle;
    globalThis.changeSyntaxTheme = changeSyntaxTheme;
    globalThis.changeEditorTheme = changeEditorTheme;
    globalThis.changeMermaidTheme = changeMermaidTheme;
    globalThis.applyPreviewBackground = applyPreviewBackground;
}

/**
 * Set up keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S to save file
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveFile();
        }

        // Ctrl/Cmd + O to open file
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'o') {
            e.preventDefault();
            openFile();
        }

        // Ctrl/Cmd + Shift + O to open from URL
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
            e.preventDefault();
            changeDocument('__load_url__');
        }

        // Ctrl/Cmd + P to print/export PDF
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            exportToPDF();
        }
    });
}

/**
 * Handle loading content from a remote URL parameter.
 * Resolves relative doc paths and handles private repo tokens.
 * @param {string} remoteURL - The URL to load
 */
function handleRemoteURLParam(remoteURL) {
    let resolvedURL = remoteURL;

    // Resolve relative doc paths (e.g., "docs/about.md") to full URLs
    if (isRelativeDocPath(remoteURL)) {
        try {
            resolvedURL = resolveDocUrl(remoteURL);
        } catch (error) {
            console.error('Error resolving doc URL:', error);
            showStatus('Error loading documentation', 'warning');
            loadSavedContentOrSample();
            return;
        }
    }

    // Security: Check for GitHub private repo tokens
    const { hadToken } = stripGitHubToken(resolvedURL);

    if (hadToken) {
        // Show modal for private repo content
        showPrivateUrlModal(resolvedURL);
    } else {
        // Load normally with shareable URL
        loadMarkdownFromURL(resolvedURL);
    }
}

/**
 * Handle loading content from inline markdown parameter.
 * @param {string} inlineMarkdown - The URL-encoded markdown
 */
function handleInlineMarkdownParam(inlineMarkdown) {
    try {
        const decoded = decodeURIComponent(inlineMarkdown);
        setEditorContent(decoded);
        renderMarkdown();
    } catch (error) {
        console.error('Error decoding inline markdown:', error);
        showStatus('Error loading markdown from URL', 'warning');
        loadSavedContentOrSample();
    }
}

/**
 * Handle URL parameters to load content or apply styles
 *
 * URL parameters (?url=, ?md=) intentionally override the "fresh visit = sample document"
 * behavior. When a user shares a link with content parameters, they expect that content
 * to load regardless of whether it's a fresh visit or not.
 *
 * Priority order:
 * 1. ?sample - loads sample/welcome document
 * 2. ?url= parameter - loads from remote URL
 * 3. ?md= parameter - loads inline markdown
 * 4. No parameters - uses fresh visit detection (sample or localStorage)
 */
function handleURLParameters() {
    const urlParams = new URLSearchParams(globalThis.location.search);

    // Check for sample parameter - explicitly load the sample/welcome document
    if (urlParams.has('sample')) {
        loadSample();
        markSessionInitialized();
        return;
    }

    // Check for remote URL parameter
    const remoteURL = urlParams.get('url');
    if (remoteURL) {
        handleRemoteURLParam(remoteURL);
        markSessionInitialized();
        applyStyleParam(urlParams);
        return;
    }

    // Check for inline markdown parameter
    const inlineMarkdown = urlParams.get('md');
    if (inlineMarkdown) {
        handleInlineMarkdownParam(inlineMarkdown);
        markSessionInitialized();
        applyStyleParam(urlParams);
        return;
    }

    // No URL parameters - use fresh visit detection to decide content
    loadSavedContentOrSample();
    markSessionInitialized();
    applyStyleParam(urlParams);
}

/**
 * Apply style parameter if present
 * @param {URLSearchParams} urlParams - The URL parameters
 */
function applyStyleParam(urlParams) {
    const styleParam = urlParams.get('style');
    if (styleParam) {
        changeStyle(styleParam);
    }
}

/**
 * Load saved content from localStorage or load sample
 * Fresh visits (new tab/window) always load the sample document.
 * Same-session refreshes preserve the user's localStorage content.
 *
 * Note: markSessionInitialized() is called by handleURLParameters() after
 * this function returns, so we don't call it here.
 */
function loadSavedContentOrSample() {
    // Fresh visit = new tab/window, always show sample for predictable UX
    // This also addresses minor security concern of cached content persisting
    if (isFreshVisit()) {
        loadSample();
        return;
    }

    // Same session (refresh) - restore saved content if available
    const saved = getMarkdownContent();
    if (saved) {
        setEditorContent(saved);
        renderMarkdown();
    } else {
        loadSample();
    }
}

/**
 * Initialize brand home link click handler
 * Provides smooth UX by loading sample without page reload,
 * while keeping href as fallback for accessibility (right-click, new tab)
 */
function initBrandHomeLink() {
    const brandHomeLink = document.getElementById('brandHomeLink');
    if (brandHomeLink) {
        brandHomeLink.addEventListener('click', (e) => {
            e.preventDefault();
            loadSample();
            showStatus('Welcome document loaded');
        });
    }
}

/**
 * Initialize the application on DOMContentLoaded
 */
function initializeApp() {
    // Set dynamic copyright year
    const copyrightYear = document.getElementById('copyright-year');
    if (copyrightYear) {
        copyrightYear.textContent = new Date().getFullYear();
    }

    // Initialize CodeMirror with scheduleRender as the change callback
    initCodeMirror(scheduleRender);

    // Initialize theme selectors
    // IMPORTANT: Mermaid theme must be initialized BEFORE style selector,
    // so user's saved theme preference is loaded before style triggers auto-detection
    initMermaidThemeSelector();
    initStyleSelector();
    initSyntaxThemeSelector();
    initEditorThemeSelector();

    // Initialize preview drag-and-drop for CSS files
    initPreviewDragDrop();

    // Initialize file input handlers
    initFileInputHandlers();

    // Initialize sessions system (before document selector)
    initSessions();

    // Initialize document selector
    initDocumentSelector();

    // Initialize sessions modal handlers
    initSessionsModalHandlers();

    // Initialize brand home link (logo click handler)
    initBrandHomeLink();

    // Initialize private URL modal handlers
    initPrivateUrlModalHandlers();

    // Initialize URL input modal handlers (for theme/content loading)
    initURLModalHandlers();

    // Initialize mermaid fullscreen handlers (exposes global functions)
    initMermaidFullscreen();

    // Initialize panel resize handle
    initResizeHandle();

    // Expose global functions for onclick handlers
    exposeGlobalFunctions();

    // Set up keyboard shortcuts
    setupKeyboardShortcuts();

    // Handle URL parameters (this will trigger initial render if content is loaded)
    handleURLParameters();
}

// Wait for DOM to be ready, then initialize
document.addEventListener('DOMContentLoaded', initializeApp);
