/**
 * Session Management Modal Component
 *
 * Provides a modal for viewing and managing document sessions:
 * - List all saved sessions with metadata
 * - Switch between sessions
 * - Delete individual sessions
 * - Clear all sessions
 * - View storage usage stats
 *
 * Features keyboard accessibility (Escape to close, Tab for focus trap)
 * and ARIA attributes for screen readers.
 */

import { state } from '../state.js';
import { showStatus } from '../utils.js';
import { renderMarkdown } from '../renderer.js';
import { updateDocumentSelector } from '../documents.js';
import {
    getAllSessions,
    getActiveSessionMeta,
    getStorageStats,
    switchSession,
    deleteSession,
    clearAllSessions,
    formatSessionName,
    formatRelativeTime,
    formatFileSize
} from '../sessions.js';

// Modal state
let triggerElement = null;
let initialized = false;

/**
 * Get the sessions modal element
 * @returns {HTMLDialogElement|null}
 */
function getModal() {
    return document.getElementById('sessionsModal');
}

/**
 * Render the storage stats section
 * @returns {string} HTML string for stats
 */
function renderStorageStats() {
    const stats = getStorageStats();
    const sizeDisplay = formatFileSize(stats.totalSize);
    const maxDisplay = formatFileSize(stats.maxSize);

    return `${stats.totalSessions} session${stats.totalSessions !== 1 ? 's' : ''} (${sizeDisplay} of ${maxDisplay})`;
}

/**
 * Render a single session item
 * @param {Object} session - Session metadata
 * @param {boolean} isActive - Whether this is the active session
 * @returns {HTMLElement} Session item element
 */
function createSessionItem(session, isActive) {
    const item = document.createElement('div');
    item.className = 'session-item';
    item.dataset.sessionId = session.id;
    if (isActive) {
        item.classList.add('session-item-active');
    }

    const info = document.createElement('div');
    info.className = 'session-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'session-name';
    nameDiv.textContent = formatSessionName(session, 40);
    if (isActive) {
        const activeSpan = document.createElement('span');
        activeSpan.className = 'session-active-badge';
        activeSpan.textContent = ' (active)';
        nameDiv.appendChild(activeSpan);
    }
    info.appendChild(nameDiv);

    const metaDiv = document.createElement('div');
    metaDiv.className = 'session-meta';
    metaDiv.textContent = `${formatRelativeTime(session.lastModified)} | ${formatFileSize(session.contentSize || 0)}`;
    info.appendChild(metaDiv);

    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'session-actions';

    // Open button (only for non-active sessions)
    if (!isActive) {
        const openBtn = document.createElement('button');
        openBtn.className = 'btn btn-sm';
        openBtn.textContent = 'Open';
        openBtn.title = 'Switch to this document';
        openBtn.dataset.action = 'switch';
        openBtn.dataset.sessionId = session.id;
        actions.appendChild(openBtn);
    }

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-sm btn-danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.title = 'Delete this session';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.dataset.sessionId = session.id;
    actions.appendChild(deleteBtn);

    item.appendChild(actions);

    return item;
}

/**
 * Render the sessions list
 */
function renderSessionsList() {
    const listContainer = document.getElementById('sessionsList');
    if (!listContainer) return;

    const sessions = getAllSessions();
    const activeSession = getActiveSessionMeta();

    listContainer.innerHTML = '';

    if (sessions.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'sessions-empty';
        emptyMsg.textContent = 'No saved sessions';
        listContainer.appendChild(emptyMsg);
        return;
    }

    sessions.forEach(session => {
        const isActive = activeSession && session.id === activeSession.id;
        const item = createSessionItem(session, isActive);
        listContainer.appendChild(item);
    });
}

/**
 * Update the storage stats display
 */
function updateStorageDisplay() {
    const statsElement = document.getElementById('sessionsStorageInfo');
    if (statsElement) {
        statsElement.textContent = renderStorageStats();
    }
}

/**
 * Show the sessions management modal
 */
export function showSessionsModal() {
    const modal = getModal();
    if (!modal) {
        console.error('Sessions modal not found in DOM');
        return;
    }

    // Store the element that triggered the modal for focus restoration
    triggerElement = document.activeElement;

    // Update modal content
    updateStorageDisplay();
    renderSessionsList();

    // Show modal
    modal.showModal();
}

/**
 * Hide the sessions management modal
 */
export function hideSessionsModal() {
    const modal = getModal();
    if (modal?.open) {
        modal.close();
    }

    // Restore focus to trigger element
    triggerElement?.focus?.();
    triggerElement = null;
}

/**
 * Handle session action (switch, delete)
 * @param {string} sessionId - Session ID
 * @param {string} action - Action type ('switch' or 'delete')
 */
function handleSessionAction(sessionId, action) {
    if (action === 'switch') {
        const session = switchSession(sessionId);
        if (session) {
            // Load content into editor
            const { cmEditor } = state;
            if (cmEditor) {
                cmEditor.setValue(session.content);
            }

            // Render and update UI
            renderMarkdown();
            updateDocumentSelector();
            showStatus(`Opened: ${session.name}`);

            // Close modal after switching
            hideSessionsModal();
        } else {
            showStatus('Failed to switch session', 'error');
        }
    } else if (action === 'delete') {
        const activeSession = getActiveSessionMeta();
        const isActive = activeSession && sessionId === activeSession.id;

        // Confirm deletion
        const sessions = getAllSessions();
        const session = sessions.find(s => s.id === sessionId);
        const sessionName = session ? formatSessionName(session) : 'this session';

        if (isActive && sessions.length === 1) {
            // Don't allow deleting the only session
            showStatus('Cannot delete the only session', 'warning');
            return;
        }

        if (confirm(`Delete "${sessionName}"?`)) {
            const success = deleteSession(sessionId);
            if (success) {
                // If we deleted the active session, load the new active session
                if (isActive) {
                    const newActive = getActiveSessionMeta();
                    if (newActive) {
                        const newSession = switchSession(newActive.id);
                        if (newSession) {
                            const { cmEditor } = state;
                            if (cmEditor) {
                                cmEditor.setValue(newSession.content);
                            }
                            renderMarkdown();
                        }
                    } else {
                        // No more sessions, clear editor
                        const { cmEditor } = state;
                        if (cmEditor) {
                            cmEditor.setValue('');
                        }
                        state.currentFilename = null;
                        renderMarkdown();
                    }
                }

                // Update displays
                updateDocumentSelector();
                updateStorageDisplay();
                renderSessionsList();
                showStatus('Session deleted');
            } else {
                showStatus('Failed to delete session', 'error');
            }
        }
    }
}

/**
 * Handle clear all sessions
 */
function handleClearAll() {
    const sessions = getAllSessions();
    if (sessions.length === 0) {
        showStatus('No sessions to clear');
        return;
    }

    if (confirm(`Delete all ${sessions.length} session(s)? This cannot be undone.`)) {
        clearAllSessions();

        // Clear editor
        const { cmEditor } = state;
        if (cmEditor) {
            cmEditor.setValue('');
        }
        state.currentFilename = null;
        renderMarkdown();

        // Update displays
        updateDocumentSelector();
        updateStorageDisplay();
        renderSessionsList();
        showStatus('All sessions cleared');
    }
}

/**
 * Initialize sessions modal event handlers
 * Should be called once during app initialization
 */
export function initSessionsModalHandlers() {
    if (initialized) {
        console.warn('Sessions modal already initialized');
        return;
    }

    const modal = getModal();
    if (!modal) {
        console.warn('Sessions modal not found in DOM');
        return;
    }

    const closeBtn = document.getElementById('closeSessionsModalBtn');
    const clearAllBtn = document.getElementById('clearAllSessionsBtn');
    const sessionsList = document.getElementById('sessionsList');

    // Handle Close button click
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            hideSessionsModal();
        });
    }

    // Handle Clear All button click
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            handleClearAll();
        });
    }

    // Handle session item actions via event delegation
    if (sessionsList) {
        sessionsList.addEventListener('click', (e) => {
            const target = e.target;
            if (target.tagName === 'BUTTON' && target.dataset.action) {
                const action = target.dataset.action;
                const sessionId = target.dataset.sessionId;
                if (sessionId) {
                    handleSessionAction(sessionId, action);
                }
            }
        });
    }

    // Handle close event (Escape key, backdrop click, or .close() call)
    modal.addEventListener('close', () => {
        // Restore focus to trigger element
        triggerElement?.focus?.();
        triggerElement = null;
    });

    // Focus trap within modal
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            const focusableElements = modal.querySelectorAll(
                'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement?.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement?.focus();
            }
        }
    });

    initialized = true;
}
