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

// Constants
const SESSIONS_INDEX_KEY = 'merview-sessions-index';
const SESSION_KEY_PREFIX = 'merview-session-';
const MAX_SESSIONS = 20;
const MAX_STORAGE_BYTES = 5 * 1024 * 1024; // 5MB soft limit
const MAX_SESSION_BYTES = 1 * 1024 * 1024; // 1MB per session
const SCHEMA_VERSION = 1;

/**
 * Generate a unique session ID
 * @returns {string} Unique ID (e.g., "session-abc123xyz")
 */
function generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `session-${timestamp}${random}`;
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
 * Load sessions index from localStorage
 * @returns {Object} Sessions index
 */
function loadSessionsIndex() {
    try {
        const raw = localStorage.getItem(SESSIONS_INDEX_KEY);
        if (!raw) return createEmptyIndex();

        const parsed = JSON.parse(raw);
        if (!validateIndexSchema(parsed)) {
            console.error('Invalid sessions index schema, resetting');
            return createEmptyIndex();
        }
        return parsed;
    } catch (error) {
        console.error('Failed to parse sessions index:', error);
        return createEmptyIndex();
    }
}

/**
 * Save sessions index to localStorage
 * @param {Object} index - Sessions index
 */
function saveSessionsIndex(index) {
    try {
        localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(index));
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.error('Storage quota exceeded while saving sessions index');
            throw error;
        }
        throw error;
    }
}

/**
 * Load session content from localStorage
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session data with content
 */
function loadSessionData(sessionId) {
    try {
        const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${sessionId}`);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (error) {
        console.error(`Failed to load session ${sessionId}:`, error);
        return null;
    }
}

/**
 * Save session content to localStorage
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
    const existing = index.sessions.map(s => s.name.toLowerCase());

    if (!existing.includes(baseName.toLowerCase())) {
        return baseName;
    }

    let counter = 1;
    let newName = `${baseName} (${counter})`;
    while (existing.includes(newName.toLowerCase())) {
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

    if (legacyContent && legacyContent.trim()) {
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
    window.addEventListener('storage', (event) => {
        if (event.key === SESSIONS_INDEX_KEY) {
            // Dispatch custom event for UI updates
            window.dispatchEvent(new CustomEvent('sessions-changed'));
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
 * Update current session content
 * Called from renderer.js when content changes
 * @param {string} content - New content
 * @returns {boolean} True if updated successfully
 */
export function updateSessionContent(content) {
    const index = loadSessionsIndex();

    if (!index.activeSessionId) {
        // No active session, create one
        createSession({
            name: state.currentFilename || 'Untitled',
            content,
            source: state.loadedFromURL ? 'url' : 'new',
            sourceUrl: state.loadedFromURL
        });
        return true;
    }

    const meta = index.sessions.find(s => s.id === index.activeSessionId);
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
        id: index.activeSessionId,
        content
    });

    return true;
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
        if (index.sessions.length > 0) {
            // Sort by lastModified and pick most recent
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
