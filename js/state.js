/**
 * Centralized State Management for Merview
 *
 * This module contains all mutable shared state variables used across the application.
 * Exporting a single state object makes it easier to track, debug, and manage application state.
 *
 * IMPORTANT: PUBLICLY ACCESSIBLE STATE
 * =====================================
 * This state object is exposed globally via `globalThis.state` in main.js for testing
 * and debugging purposes. This means:
 *
 * 1. DO NOT store sensitive information here (passwords, tokens, secrets, etc.)
 * 2. Any data in this object is accessible from the browser console and browser extensions
 * 3. This is acceptable for Merview because:
 *    - It's a client-side-only application
 *    - No sensitive user data is stored in state
 *    - Users only affect their own browser instance
 *    - It enables reliable integration testing
 *
 * If you need to store sensitive data, create a separate private module that is NOT
 * exposed to globalThis.
 */

export const state = {
    // CodeMirror editor instance
    cmEditor: null,

    // Theme CSS link elements
    currentStyleLink: null,              // Preview style CSS link element
    currentSyntaxThemeLink: null,        // Syntax highlighting theme CSS link
    currentEditorThemeLink: null,        // Editor theme CSS link

    // File management
    currentFilename: null,               // Current open file name (for Save functionality)
    loadedFromURL: null,                 // URL if content was loaded from a remote source
    documentMode: null,                  // Document type: 'markdown', 'mermaid', or null (auto-detect)

    // Rendering
    mermaidCounter: 0,                   // Counter for generating unique Mermaid diagram IDs
    renderTimeout: null,                 // Debounce timeout handle for render scheduling
    validationTimeout: null,             // Debounce timeout handle for validation scheduling
    mermaidTheme: 'default',             // Current Mermaid theme ('default' for light, 'dark' for dark backgrounds)
    mermaidThemeMode: 'auto',            // User's theme selection: 'auto' or specific theme name ('default', 'forest', 'dark', 'neutral', 'base')
    mermaidObserver: null,               // IntersectionObserver for lazy loading Mermaid diagrams (Issue #326)

    // Lint panel state
    lintEnabled: false,                  // Whether lint panel is visible
    codeIssues: [],                      // Array of detected code issues

    // Layout state
    respectStyleLayout: localStorage.getItem('respect-style-layout') === 'true', // Whether to respect loaded style's layout constraints (default: false)
    hrAsPageBreak: localStorage.getItem('hr-page-break') === 'true', // Whether horizontal rules trigger page breaks in PDF (default: false)
    hrPageBreakToggleOption: null,       // Cached reference to HR page break toggle option (performance)

    // GitHub Gist OAuth state
    gistAuthState: {
        deviceCode: null,                // Device flow code for OAuth
        userCode: null,                  // User code to display for authorization
        verificationUri: null,           // GitHub's verification URL
        interval: 5,                     // Polling interval in seconds
        expiresAt: null,                 // Expiration timestamp
        pollTimeoutId: null              // Timeout ID for polling
    },
    gistShareInProgress: false,          // Race condition guard for Share to Gist

    // Private URL modal state
    privateUrlState: {
        originalUrl: null,               // URL with token (for fetching private repos)
        resolve: null                    // Promise resolver for modal user choice
    },

    // Mermaid fullscreen zoom/pan state
    mermaidZoom: {
        scale: 1,                        // Zoom scale factor
        panX: 0,                         // Pan X offset in pixels
        panY: 0,                         // Pan Y offset in pixels
        isPanning: false,                // Whether user is actively panning
        startX: 0,                       // Pan gesture start X position
        startY: 0                        // Pan gesture start Y position
    },

    // Session management state
    activeSessionId: null,               // Currently active session ID
    sessionsLoaded: false,               // Whether sessions have been loaded from storage
    clearingAllSessions: false,          // Flag to prevent race conditions during Clear All operation

    // Panel resize state
    editorPanelWidth: null,              // Percentage width of editor panel (null = default 50/50)
    previewPanelWidth: null              // Percentage width of preview panel (null = default 50/50)
};
