/**
 * sessions.js - Multi-document Session Management for Merview
 *
 * Handles storage and management of multiple document sessions with:
 * - Session CRUD operations (create, read, update, delete)
 * - Recent sessions tracking
 * - Storage limit management
 * - Migration from legacy single-document storage
 *
 * Storage Structure:
 * - 'merview-sessions-index': JSON with version, activeSessionId, and sessions metadata array
 * - 'merview-session-[id]': JSON with individual session content
 */

import { state } from './state.js';
import { getMarkdownContent } from './storage.js';
import { showStatus } from './utils.js';

// Constants
const SESSIONS_INDEX_KEY = 'merview-sessions-index';
const SESSION_KEY_PREFIX = 'merview-session-';
const MAX_SESSIONS = 20;
const MAX_STORAGE_BYTES = 5 * 1024 * 1024; // 5MB soft limit
const SCHEMA_VERSION = 1;

// In-memory cache for sessions index to avoid repeated JSON parsing
let cachedIndex = null;
let cacheValid = false;

/**
 * Generate a unique session ID using crypto.randomUUID()
 * @returns {string} Unique ID (e.g., "session-550e8400-e29b-41d4-a716-446655440000")
 */
function generateSessionId() {
    return `session-${crypto.randomUUID()}`;
}

/**
 * Create an empty sessions index
 * @returns {Object} Empty index structure
 */
function createEmptyIndex() {
    return {
        version: SCHEMA_VERSION,
        activeSessionId: null,
        sessions: []
    };
}

/**
 * Validate index schema
 * @param {Object} index - Index to validate
 * @returns {boolean} True if valid
 */
function validateIndexSchema(index) {
    return (
        index &&
        typeof index === 'object' &&
        typeof index.version === 'number' &&
        Array.isArray(index.sessions) &&
        (index.activeSessionId === null || typeof index.activeSessionId === 'string')
    );
}

/**
 * Switch active session to the most recent one in the index
 * Used when the current active session is deleted or corrupted
 * @param {Object} index - Sessions index (will be modified)
 */
function switchToMostRecentSession(index) {
    if (index.sessions.length > 0) {
        const mostRecent = [...index.sessions].sort(
            (a, b) => (b.lastModified || 0) - (a.lastModified || 0)
        )[0];
        index.activeSessionId = mostRecent.id;
        state.activeSessionId = mostRecent.id;
        state.currentFilename = mostRecent.name;
    } else {
        index.activeSessionId = null;
        state.activeSessionId = null;
        state.currentFilename = null;
    }
}

/**
 * Load sessions index from localStorage with caching
 * Uses in-memory cache to avoid repeated JSON parsing
 * @returns {Object} Sessions index
 */
function loadSessionsIndex() {
    // Return cached index if valid
    if (cacheValid && cachedIndex) {
        return cachedIndex;
    }

    try {
        const raw = localStorage.getItem(SESSIONS_INDEX_KEY);
        if (!raw) {
            cachedIndex = createEmptyIndex();
            cacheValid = true;
            return cachedIndex;
        }

        const parsed = JSON.parse(raw);
        if (!validateIndexSchema(parsed)) {
            console.error('Invalid sessions index schema, resetting');
            cachedIndex = createEmptyIndex();
            cacheValid = true;
            return cachedIndex;
        }
        cachedIndex = parsed;
        cacheValid = true;
        return cachedIndex;
    } catch (error) {
        console.error('Failed to parse sessions index:', error);
        cachedIndex = createEmptyIndex();
        cacheValid = true;
        return cachedIndex;
    }
}

/**
 * Save sessions index to localStorage
 * Invalidates cache after save and shows user-facing errors for quota issues
 * @param {Object} index - Sessions index
 */
function saveSessionsIndex(index) {
    try {
        localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(index));
        // Update cache after successful save
        cachedIndex = index;
        cacheValid = true;
    } catch (error) {
        // Invalidate cache on any error to prevent stale data
        cacheValid = false;
        if (error.name === 'QuotaExceededError') {
            console.error('Storage quota exceeded while saving sessions index');
            // Attempt auto-cleanup and retry once
            const deletedCount = autoCleanup();
            if (deletedCount > 0) {
                try {
                    localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(index));
                    cachedIndex = index;
                    cacheValid = true;
                    showStatus(`Storage full - cleaned up ${deletedCount} old session(s)`, 'warning');
                    return;
                } catch (retryError) {
                    console.warn('Storage still full after cleanup:', retryError.message);
                }
            }
            showStatus('Storage quota exceeded. Please delete some sessions to continue.', 'error');
            throw error;
        }
        throw error;
    }
}

/**
 * Load session content from localStorage
 * If data is corrupted, automatically cleans up both the content and index entry
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session data with content
 */
function loadSessionData(sessionId) {
    try {
        const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${sessionId}`);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (error) {
        console.error(`Failed to load session ${sessionId} - corrupted data will be removed:`, error);

        // Clean up corrupted content
        deleteSessionData(sessionId);

        // Also remove from index to prevent inconsistent state
        const index = loadSessionsIndex();
        const hadSession = index.sessions.some(s => s.id === sessionId);
        if (hadSession) {
            index.sessions = index.sessions.filter(s => s.id !== sessionId);

            // If it was the active session, switch to another one
            if (index.activeSessionId === sessionId) {
                switchToMostRecentSession(index);
            }

            saveSessionsIndex(index);
        }

        showStatus('A corrupted session was removed', 'warning');
        return null;
    }
}

/**
 * Save session content to localStorage
 * Shows user-facing errors for quota issues
 * @param {Object} sessionData - Session data with content
 */
function saveSessionData(sessionData) {
    try {
        localStorage.setItem(
            `${SESSION_KEY_PREFIX}${sessionData.id}`,
            JSON.stringify(sessionData)
        );
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.error('Storage quota exceeded while saving session content');
            // Attempt auto-cleanup and retry once
            const deletedCount = autoCleanup();
            if (deletedCount > 0) {
                try {
                    localStorage.setItem(
                        `${SESSION_KEY_PREFIX}${sessionData.id}`,
                        JSON.stringify(sessionData)
                    );
                    showStatus(`Storage full - cleaned up ${deletedCount} old session(s)`, 'warning');
                    return;
                } catch (retryError) {
                    console.warn('Storage still full after cleanup:', retryError.message);
                }
            }
            showStatus('Storage quota exceeded. Please delete some sessions to continue.', 'error');
            throw error;
        }
        throw error;
    }
}

/**
 * Delete session data from localStorage
 * @param {string} sessionId - Session ID
 */
function deleteSessionData(sessionId) {
    localStorage.removeItem(`${SESSION_KEY_PREFIX}${sessionId}`);
}

/**
 * Get storage usage stats
 * @returns {Object} { totalSessions, totalSize, maxSize, percentUsed }
 */
export function getStorageStats() {
    const index = loadSessionsIndex();
    const totalSessions = index.sessions.length;
    const totalSize = index.sessions.reduce((sum, s) => sum + (s.contentSize || 0), 0);

    return {
        totalSessions,
        totalSize,
        maxSize: MAX_STORAGE_BYTES,
        percentUsed: Math.round((totalSize / MAX_STORAGE_BYTES) * 100),
        maxSessions: MAX_SESSIONS
    };
}

/**
 * Auto-cleanup oldest sessions if over limit
 * @returns {number} Number of sessions deleted
 */
function autoCleanup() {
    const index = loadSessionsIndex();
    let deletedCount = 0;

    // Sort by lastModified ascending (oldest first)
    const sortedSessions = [...index.sessions].sort(
        (a, b) => (a.lastModified || 0) - (b.lastModified || 0)
    );

    // Delete oldest sessions until under limits
    while (sortedSessions.length > MAX_SESSIONS) {
        const oldest = sortedSessions.shift();
        if (oldest && oldest.id !== index.activeSessionId) {
            deleteSessionData(oldest.id);
            index.sessions = index.sessions.filter(s => s.id !== oldest.id);
            deletedCount++;
        } else {
            break; // Don't delete active session
        }
    }

    if (deletedCount > 0) {
        saveSessionsIndex(index);
    }

    return deletedCount;
}

/**
 * Resolve naming conflicts by adding numeric suffix
 * @param {string} baseName - Base name to check
 * @returns {string} Unique name
 */
function resolveNameConflict(baseName) {
    const index = loadSessionsIndex();
    const existing = new Set(index.sessions.map(s => s.name.toLowerCase()));

    if (!existing.has(baseName.toLowerCase())) {
        return baseName;
    }

    let counter = 1;
    let newName = `${baseName} (${counter})`;
    while (existing.has(newName.toLowerCase())) {
        counter++;
        newName = `${baseName} (${counter})`;
    }
    return newName;
}

/**
 * Migrate legacy markdown-content to sessions system
 * Called on first load with new code
 */
export function migrateToSessions() {
    // Check if migration already done
    const existingIndex = localStorage.getItem(SESSIONS_INDEX_KEY);
    if (existingIndex) {
        return; // Already migrated
    }

    // Check for existing single-document content
    const legacyContent = getMarkdownContent();

    if (legacyContent?.trim()) {
        // Create initial session from legacy content
        const sessionId = generateSessionId();
        const session = {
            id: sessionId,
            name: state.currentFilename || 'Untitled',
            lastModified: Date.now(),
            createdAt: Date.now(),
            source: 'migrated',
            sourceUrl: null,
            contentSize: legacyContent.length
        };

        // Create index with migrated session
        const index = {
            version: SCHEMA_VERSION,
            activeSessionId: sessionId,
            sessions: [session]
        };

        // Store new structure
        saveSessionsIndex(index);
        saveSessionData({
            id: sessionId,
            content: legacyContent
        });

        // Update state
        state.activeSessionId = sessionId;

        console.log('Migrated legacy content to sessions system');
    } else {
        // No legacy content, just create empty index
        saveSessionsIndex(createEmptyIndex());
    }
}

/**
 * Initialize sessions system
 * Should be called from main.js during app initialization
 */
export function initSessions() {
    migrateToSessions();

    const index = loadSessionsIndex();
    state.activeSessionId = index.activeSessionId;
    state.sessionsLoaded = true;

    // Listen for storage changes from other tabs
    globalThis.addEventListener('storage', (event) => {
        if (event.key === SESSIONS_INDEX_KEY) {
            // Invalidate cache when another tab modifies sessions
            cacheValid = false;
            // Dispatch custom event for UI updates
            globalThis.dispatchEvent(new CustomEvent('sessions-changed'));
        }
    });
}

/**
 * Get all sessions metadata
 * @returns {Array} Session metadata array (sorted by lastModified DESC)
 */
export function getAllSessions() {
    const index = loadSessionsIndex();
    return [...index.sessions].sort(
        (a, b) => (b.lastModified || 0) - (a.lastModified || 0)
    );
}

/**
 * Get recent sessions for quick access
 * @param {number} limit - Maximum number to return (default: 5)
 * @returns {Array} Recent session metadata
 */
export function getRecentSessions(limit = 5) {
    return getAllSessions().slice(0, limit);
}

/**
 * Get active session metadata
 * @returns {Object|null} Active session metadata or null
 */
export function getActiveSessionMeta() {
    const index = loadSessionsIndex();
    if (!index.activeSessionId) return null;
    return index.sessions.find(s => s.id === index.activeSessionId) || null;
}

/**
 * Get active session with content
 * @returns {Object|null} Active session data with content or null
 */
export function getActiveSession() {
    const index = loadSessionsIndex();
    if (!index.activeSessionId) return null;

    const meta = index.sessions.find(s => s.id === index.activeSessionId);
    if (!meta) return null;

    const data = loadSessionData(index.activeSessionId);
    return data ? { ...meta, content: data.content } : null;
}

/**
 * Get session by ID with content
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session data with content or null
 */
export function getSession(sessionId) {
    const index = loadSessionsIndex();
    const meta = index.sessions.find(s => s.id === sessionId);
    if (!meta) return null;

    const data = loadSessionData(sessionId);
    return data ? { ...meta, content: data.content } : null;
}

/**
 * Find session by name (case-insensitive)
 * @param {string} name - Session name to find
 * @returns {Object|null} Session metadata or null
 */
export function findSessionByName(name) {
    const index = loadSessionsIndex();
    return index.sessions.find(
        s => s.name.toLowerCase() === name.toLowerCase()
    ) || null;
}

/**
 * Create a new session
 * @param {Object} options - Session options
 * @param {string} options.name - Display name
 * @param {string} options.content - Markdown content
 * @param {string} [options.source='new'] - Source type: 'file', 'url', 'new', 'migrated'
 * @param {string} [options.sourceUrl] - Original URL if loaded from URL
 * @returns {Object} Created session metadata
 */
export function createSession({ name, content, source = 'new', sourceUrl = null }) {
    const index = loadSessionsIndex();

    // Resolve name conflicts
    const resolvedName = resolveNameConflict(name);

    // Generate ID and create metadata
    const sessionId = generateSessionId();
    const now = Date.now();
    const session = {
        id: sessionId,
        name: resolvedName,
        lastModified: now,
        createdAt: now,
        source,
        sourceUrl,
        contentSize: content.length
    };

    // Check if we need to cleanup before adding
    if (index.sessions.length >= MAX_SESSIONS) {
        autoCleanup();
    }

    // Add to index
    index.sessions.unshift(session); // Add at beginning (most recent)
    index.activeSessionId = sessionId;
    saveSessionsIndex(index);

    // Save content
    saveSessionData({
        id: sessionId,
        content
    });

    // Update state
    state.activeSessionId = sessionId;

    return session;
}

/**
 * Switch to a different session
 * @param {string} sessionId - Session ID to switch to
 * @returns {Object|null} Session data with content or null if not found
 */
export function switchSession(sessionId) {
    const index = loadSessionsIndex();

    const meta = index.sessions.find(s => s.id === sessionId);
    if (!meta) {
        console.error(`Session not found: ${sessionId}`);
        return null;
    }

    const data = loadSessionData(sessionId);
    if (!data) {
        console.error(`Session data not found: ${sessionId}`);
        return null;
    }

    // Update active session
    index.activeSessionId = sessionId;

    // Update lastModified (touch)
    meta.lastModified = Date.now();

    saveSessionsIndex(index);

    // Update state
    state.activeSessionId = sessionId;
    state.currentFilename = meta.name;
    state.loadedFromURL = meta.sourceUrl;

    return { ...meta, content: data.content };
}

/**
 * Update current session content (internal implementation)
 * Guards are checked by the caller (updateSessionContent)
 * @param {string} content - New content
 * @returns {boolean} True if updated successfully
 */
function updateSessionContentInternal(content) {
    const index = loadSessionsIndex();

    // Guard: Check both index and state for active session ID
    // This prevents race conditions during initialization
    const activeId = index.activeSessionId || state.activeSessionId;

    if (!activeId) {
        // No active session, create one
        createSession({
            name: state.currentFilename || 'Untitled',
            content,
            source: state.loadedFromURL ? 'url' : 'new',
            sourceUrl: state.loadedFromURL
        });
        return true;
    }

    // Ensure state is in sync with index
    if (!state.activeSessionId && index.activeSessionId) {
        state.activeSessionId = index.activeSessionId;
    }

    const meta = index.sessions.find(s => s.id === activeId);
    if (!meta) {
        console.error('Active session not found in index');
        return false;
    }

    // Update metadata
    meta.lastModified = Date.now();
    meta.contentSize = content.length;

    // Update name if it changed
    if (state.currentFilename && state.currentFilename !== meta.name) {
        meta.name = state.currentFilename;
    }

    saveSessionsIndex(index);

    // Update content
    saveSessionData({
        id: activeId,
        content
    });

    return true;
}

/**
 * Update current session content
 * Called from renderer.js when content changes
 * Note: renderMarkdown() is already debounced at 300ms, so no additional
 * debouncing is needed here to reduce localStorage writes.
 * @param {string} content - New content
 * @returns {boolean} True if updated successfully
 */
export function updateSessionContent(content) {
    // Guard: Don't update during clearing operation
    if (state.clearingAllSessions) {
        return false;
    }

    // Guard: Ensure sessions are initialized
    if (!state.sessionsLoaded) {
        return false;
    }

    return updateSessionContentInternal(content);
}

/**
 * Update active session name
 * @param {string} newName - New display name
 * @returns {boolean} True if renamed successfully
 */
export function renameActiveSession(newName) {
    const index = loadSessionsIndex();

    if (!index.activeSessionId) return false;

    const meta = index.sessions.find(s => s.id === index.activeSessionId);
    if (!meta) return false;

    // Resolve conflicts (but allow same name for current session)
    const resolvedName = resolveNameConflict(newName);
    meta.name = resolvedName;
    meta.lastModified = Date.now();

    saveSessionsIndex(index);

    // Update state
    state.currentFilename = resolvedName;

    return true;
}

/**
 * Rename a session by ID
 * @param {string} sessionId - Session ID
 * @param {string} newName - New display name
 * @returns {boolean} True if renamed successfully
 */
export function renameSession(sessionId, newName) {
    const index = loadSessionsIndex();

    const meta = index.sessions.find(s => s.id === sessionId);
    if (!meta) return false;

    const resolvedName = resolveNameConflict(newName);
    meta.name = resolvedName;
    meta.lastModified = Date.now();

    saveSessionsIndex(index);

    // Update state if this is the active session
    if (sessionId === state.activeSessionId) {
        state.currentFilename = resolvedName;
    }

    return true;
}

/**
 * Delete a session
 * @param {string} sessionId - Session ID to delete
 * @returns {boolean} True if deleted
 */
export function deleteSession(sessionId) {
    const index = loadSessionsIndex();

    const sessionIndex = index.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) return false;

    // Remove from index
    index.sessions.splice(sessionIndex, 1);

    // If this was the active session, switch to most recent or null
    if (index.activeSessionId === sessionId) {
        switchToMostRecentSession(index);
    }

    saveSessionsIndex(index);

    // Delete content data
    deleteSessionData(sessionId);

    return true;
}

/**
 * Delete all sessions (clear all)
 * @returns {boolean} True if cleared
 */
export function clearAllSessions() {
    // Set flag to prevent race conditions with updateSessionContent
    state.clearingAllSessions = true;

    try {
        const index = loadSessionsIndex();

        // Delete all session data
        index.sessions.forEach(session => {
            deleteSessionData(session.id);
        });

        // Reset index
        const emptyIndex = createEmptyIndex();
        saveSessionsIndex(emptyIndex);

        // Update state
        state.activeSessionId = null;
        state.currentFilename = null;

        return true;
    } finally {
        // Clear the flag after operation completes
        // Note: The caller should set clearingAllSessions = false after createSession()
        // to ensure the full clear+create operation is atomic
    }
}

/**
 * Signal that the clear all operation is complete
 * Called after createSession() in the Clear All flow
 */
export function finishClearingAllSessions() {
    state.clearingAllSessions = false;
}

/**
 * Check if sessions system is initialized
 * @returns {boolean} True if initialized
 */
export function isSessionsInitialized() {
    return state.sessionsLoaded === true;
}

/**
 * Format session name for display (truncate if needed)
 * @param {Object} session - Session metadata
 * @param {number} maxLength - Maximum length (default: 30)
 * @returns {string} Formatted name
 */
export function formatSessionName(session, maxLength = 30) {
    let name = session.name || 'Untitled';
    if (name.length > maxLength) {
        name = name.substring(0, maxLength - 3) + '...';
    }
    return name;
}

/**
 * Format relative time for session display
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return days === 1 ? '1 day ago' : `${days} days ago`;
    if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    if (minutes > 0) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    return 'Just now';
}

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size (e.g., "2.1 KB")
 */
export function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
