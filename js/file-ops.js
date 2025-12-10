/**
 * File Operations Module - File I/O, drag-and-drop, and PDF export
 *
 * This module handles:
 * - Opening and loading markdown files (file picker + drag-and-drop)
 * - Saving markdown files (Save, Save As)
 * - Loading markdown from URLs
 * - File validation (markdown MIME types and extensions)
 * - PDF export (print dialog and new tab)
 * - Sample markdown content loading
 */

import { state } from './state.js';
import { getElements } from './dom.js';
import { showStatus } from './utils.js';
import { isAllowedMarkdownURL, normalizeGitHubContentUrl } from './security.js';
import { renderMarkdown } from './renderer.js';

/**
 * Validate file type (text or markdown)
 * Security: Only accept specific MIME types or valid markdown extensions
 * Empty MIME type requires valid extension (some browsers don't set MIME for .md files)
 * @param {File} file - The file to validate
 * @returns {boolean} True if file is a valid markdown/text file
 */
export function isValidMarkdownFile(file) {
    const validMimeTypes = ['text/plain', 'text/markdown', 'text/x-markdown'];
    const validExtensions = /\.(md|markdown|txt|text)$/i;

    // If MIME type is set and valid, accept
    if (file.type && validMimeTypes.includes(file.type)) {
        return true;
    }
    // If MIME type is empty or not in whitelist, require valid extension
    return validExtensions.test(file.name);
}

/**
 * Shared file loading logic (used by both file picker and drag-and-drop)
 * Loads a markdown file into the editor and updates the current filename
 * @param {File} file - The file to load
 * @returns {Promise<boolean>} True if successful, false on error
 */
export async function loadMarkdownFile(file) {
    try {
        const content = await file.text();
        const { cmEditor } = state;

        if (cmEditor) {
            cmEditor.setValue(content);
        }

        state.currentFilename = file.name;
        state.loadedFromURL = null; // Clear URL source when loading from file

        // Update document selector to show the new name
        if (typeof globalThis.updateDocumentSelector === 'function') {
            globalThis.updateDocumentSelector();
        }

        await renderMarkdown();
        showStatus(`Loaded: ${file.name}`);
        return true;
    } catch (error) {
        console.error('Error loading file:', error);
        showStatus(`Error loading file: ${error.message}`);
        return false;
    }
}

/** Fetch timeout in milliseconds (10 seconds) */
const FETCH_TIMEOUT_MS = 10000;

/** Maximum content size in bytes (10 MB) */
const MAX_CONTENT_SIZE = 10 * 1024 * 1024;

/**
 * Validate Content-Type header for markdown content
 * Defense-in-depth check to ensure we're loading text content
 *
 * Allowed types:
 * - text/* (text/plain, text/markdown, text/x-markdown, etc.)
 * - application/octet-stream (GitHub's default for raw files)
 * - No Content-Type header (some servers don't send it)
 *
 * Blocked types:
 * - application/javascript, text/javascript (executable code)
 * - text/html (could contain scripts)
 * - Binary types (application/zip, image/*, etc.)
 *
 * @param {string|null} contentType - The Content-Type header value
 * @returns {boolean} True if content type is acceptable
 */
export function isValidMarkdownContentType(contentType) {
    // No Content-Type header is acceptable (some servers don't send it)
    if (!contentType) {
        return true;
    }

    // Extract MIME type (ignore charset and other parameters)
    const mimeType = contentType.split(';')[0].trim().toLowerCase();

    // Block dangerous executable types first
    // Note: This validation relies on server sending truthful headers.
    // A compromised allowlisted domain could still send malicious content
    // with a spoofed Content-Type. Domain allowlisting is the primary defense.
    const blockedTypes = [
        'application/javascript',
        'text/javascript',
        'text/html',
        'application/x-javascript',
        'text/vbscript'  // Legacy VBScript (Windows IE)
    ];
    if (blockedTypes.includes(mimeType)) {
        console.warn('Content-Type blocked:', mimeType);
        return false;
    }

    // Allow text/* types (text/plain, text/markdown, etc.)
    if (mimeType.startsWith('text/')) {
        return true;
    }

    // Allow application/octet-stream (GitHub's default for raw files)
    if (mimeType === 'application/octet-stream') {
        return true;
    }

    // Block everything else (binary types, etc.)
    console.warn('Content-Type not allowed for markdown:', mimeType);
    return false;
}

/**
 * Load markdown from URL (with domain validation, timeout, size limits, and Content-Type validation)
 *
 * Security features:
 * - Gist URL normalization (converts gist.github.com to raw URLs)
 * - Domain allowlist validation
 * - 10 second fetch timeout (prevents hanging on slow endpoints)
 * - 10 MB content size limit (prevents loading extremely large files)
 * - Content-Type validation (blocks executable/binary content)
 *
 * @param {string} url - The URL to load markdown from
 * @returns {Promise<boolean>} True if successful, false on error
 */
export async function loadMarkdownFromURL(url) {
    // Normalize GitHub URLs (gist.github.com and github.com/blob) to raw URLs
    const normalizedUrl = normalizeGitHubContentUrl(url);

    if (!isAllowedMarkdownURL(normalizedUrl)) {
        showStatus('URL not allowed. Must be HTTPS, no credentials, valid length.');
        return false;
    }

    // Set up abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        showStatus('Loading from URL...');
        const response = await fetch(normalizedUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        // Check Content-Length header if available (first line of defense)
        const contentLength = response.headers.get('content-length');
        if (contentLength && Number.parseInt(contentLength, 10) > MAX_CONTENT_SIZE) {
            throw new Error(`File too large (${Math.round(Number.parseInt(contentLength, 10) / 1024 / 1024)}MB, max 10MB)`);
        }

        // Validate Content-Type header (defense-in-depth)
        const contentType = response.headers.get('content-type');
        if (!isValidMarkdownContentType(contentType)) {
            throw new Error('Invalid content type: expected text');
        }

        // Read response text (second line of defense - streaming check)
        const markdown = await response.text();

        // Verify actual content size (in case Content-Length was missing or incorrect)
        if (markdown.length > MAX_CONTENT_SIZE) {
            throw new Error(`File too large (${Math.round(markdown.length / 1024 / 1024)}MB, max 10MB)`);
        }

        const { cmEditor } = state;

        if (cmEditor) {
            cmEditor.setValue(markdown);
        }

        // Extract filename from normalized URL for display
        const urlPath = new URL(normalizedUrl).pathname;
        state.currentFilename = urlPath.split('/').pop() || 'remote.md';
        state.loadedFromURL = normalizedUrl; // Track URL source

        // Update document selector to show the new name
        if (typeof globalThis.updateDocumentSelector === 'function') {
            globalThis.updateDocumentSelector();
        }

        await renderMarkdown();
        showStatus(`Loaded: ${state.currentFilename}`);
        return true;
    } catch (error) {
        clearTimeout(timeoutId);

        // Provide user-friendly error messages
        if (error.name === 'AbortError') {
            console.error('Error loading URL: Request timed out');
            showStatus('Error loading URL: Request timed out (10s limit)');
        } else {
            console.error('Error loading URL:', error);
            showStatus(`Error loading URL: ${error.message}`);
        }
        return false;
    }
}

/**
 * Open file using native file picker
 * Triggers the hidden file input to show browser's file selection dialog
 */
export function openFile() {
    const mdFileInput = document.getElementById('mdFileInput');
    if (mdFileInput) {
        mdFileInput.click();
    }
}

/**
 * Save file (uses current filename or prompts for one)
 * If a filename is already set, saves directly. Otherwise calls saveFileAs()
 */
export function saveFile() {
    if (state.currentFilename) {
        downloadFile(state.currentFilename);
    } else {
        saveFileAs();
    }
}

/**
 * Save As - always prompts for filename
 * Shows a prompt dialog for the user to enter a filename
 */
export function saveFileAs() {
    const defaultName = state.currentFilename || 'document.md';
    const filename = prompt('Save as:', defaultName);

    if (filename) {
        // Ensure .md extension
        const finalName = filename.endsWith('.md') ? filename : filename + '.md';
        state.currentFilename = finalName;
        downloadFile(finalName);
    }
}

/**
 * Download the markdown content as a file
 * Creates a blob and triggers a download via a temporary anchor element
 * @param {string} filename - The filename to save as
 */
function downloadFile(filename) {
    const { cmEditor } = state;
    const content = cmEditor ? cmEditor.getValue() : '';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showStatus(`Saved: ${filename}`);
}

/**
 * Centralized file drop handler
 * Handles drag-and-drop of markdown files onto the editor
 * @param {DragEvent} e - The drop event
 */
export async function handleFileDrop(e) {
    const files = e.dataTransfer.files;

    if (files.length === 0) {
        showStatus('No file dropped');
        return;
    }

    const file = files[0];

    // Validate file type
    if (!isValidMarkdownFile(file)) {
        showStatus('Please drop a text or markdown file');
        return;
    }

    await loadMarkdownFile(file);
}

/**
 * Export to PDF using browser's print dialog
 * Uses the browser's native print functionality with @media print CSS rules
 */
export function exportToPDF() {
    const { wrapper } = getElements();

    // Validate content exists
    if (!wrapper.innerHTML || wrapper.innerHTML.trim() === '') {
        showStatus('Error: No content to export');
        return;
    }

    // Use the browser's native print dialog
    // This will use our @media print CSS rules
    showStatus('Opening print dialog...');

    // Small delay to allow status message to show
    setTimeout(() => {
        globalThis.print();
    }, 100);
}

/**
 * Alternative: Save as PDF programmatically (for browsers that support it)
 * Opens the preview in a new tab/window and triggers print dialog
 * This approach allows better control over what gets printed
 */
export async function exportToPDFDirect() {
    const { wrapper, currentStyleLink, currentSyntaxThemeLink } = getElements();

    // Validate content exists
    if (!wrapper.innerHTML || wrapper.innerHTML.trim() === '') {
        showStatus('Error: No content to export');
        return;
    }

    console.log('Starting PDF export...');
    showStatus('Generating PDF...');

    try {
        // Get the current custom style CSS if available
        let customStyleCSS = currentStyleLink ? currentStyleLink.textContent : '';

        // The CSS is already processed (print media queries stripped, scoped)
        // Just need to remove #wrapper scoping for the print window
        // since the entire document IS the wrapper content
        if (customStyleCSS) {
            customStyleCSS = customStyleCSS.replaceAll(/#wrapper\s+/g, '');
            customStyleCSS = customStyleCSS.replaceAll(/#preview\s+/g, '');
        }

        // Create a printable version
        const printWindow = window.open('', '_blank');

        // Build the HTML content for the print window
        // Note: Using document.open/write/close is the standard pattern for populating
        // a new window with content. While document.write is deprecated for inline use,
        // this pattern for new windows is still valid and widely supported.
        const syntaxThemeHref = currentSyntaxThemeLink?.href ||
            'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';

        const fallbackStyles = customStyleCSS ? '' : `
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            font-size: 11pt;
            line-height: 1.6;
            color: #000;
        }
        h1 { font-size: 24pt; margin-top: 16px; margin-bottom: 12px; page-break-after: avoid; }
        h2 { font-size: 18pt; margin-top: 14px; margin-bottom: 10px; page-break-after: avoid; }
        h3 { font-size: 14pt; margin-top: 12px; margin-bottom: 8px; page-break-after: avoid; }
        pre { background: #f5f5f5; padding: 12px; page-break-inside: avoid; }
        code { background: #f5f5f5; padding: 2px 4px; }
        `;

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Document</title>
    <link rel="stylesheet" href="${syntaxThemeHref}">
    <style>
        /* Force color printing FIRST - preserve ALL colors and backgrounds */
        *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }

        /* Specifically force syntax highlighting colors */
        pre, code, pre code, .hljs, .hljs * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }

        /* Custom Marked2 Style */
        ${customStyleCSS}

        /* Minimal fallback styles if no custom style loaded */
        ${fallbackStyles}

        /* Ensure print compatibility */
        .mermaid {
            margin: 16px 0;
            text-align: center;
            page-break-inside: avoid;
        }
        .mermaid svg {
            max-width: 100%;
            height: auto;
        }
        img, svg {
            max-width: 100%;
            height: auto;
            page-break-inside: avoid;
        }

        @media print {
            *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }

            /* Page break support for slide decks and paginated documents */
            /* Horizontal rules (<hr> from ---) trigger new pages */
            hr {
                page-break-after: always !important;
                break-after: page !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
                visibility: hidden !important;
                height: 0 !important;
            }

            /* Prevent headings from being orphaned */
            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid;
                break-after: avoid;
            }

            /* Respect all CSS page-break properties */
            [style*="page-break-before: always"],
            .page-break-before {
                page-break-before: always;
                break-before: page;
            }

            [style*="page-break-after: always"],
            .page-break-after {
                page-break-after: always;
                break-after: page;
            }

            [style*="page-break-inside: avoid"],
            .page-break-avoid {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
${wrapper.innerHTML}
</body>
</html>`;

        // Use the document's open/write/close pattern for new window content
        // This is the standard approach and distinct from deprecated inline document.write
        printWindow.document.open();
        printWindow.document.write(htmlContent); // NOSONAR - Standard pattern for new window population
        printWindow.document.close();

        // Wait for content and styles to fully load then trigger print
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.print();
                showStatus('Print dialog opened');
            }, 500);
        };
    } catch (error) {
        console.error('PDF generation error:', error);
        showStatus('Error: ' + error.message);
    }
}

/**
 * Load sample markdown content
 * Loads a comprehensive demo document showcasing all features
 */
export function loadSample() {
    const sample = `# Welcome to Merview

A client-side Markdown editor with first-class Mermaid diagram support.

\`\`\`mermaid
graph LR
    subgraph Merview Documentation
        A[Welcome<br/>You Are Here]
        B[About]
        C[Themes]
        D[Security]
        E[Contributing]
        F[Sponsor]
    end

    A --- B
    A --- C
    A --- D
    A --- E
    A --- F

    click B "/?url=docs/about.md" "About Merview"
    click C "/?url=docs/themes.md" "Theme Guide"
    click D "/?url=docs/security.md" "Security"
    click E "/?url=docs/contributing.md" "Contributing"
    click F "/?url=docs/sponsor.md" "Support the Project"
\`\`\`

---

## Quick Links

- [About Merview](/?url=docs/about.md) - Features, technology, and how it works
- [Theme Guide](/?url=docs/themes.md) - 37 document styles and customization
- [Security](/?url=docs/security.md) - Privacy-first design and protections
- [Contributing](/?url=docs/contributing.md) - How to help improve Merview
- [Support the Project](/?url=docs/sponsor.md) - Sponsor development

---

## Getting Started

### 1. Write Markdown

Type in the left pane. The preview updates in real-time on the right.

### 2. Add Mermaid Diagrams

Use fenced code blocks with \`mermaid\` as the language:

\`\`\`mermaid
sequenceDiagram
    You->>Merview: Write Markdown
    Merview->>You: See it rendered instantly
\`\`\`

### 3. Choose Your Style

Use the **Style** dropdown to pick from 37 professional themes.

### 4. Export

Click **Print/PDF** to save your document.

---

## Feature Showcase

### Code Syntax Highlighting

190+ languages supported with beautiful themes:

\`\`\`javascript
// JavaScript with syntax highlighting
const greet = (name) => \`Hello, \${name}!\`;
console.log(greet('World'));
\`\`\`

\`\`\`python
# Python example
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
\`\`\`

### Tables

| Feature | Status |
|---------|--------|
| Markdown Rendering | ✅ |
| Mermaid Diagrams | ✅ |
| Syntax Highlighting | ✅ |
| PDF Export | ✅ |
| 37 Themes | ✅ |

### Flowcharts

\`\`\`mermaid
graph TD
    A[Write Markdown] --> B[Add Diagrams]
    B --> C[Style Document]
    C --> D[Export PDF]
\`\`\`

### Sequence Diagrams

\`\`\`mermaid
sequenceDiagram
    participant User
    participant Editor
    participant Preview

    User->>Editor: Type content
    Editor->>Preview: Render
    Preview-->>User: See results
\`\`\`

### Class Diagrams

\`\`\`mermaid
classDiagram
    class Document {
        +String content
        +render()
        +export()
    }
    class Theme {
        +String name
        +apply()
    }
    Document --> Theme
\`\`\`

---

## Tips

1. **Drag & Drop** - Drop any \`.md\` file to load it
2. **Resize Panes** - Drag the divider between editor and preview
3. **Keyboard Shortcuts** - Ctrl+S to save, Ctrl+P to print
4. **Auto-save** - Your work is saved to browser storage

---

## Open Source

Merview is free and open source under the AGPL-3.0 license.

- **GitHub**: [github.com/mickdarling/merview](https://github.com/mickdarling/merview)
- **Issues**: [Report a bug or request a feature](https://github.com/mickdarling/merview/issues)

---

**Start writing!** Clear this document and create something amazing.`;

    const { cmEditor } = state;
    if (cmEditor) {
        cmEditor.setValue(sample);
    }

    // Set document name for the sample
    state.currentFilename = 'Welcome.md';
    state.loadedFromURL = null;

    // Update document selector to show the new name
    if (typeof globalThis.updateDocumentSelector === 'function') {
        globalThis.updateDocumentSelector();
    }

    renderMarkdown();
}

/**
 * Initialize file input handlers
 * Creates the hidden file input element and sets up event listeners
 * Should be called once during app initialization
 */
export function initFileInputHandlers() {
    // Create the hidden file input if it doesn't exist
    let mdFileInput = document.getElementById('mdFileInput');
    if (!mdFileInput) {
        mdFileInput = document.createElement('input');
        mdFileInput.type = 'file';
        mdFileInput.id = 'mdFileInput';
        mdFileInput.accept = '.md,.markdown,.txt,.text';
        mdFileInput.style.display = 'none';
        document.body.appendChild(mdFileInput);
    }

    // Handle file selection from file picker
    mdFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Defensive validation (browser's accept attribute can be bypassed)
        if (!isValidMarkdownFile(file)) {
            showStatus('Please select a text or markdown file');
            mdFileInput.value = '';
            return;
        }

        await loadMarkdownFile(file);

        // Reset input so the same file can be selected again
        mdFileInput.value = '';
    });
}
