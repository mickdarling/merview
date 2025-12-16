/**
 * Document Management Module
 *
 * Handles document selection, loading, and storage. Provides functionality similar
 * to theme selectors but for markdown documents.
 *
 * Features:
 * - Document selector with current document and import options
 * - Recent sessions list for quick document switching
 * - Load from file picker
 * - Load from URL
 * - Document name tracking and display
 * - Session management modal
 */

import { state } from './state.js';
import { showStatus, clearURLParameter } from './utils.js';
import { loadMarkdownFromURL, openFile } from './file-ops.js';
import { showURLModal } from './components/url-modal.js';
import { renderMarkdown } from './renderer.js';
import { restorePanelWidths } from './resize.js';
import {
    getRecentSessions,
    getActiveSessionMeta,
    switchSession,
    createSession,
    isSessionsInitialized,
    formatSessionName
} from './sessions.js';
import { showSessionsModal } from './components/sessions-modal.js';

/**
 * Document selector action values
 */
const DOCUMENT_ACTIONS = {
    CURRENT: '__current__',
    LOAD_FILE: '__load_file__',
    LOAD_URL: '__load_url__',
    NEW: '__new__',
    MANAGE: '__manage__'
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
 * Create an optgroup element
 * @param {string} label - Group label
 * @returns {HTMLOptGroupElement}
 */
function createOptgroup(label) {
    const group = document.createElement('optgroup');
    group.label = label;
    return group;
}

/**
 * Create an option element
 * @param {string} value - Option value
 * @param {string} text - Option display text
 * @param {boolean} [selected=false] - Whether option is selected
 * @returns {HTMLOptionElement}
 */
function createOption(value, text, selected = false) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    if (selected) option.selected = true;
    return option;
}

/**
 * Update the document selector to show current document and recent sessions
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
        const currentGroup = createOptgroup('Current');
        currentGroup.appendChild(
            createOption(DOCUMENT_ACTIONS.CURRENT, currentName, true)
        );
        selector.appendChild(currentGroup);

        // Recent sessions optgroup (only if sessions are initialized)
        if (isSessionsInitialized()) {
            const recentSessions = getRecentSessions(5);
            const activeSession = getActiveSessionMeta();

            // Filter out the active session from recent list
            const otherSessions = recentSessions.filter(
                session => !activeSession || session.id !== activeSession.id
            );

            if (otherSessions.length > 0) {
                const recentGroup = createOptgroup('Recent');
                recentGroup.id = 'recentDocsGroup';

                otherSessions.forEach(session => {
                    const option = createOption(
                        session.id,
                        formatSessionName(session)
                    );
                    option.title = `Last modified: ${new Date(session.lastModified).toLocaleString()}`;
                    recentGroup.appendChild(option);
                });

                selector.appendChild(recentGroup);
            }
        }

        // Actions optgroup
        const actionsGroup = createOptgroup('Actions');
        actionsGroup.appendChild(createOption(DOCUMENT_ACTIONS.LOAD_FILE, 'Load from file...'));
        actionsGroup.appendChild(createOption(DOCUMENT_ACTIONS.LOAD_URL, 'Load from URL...'));
        actionsGroup.appendChild(createOption(DOCUMENT_ACTIONS.NEW, 'New document'));
        actionsGroup.appendChild(createOption(DOCUMENT_ACTIONS.MANAGE, 'Manage sessions...'));
        selector.appendChild(actionsGroup);
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
 * Switch to a different session and load its content
 * @param {string} sessionId - Session ID to switch to
 */
async function switchToSession(sessionId) {
    const selector = getDocumentSelector();
    setLoading(selector, true);

    try {
        const session = switchSession(sessionId);

        if (session) {
            // Load content into editor
            const { cmEditor } = state;
            if (cmEditor) {
                cmEditor.setValue(session.content);
            }

            // State is already updated by switchSession()
            // Render and update UI
            renderMarkdown();
            updateDocumentSelector();

            // Restore panel widths after switching sessions (Issue #285)
            restorePanelWidths();

            showStatus(`Opened: ${session.name}`);
        } else {
            showStatus('Session not found', 'warning');
            resetSelector(selector);
        }
    } catch (error) {
        console.error('Error switching session:', error);
        showStatus('Failed to load session', 'error');
        resetSelector(selector);
    } finally {
        setLoading(selector, false);
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

    // Handle session switching (session IDs start with 'session-')
    if (value.startsWith('session-')) {
        await switchToSession(value);
        return;
    }

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
            // Show URL modal - any HTTPS URL is now allowed
            const url = await showURLModal({
                title: 'Open from URL',
                placeholder: 'https://github.com/user/repo/blob/main/README.md',
                context: 'markdown'
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

        case DOCUMENT_ACTIONS.MANAGE:
            // Open session management modal
            showSessionsModal();
            resetSelector(selector);
            break;

        default:
            // Unknown action
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

    // Clear URL parameter when creating new document (Issue #204)
    clearURLParameter();

    // Create a new session for the empty document
    if (isSessionsInitialized()) {
        createSession({
            name: 'Untitled',
            content: '',
            source: 'new'
        });
    }

    updateDocumentSelector();
    renderMarkdown();

    // Restore panel widths after creating new document (Issue #285)
    restorePanelWidths();

    showStatus('New document created');
}

/**
 * Initialize the document selector
 * Should be called once during app initialization
 *
 * Note: This only sets up the event handler, NOT the initial content.
 * The selector content is populated by updateDocumentSelector() which is called
 * after content is loaded (e.g., by loadWelcomePage() or loadMarkdownFromURL()).
 * This ensures the document name is correctly displayed on initial load.
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

    // Listen for sessions changes (from other tabs or modal updates)
    globalThis.addEventListener('sessions-changed', () => {
        updateDocumentSelector();
    });

    // Note: We don't call updateDocumentSelector() here because state.currentFilename
    // won't be set until content is loaded. The content loading functions (loadWelcomePage,
    // loadMarkdownFromURL, loadMarkdownFile) call updateDocumentSelector() after
    // setting the filename.

    // Mark as initialized
    initialized = true;
}
