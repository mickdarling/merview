/**
 * main.js
 * Entry point module for the Merview application
 * Orchestrates all modules and handles initialization
 */

import { state } from './state.js';
import { getElements } from './dom.js';
import { initCodeMirror, getEditorContent, setEditorContent } from './editor.js';
import { renderMarkdown, scheduleRender } from './renderer.js';
import { initStyleSelector, initSyntaxThemeSelector, initEditorThemeSelector, changeStyle, applyPreviewBackground } from './themes.js';
import { loadMarkdownFromURL, loadSample, openFile, saveFile, saveFileAs, handleFileDrop, isValidMarkdownFile, exportToPDF, exportToPDFDirect, initFileInputHandlers } from './file-ops.js';
import { shareToGist, hideGistModal, openGitHubAuth, startDeviceFlow, copyGistUrl, disconnectGitHub } from './gist.js';
import { toggleLintPanel, validateCode } from './validation.js';
import { initMermaidFullscreen } from './mermaid-fullscreen.js';
import { isAllowedMarkdownURL, stripGitHubToken, showPrivateUrlModal, initPrivateUrlModalHandlers } from './security.js';
import { getMarkdownContent } from './storage.js';
import { showStatus } from './utils.js';

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
 */
function handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);

    // Check for remote URL parameter
    const remoteURL = urlParams.get('url');

    if (remoteURL) {
        // Security: Check for GitHub private repo tokens
        const { hadToken } = stripGitHubToken(remoteURL);

        if (hadToken) {
            // Show modal to let user choose how to handle private repo content
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
            // No URL parameters - load saved content or sample
            loadSavedContentOrSample();
        }
    }

    // Check for style parameter
    const styleParam = urlParams.get('style');
    if (styleParam) {
        // Apply the style if it's valid
        changeStyle(styleParam);
    }
}

/**
 * Load saved content from localStorage or load sample
 */
function loadSavedContentOrSample() {
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

    // Initialize file input handlers
    initFileInputHandlers();

    // Initialize private URL modal handlers
    initPrivateUrlModalHandlers();

    // Initialize mermaid fullscreen handlers (exposes global functions)
    initMermaidFullscreen();

    // Expose global functions for onclick handlers
    exposeGlobalFunctions();

    // Set up keyboard shortcuts
    setupKeyboardShortcuts();

    // Handle URL parameters (this will trigger initial render if content is loaded)
    handleURLParameters();
}

// Wait for DOM to be ready, then initialize
document.addEventListener('DOMContentLoaded', initializeApp);
