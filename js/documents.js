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
 * Sample/Welcome document name constant
 */
export const WELCOME_DOCUMENT_NAME = 'Welcome.md';

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
    currentOption.value = '__current__';
    currentOption.textContent = currentName;
    currentOption.selected = true;
    currentGroup.appendChild(currentOption);

    selector.appendChild(currentGroup);

    // Import optgroup
    const importGroup = document.createElement('optgroup');
    importGroup.label = 'Import';

    const fileOption = document.createElement('option');
    fileOption.value = '__load_file__';
    fileOption.textContent = 'Load from file...';
    importGroup.appendChild(fileOption);

    const urlOption = document.createElement('option');
    urlOption.value = '__load_url__';
    urlOption.textContent = 'Load from URL...';
    importGroup.appendChild(urlOption);

    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = 'New document';
    importGroup.appendChild(newOption);

    selector.appendChild(importGroup);
}

/**
 * Handle document selector change
 * @param {string} value - The selected value
 */
export async function changeDocument(value) {
    const selector = getDocumentSelector();

    switch (value) {
        case '__current__':
            // Already on current document, nothing to do
            break;

        case '__load_file__':
            // Trigger file picker using existing openFile() infrastructure
            openFile();
            break;

        case '__load_url__': {
            // Show URL modal
            const url = await showURLModal({
                title: 'Open from URL',
                placeholder: 'https://github.com/user/repo/blob/main/README.md',
                allowedDomains: ALLOWED_MARKDOWN_DOMAINS
            });
            if (url) {
                try {
                    await loadMarkdownFromURL(url);
                    updateDocumentSelector();
                } catch (error) {
                    // Error already handled by loadMarkdownFromURL via showStatus()
                    // Selector will reset to current document below
                    console.error('Failed to load document from URL:', error);
                }
            }
            break;
        }

        case '__new__':
            // Create new document
            newDocument();
            break;

        default:
            // Future: handle saved document selection
            break;
    }

    // Reset selector to show current document
    if (selector) {
        selector.value = '__current__';
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
}

/**
 * Set the current document name and update selector
 * @param {string} name - The document name
 * @param {string|null} sourceUrl - Optional source URL
 */
export function setCurrentDocument(name, sourceUrl = null) {
    state.currentFilename = name;
    state.loadedFromURL = sourceUrl;
    updateDocumentSelector();
}
