/**
 * Document Management Module
 *
 * Handles document selection, loading, and storage. Provides functionality similar
 * to theme selectors but for markdown documents.
 *
 * Features:
 * - Document selector with current document and import options
 * - Load from file picker
 * - Load from URL
 * - Document name tracking and display
 */

import { state } from './state.js';
import { showStatus } from './utils.js';
import { loadMarkdownFromURL, openFile } from './file-ops.js';
import { showURLModal } from './components/url-modal.js';
import { ALLOWED_MARKDOWN_DOMAINS } from './config.js';
import { renderMarkdown } from './renderer.js';

/**
 * Document selector action values
 */
const DOCUMENT_ACTIONS = {
    CURRENT: '__current__',
    LOAD_FILE: '__load_file__',
    LOAD_URL: '__load_url__',
    NEW: '__new__'
};

/**
 * Track whether the document selector has been initialized to prevent duplicate event handlers
 */
let initialized = false;

/**
 * Request ID counter for race condition prevention in async operations.
 * Each changeDocument() call gets a unique ID; if a newer request starts,
 * the older one's results are ignored.
 */
let currentRequestId = 0;

/**
 * Get the document selector element
 * @returns {HTMLSelectElement|null}
 */
function getDocumentSelector() {
    return document.getElementById('documentSelector');
}

/**
 * Update the document selector to show current document
 */
export function updateDocumentSelector() {
    try {
        const selector = getDocumentSelector();
        if (!selector) return;

        // Get current document name
        const currentName = state.currentFilename || 'Untitled';

        // Clear and rebuild selector
        selector.innerHTML = '';

        // Current document optgroup
        const currentGroup = document.createElement('optgroup');
        currentGroup.label = 'Current';

        const currentOption = document.createElement('option');
        currentOption.value = DOCUMENT_ACTIONS.CURRENT;
        currentOption.textContent = currentName;
        currentOption.selected = true;
        currentGroup.appendChild(currentOption);

        selector.appendChild(currentGroup);

        // Import optgroup
        const importGroup = document.createElement('optgroup');
        importGroup.label = 'Import';

        const fileOption = document.createElement('option');
        fileOption.value = DOCUMENT_ACTIONS.LOAD_FILE;
        fileOption.textContent = 'Load from file...';
        importGroup.appendChild(fileOption);

        const urlOption = document.createElement('option');
        urlOption.value = DOCUMENT_ACTIONS.LOAD_URL;
        urlOption.textContent = 'Load from URL...';
        importGroup.appendChild(urlOption);

        const newOption = document.createElement('option');
        newOption.value = DOCUMENT_ACTIONS.NEW;
        newOption.textContent = 'New document';
        importGroup.appendChild(newOption);

        selector.appendChild(importGroup);
    } catch (error) {
        console.error('Error updating document selector:', error);
        // Selector may be in inconsistent state, but app should continue working
    }
}

/**
 * Set loading state for the selector
 * @param {HTMLSelectElement|null} selector - The selector element
 * @param {boolean} isLoading - Whether to show loading state
 */
function setLoading(selector, isLoading) {
    if (selector) {
        selector.disabled = isLoading;
        selector.style.opacity = isLoading ? '0.6' : '1';
    }
}

/**
 * Reset the document selector to show current document
 * @param {HTMLSelectElement|null} selector - The selector element
 */
function resetSelector(selector) {
    if (selector) {
        selector.value = DOCUMENT_ACTIONS.CURRENT;
    }
}

/**
 * Handle document selector change
 * @param {string} value - The selected value
 */
export async function changeDocument(value) {
    const selector = getDocumentSelector();

    // Increment request ID for race condition prevention
    const requestId = ++currentRequestId;

    switch (value) {
        case DOCUMENT_ACTIONS.CURRENT:
            // Already on current document, nothing to do
            break;

        case DOCUMENT_ACTIONS.LOAD_FILE:
            // Trigger file picker using existing openFile() infrastructure
            // Note: openFile() triggers an async file picker dialog via the browser's native
            // file input element. The actual file loading is handled asynchronously by the
            // file input's change event listener in file-ops.js (see initFileInputHandlers).
            // This function does not wait for the file to be selected or loaded - it simply
            // triggers the picker and returns immediately. The selector is reset right away
            // because the file loading happens independently through the event system.
            openFile();
            resetSelector(selector);
            break;

        case DOCUMENT_ACTIONS.LOAD_URL: {
            // Show URL modal
            const url = await showURLModal({
                title: 'Open from URL',
                placeholder: 'https://github.com/user/repo/blob/main/README.md',
                allowedDomains: ALLOWED_MARKDOWN_DOMAINS
            });

            // Check if this request is still current (race condition prevention)
            if (requestId !== currentRequestId) {
                return; // A newer request has started, abandon this one
            }

            if (url) {
                // Set loading state while fetching URL
                setLoading(selector, true);

                // loadMarkdownFromURL returns boolean (doesn't throw)
                // It handles errors internally via showStatus()
                const success = await loadMarkdownFromURL(url);

                // Check again after async operation
                if (requestId !== currentRequestId) {
                    return; // A newer request has started, abandon this one
                }

                if (success) {
                    updateDocumentSelector();
                }
                // On failure, selector stays on current document (correct behavior)

                // Clear loading state
                setLoading(selector, false);
            }
            // Reset selector after async operation completes (success or failure)
            resetSelector(selector);
            break;
        }

        case DOCUMENT_ACTIONS.NEW:
            // Create new document (synchronous, updates selector internally)
            newDocument();
            resetSelector(selector);
            break;

        default:
            // Future: handle saved document selection
            resetSelector(selector);
            break;
    }
}

/**
 * Create a new empty document
 */
export function newDocument() {
    const { cmEditor } = state;

    if (cmEditor) {
        cmEditor.setValue('');
    }

    state.currentFilename = null;
    state.loadedFromURL = null;
    updateDocumentSelector();
    renderMarkdown();
    showStatus('New document created');
}

/**
 * Initialize the document selector
 * Should be called once during app initialization
 */
export function initDocumentSelector() {
    // Guard against duplicate initialization to prevent multiple event handlers
    if (initialized) {
        console.warn('Document selector already initialized, skipping duplicate initialization');
        return;
    }

    const selector = getDocumentSelector();
    if (!selector) {
        console.warn('Document selector not found');
        return;
    }

    // Set up change handler
    selector.addEventListener('change', (e) => {
        changeDocument(e.target.value);
    });

    // Initial population
    updateDocumentSelector();

    // Mark as initialized
    initialized = true;
}
