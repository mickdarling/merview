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
import { isAllowedMarkdownURL } from './security.js';
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
 * Load markdown from URL (with domain validation, timeout, and size limits)
 *
 * Security features:
 * - Domain allowlist validation
 * - 10 second fetch timeout (prevents hanging on slow endpoints)
 * - 10 MB content size limit (prevents loading extremely large files)
 *
 * @param {string} url - The URL to load markdown from
 * @returns {Promise<boolean>} True if successful, false on error
 */
export async function loadMarkdownFromURL(url) {
    if (!isAllowedMarkdownURL(url)) {
        const { ALLOWED_MARKDOWN_DOMAINS } = await import('./config.js');
        showStatus(`URL not allowed. Trusted: ${ALLOWED_MARKDOWN_DOMAINS.join(', ')}`);
        return false;
    }

    // Set up abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        showStatus('Loading from URL...');
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        // Check Content-Length header if available (first line of defense)
        const contentLength = response.headers.get('content-length');
        if (contentLength && Number.parseInt(contentLength, 10) > MAX_CONTENT_SIZE) {
            throw new Error(`File too large (${Math.round(Number.parseInt(contentLength, 10) / 1024 / 1024)}MB, max 10MB)`);
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

        // Extract filename from URL for display
        const urlPath = new URL(url).pathname;
        state.currentFilename = urlPath.split('/').pop() || 'remote.md';

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
    const sample = `# Comprehensive Markdown + Mermaid Feature Demo

Welcome to the **Merview** demonstration document! This file showcases all the features including syntax highlighting, Mermaid diagrams, tables, and various formatting options.

## Table of Contents

1. [Text Formatting](#text-formatting)
2. [Lists](#lists)
3. [Code Blocks](#code-blocks)
4. [Tables](#tables)
5. [Mermaid Diagrams](#mermaid-diagrams)
6. [Blockquotes](#blockquotes)

---

## Text Formatting

You can use **bold text**, *italic text*, ***bold and italic***, ~~strikethrough~~, and \`inline code\`.

Here's a paragraph with some [links to external resources](https://github.com). Links are automatically styled according to your selected theme.

### Subheadings Work Too

And they render beautifully with the custom styles applied!

---

## Lists

### Unordered Lists

- First item
- Second item
  - Nested item 1
  - Nested item 2
- Third item
- Fourth item with **bold** and *italic*

### Ordered Lists

1. Step one: Install the renderer
2. Step two: Open the HTML file
3. Step three: Start writing Markdown
   1. Sub-step A
   2. Sub-step B
4. Step four: Export to PDF

### Task Lists

- [x] Completed task
- [x] Another completed task
- [ ] Pending task
- [ ] Another pending task

---

## Code Blocks

### JavaScript (labeled)

\`\`\`javascript
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

// Calculate the 10th Fibonacci number
const result = fibonacci(10);
console.log(\`Fibonacci(10) = \${result}\`);

// Arrow function example
const greet = (name) => \`Hello, \${name}!\`;
\`\`\`

### Python (labeled)

\`\`\`python
def quick_sort(arr):
    """Quick sort algorithm implementation"""
    if len(arr) <= 1:
        return arr

    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]

    return quick_sort(left) + middle + quick_sort(right)

# Example usage
numbers = [3, 6, 8, 10, 1, 2, 1]
sorted_numbers = quick_sort(numbers)
print(f"Sorted: {sorted_numbers}")
\`\`\`

### YAML Configuration (labeled)

\`\`\`yaml
# Application Configuration
application:
  name: "Markdown Renderer"
  version: "1.0.0"
  author:
    name: "Development Team"
    email: "team@example.com"

server:
  host: "localhost"
  port: 8080
  ssl:
    enabled: true
    certificate: "/path/to/cert.pem"

features:
  - syntax-highlighting
  - mermaid-diagrams
  - pdf-export
  - custom-themes

themes:
  default: "Academia"
  available:
    - name: "GitHub"
      type: "technical"
    - name: "Torpedo"
      type: "creative"
\`\`\`

### JSON Data (labeled)

\`\`\`json
{
  "project": {
    "name": "Merview",
    "version": "1.0.0",
    "description": "A beautiful Markdown renderer with Mermaid support",
    "features": [
      "Real-time rendering",
      "Syntax highlighting",
      "37 professional themes",
      "PDF export"
    ],
    "config": {
      "autoSave": true,
      "theme": "Academia",
      "lintEnabled": false
    },
    "stats": {
      "lines": 1247,
      "size": "45KB",
      "lastModified": "2025-01-21T11:55:00Z"
    }
  }
}
\`\`\`

### Code Without Language Label (unlabeled)

\`\`\`
This is a code block without a language label.
It will use auto-detection or render as plain text.

function example() {
    return "No syntax highlighting specified";
}

The renderer will still format it nicely!
\`\`\`

---

## Tables

### Basic Table

| Feature | Status | Priority |
|---------|--------|----------|
| Markdown Rendering | ✅ Complete | High |
| Mermaid Diagrams | ✅ Complete | High |
| Syntax Highlighting | ✅ Complete | High |
| PDF Export | ✅ Complete | Medium |
| Code Validation | ✅ Complete | Low |

### Complex Table with Formatting

| Language | Extension | Highlighting | Validation | Notes |
|----------|-----------|--------------|------------|-------|
| **JavaScript** | \`.js\` | ✅ Yes | ✅ Syntax Check | Most popular |
| **Python** | \`.py\` | ✅ Yes | ❌ No | Coming soon |
| **YAML** | \`.yaml\`, \`.yml\` | ✅ Yes | ❌ No | Config files |
| **JSON** | \`.json\` | ✅ Yes | ✅ Parse Check | Data format |

---

## Mermaid Diagrams

### Flowchart

\`\`\`mermaid
graph TD
    A[Start Application] --> B{User Action?}
    B -->|Load File| C[Parse Markdown]
    B -->|Type Text| D[Real-time Render]
    B -->|Export PDF| E[Generate PDF]
    C --> F[Apply Syntax Highlighting]
    D --> F
    F --> G[Render Mermaid]
    G --> H[Apply Custom Style]
    H --> I[Display Preview]
    E --> J[Open Print Dialog]
    J --> K[Save PDF]
    K --> L[End]
    I --> B
\`\`\`

### Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant User
    participant Editor
    participant Renderer
    participant Mermaid
    participant Preview

    User->>Editor: Type Markdown
    Editor->>Renderer: Request Render
    Renderer->>Renderer: Parse Markdown
    Renderer->>Mermaid: Render Diagrams
    Mermaid-->>Renderer: SVG Output
    Renderer->>Preview: Update HTML
    Preview-->>User: Display Result

    User->>Editor: Drop File
    Editor->>Renderer: Load Content
    Renderer->>Preview: Render Complete
    Preview-->>User: Show Document
\`\`\`

### Class Diagram

\`\`\`mermaid
classDiagram
    class MarkdownRenderer {
        +String content
        +Style currentStyle
        +Boolean lintEnabled
        +render()
        +loadStyle(name)
        +exportPDF()
    }

    class CodeHighlighter {
        +highlight(code, language)
        +autoDetect(code)
        +getLanguage(name)
    }

    class MermaidEngine {
        +render(element, content)
        +initialize(config)
    }

    class StyleManager {
        +loadFromGitHub(url)
        +scopeCSS(css)
        +stripPrintMedia(css)
    }

    MarkdownRenderer --> CodeHighlighter
    MarkdownRenderer --> MermaidEngine
    MarkdownRenderer --> StyleManager
\`\`\`

---

## Blockquotes

> **Note:** This is a blockquote. It's perfect for highlighting important information or quotes.

> You can have multiple paragraphs in a blockquote.
>
> Like this one! The styling is applied based on your selected theme.

---

## Tips for Using This Renderer

1. **Choose Your Style**: Select from 37 professional themes in the dropdown
2. **Real-time Preview**: The preview updates as you type
3. **Drag & Drop**: Drop any \`.md\` file to load it instantly
4. **Resize Panels**: Drag the handle between editor and preview to adjust sizes
5. **Export Options**:
   - Use **Print/PDF** for in-place printing
   - Use **Print (New Tab)** to open in a new window first
6. **Code Validation**: Toggle the validation panel to check your code blocks

---

**Happy documenting!** 📝`;

    const { cmEditor } = state;
    if (cmEditor) {
        cmEditor.setValue(sample);
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
