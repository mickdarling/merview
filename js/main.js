/**
 * main.js
 * Entry point module for the Merview application
 * Orchestrates all modules and handles initialization
 */

import { state } from './state.js';
import { initCodeMirror, getEditorContent, setEditorContent } from './editor.js';
import { renderMarkdown, scheduleRender } from './renderer.js';
import { initStyleSelector, initSyntaxThemeSelector, initEditorThemeSelector, initPreviewDragDrop, changeStyle, changeSyntaxTheme, changeEditorTheme, applyPreviewBackground } from './themes.js';
import { loadMarkdownFromURL, loadSample, openFile, saveFile, saveFileAs, isValidMarkdownFile, isValidMarkdownContentType, exportToPDF, exportToPDFDirect, initFileInputHandlers } from './file-ops.js';
import { shareToGist, hideGistModal, openGitHubAuth, startDeviceFlow, copyGistUrl, disconnectGitHub } from './gist.js';
import { toggleLintPanel, validateCode } from './validation.js';
import { initMermaidFullscreen } from './mermaid-fullscreen.js';
import { isAllowedMarkdownURL, stripGitHubToken, showPrivateUrlModal, initPrivateUrlModalHandlers } from './security.js';
import { getMarkdownContent, isFreshVisit, markSessionInitialized } from './storage.js';
import { showStatus } from './utils.js';
import { initResizeHandle } from './resize.js';

/**
 * Clear the editor content
 */
function clearEditor() {
    if (confirm('Are you sure you want to clear the editor?')) {
        if (state.cmEditor) {
            state.cmEditor.setValue('');
        }
        state.currentFilename = null;
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
    globalThis.exportToPDFDirect = exportToPDFDirect;

    // Validation functions
    globalThis.toggleLintPanel = toggleLintPanel;
    globalThis.validateCode = validateCode;

    // Security functions
    globalThis.isAllowedMarkdownURL = isAllowedMarkdownURL;
    globalThis.stripGitHubToken = stripGitHubToken;

    // Utility functions
    globalThis.showStatus = showStatus;
    globalThis.changeStyle = changeStyle;
    globalThis.changeSyntaxTheme = changeSyntaxTheme;
    globalThis.changeEditorTheme = changeEditorTheme;
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
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            openFile();
        }

        // Ctrl/Cmd + P to print/export PDF
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            exportToPDF();
        }

        // Ctrl/Cmd + Shift + P to print in new tab
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
            e.preventDefault();
            exportToPDFDirect();
        }
    });
}

/**
 * Handle URL parameters to load content or apply styles
 *
 * URL parameters (?url=, ?md=) intentionally override the "fresh visit = sample document"
 * behavior. When a user shares a link with content parameters, they expect that content
 * to load regardless of whether it's a fresh visit or not.
 *
 * Priority order:
 * 1. ?url= parameter - loads from remote URL
 * 2. ?md= parameter - loads inline markdown
 * 3. No parameters - uses fresh visit detection (sample or localStorage)
 */
function handleURLParameters() {
    const urlParams = new URLSearchParams(globalThis.location.search);

    // Check for remote URL parameter
    const remoteURL = urlParams.get('url');

    if (remoteURL) {
        // Security: Check for GitHub private repo tokens
        const { hadToken } = stripGitHubToken(remoteURL);

        if (hadToken) {
            // Show modal to let user choose how to handle private repo content.
            // Note: Session is marked immediately rather than after modal interaction
            // because the user explicitly navigated here with a URL parameter - this
            // is intentional content loading, not a "fresh visit" scenario.
            showPrivateUrlModal(remoteURL);
            // Modal handlers will load the content and update URL
        } else {
            // No token - load normally with shareable URL
            loadMarkdownFromURL(remoteURL);
        }
    } else {
        // Check for inline markdown parameter
        const inlineMarkdown = urlParams.get('md');

        if (inlineMarkdown) {
            // Decode and load the inline markdown
            try {
                const decoded = decodeURIComponent(inlineMarkdown);
                setEditorContent(decoded);
                renderMarkdown();
            } catch (error) {
                console.error('Error decoding inline markdown:', error);
                showStatus('Error loading markdown from URL', 'warning');
                loadSavedContentOrSample();
            }
        } else {
            // No URL parameters - use fresh visit detection to decide content
            loadSavedContentOrSample();
        }
    }

    // Mark session as initialized after any content loading path completes.
    // This is called once at the end rather than in each branch for simplicity.
    // Subsequent calls are idempotent (sessionStorage.setItem with same value is fine).
    markSessionInitialized();

    // Check for style parameter
    const styleParam = urlParams.get('style');
    if (styleParam) {
        // Apply the style if it's valid
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
    initStyleSelector();
    initSyntaxThemeSelector();
    initEditorThemeSelector();

    // Initialize preview drag-and-drop for CSS files
    initPreviewDragDrop();

    // Initialize file input handlers
    initFileInputHandlers();

    // Initialize private URL modal handlers
    initPrivateUrlModalHandlers();

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
