// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling
/**
 * renderer.js - Markdown and Mermaid rendering module for Merview
 * Handles converting markdown to HTML with syntax highlighting and mermaid diagrams
 */

import { state } from './state.js';
import { getElements } from './dom.js';
import { saveMarkdownContent } from './storage.js';
import { updateSessionContent, isSessionsInitialized } from './sessions.js';
import { escapeHtml, slugify, showStatus, isRelativeUrl, resolveRelativeUrl, isMarkdownUrl } from './utils.js';
import { validateCode } from './validation.js';

// Debug flag for Mermaid theme investigation (#168)
// Enable via: localStorage.setItem('debug-mermaid-theme', 'true')
// Note: Checked at runtime so changes take effect immediately without page refresh
function isDebugMermaidTheme() {
    return localStorage.getItem('debug-mermaid-theme') === 'true';
}

// Debug flag for Mermaid performance tracking (#326)
// Enable via: localStorage.setItem('debug-mermaid-perf', 'true')
function isDebugMermaidPerf() {
    return localStorage.getItem('debug-mermaid-perf') === 'true';
}

/**
 * Preload margin for lazy loading Mermaid diagrams (Issue #326)
 * Diagrams start rendering when they're this distance from the viewport.
 * 200px provides a good balance: far enough to preload before user scrolls to it,
 * but not so aggressive that we load too many diagrams at once on long pages.
 */
const MERMAID_PRELOAD_MARGIN = '200px';

/**
 * Performance tracking for Mermaid lazy loading
 * Tracks render times and error counts when debug-mermaid-perf is enabled
 */
const mermaidPerfMetrics = {
    firstRenderTime: null,
    totalRendered: 0,
    totalPending: 0,
    totalErrors: 0,
    renderTimes: [],

    reset() {
        this.firstRenderTime = null;
        this.totalRendered = 0;
        this.totalPending = 0;
        this.totalErrors = 0;
        this.renderTimes = [];
    },

    recordRenderStart() {
        if (!this.firstRenderTime) {
            this.firstRenderTime = performance.now();
        }
        return performance.now();
    },

    recordRenderComplete(startTime) {
        const duration = performance.now() - startTime;
        this.renderTimes.push(duration);
        this.totalRendered++;
        if (isDebugMermaidPerf()) {
            console.log(`[Mermaid Perf] Diagram rendered in ${duration.toFixed(2)}ms`);
        }
    },

    recordError() {
        this.totalErrors++;
    },

    updatePendingCount(count) {
        this.totalPending = count;
    },

    logSummary() {
        if (isDebugMermaidPerf() && this.renderTimes.length > 0) {
            const avgTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
            const timeToFirst = this.firstRenderTime ? `${(performance.now() - this.firstRenderTime).toFixed(2)}ms ago` : 'N/A';
            console.log('[Mermaid Perf Summary]', {
                timeToFirstRender: timeToFirst,
                totalRendered: this.totalRendered,
                totalPending: this.totalPending,
                totalErrors: this.totalErrors,
                averageRenderTime: `${avgTime.toFixed(2)}ms`,
                minRenderTime: `${Math.min(...this.renderTimes).toFixed(2)}ms`,
                maxRenderTime: `${Math.max(...this.renderTimes).toFixed(2)}ms`
            });
        }
    }
};

// Initialize Mermaid with security settings (theme set dynamically)
mermaid.initialize({
    startOnLoad: false,
    theme: state.mermaidTheme,
    securityLevel: 'strict',  // Security: Prevents XSS attacks through malicious diagrams
});

/**
 * Update Mermaid theme based on preview background or user selection
 * Called when preview style changes to sync diagram colors with background,
 * but only applies auto-detection if user has selected 'Auto' mode.
 * If user has manually selected a theme, that theme takes precedence.
 * @param {boolean} isDark - Whether the preview background is dark
 */
export function updateMermaidTheme(isDark) {
    // Valid Mermaid themes (excluding 'auto' which is a mode, not a theme)
    const validThemes = ['default', 'forest', 'dark', 'neutral', 'base'];

    // Determine the actual theme to use
    let newTheme;
    if (state.mermaidThemeMode === 'auto') {
        // Auto mode: switch based on background
        newTheme = isDark ? 'dark' : 'default';
    } else {
        // Manual selection: use the user's chosen theme if valid, otherwise fallback
        newTheme = validThemes.includes(state.mermaidThemeMode)
            ? state.mermaidThemeMode
            : 'default';
    }

    // Debug logging for issue #168 investigation
    // Enable via: localStorage.setItem('debug-mermaid-theme', 'true')
    if (isDebugMermaidTheme()) {
        console.log('[Mermaid Theme]', {
            mode: state.mermaidThemeMode,
            isDark,
            currentTheme: state.mermaidTheme,
            newTheme,
            willUpdate: state.mermaidTheme !== newTheme
        });
    }

    if (state.mermaidTheme !== newTheme) {
        state.mermaidTheme = newTheme;
        // Reinitialize Mermaid with new theme
        mermaid.initialize({
            startOnLoad: false,
            theme: newTheme,
            securityLevel: 'strict',
        });
    }
}

// Configure marked with GitHub Flavored Markdown settings
marked.setOptions({
    breaks: true,
    gfm: true
});

// Custom renderer for markdown with mermaid blocks, syntax highlighting, and heading IDs
const renderer = new marked.Renderer();

/**
 * Custom heading renderer to generate IDs for anchor links
 * Enables Table of Contents functionality with clickable links
 */
renderer.heading = function(text, level) {
    const slug = slugify(text);
    return `<h${level} id="${slug}">${text}</h${level}>\n`;
};

/**
 * Custom link renderer to resolve relative URLs against the source document URL (Issue #345)
 * When content is loaded from a remote URL (state.loadedFromURL), relative links
 * like "./other.md" or "../folder/file.md" are resolved to absolute URLs.
 * Markdown links get special data attributes for in-app navigation.
 *
 * Security Note: The 'text' parameter may contain HTML from markdown inline formatting
 * (e.g., [**bold**](url) becomes text="<strong>bold</strong>"). We sanitize it here
 * for defense-in-depth, though DOMPurify also sanitizes the entire output in renderMarkdown().
 */
renderer.link = function(href, title, text) {
    // Resolve relative URLs ONLY for remote sources (not same-origin)
    // For local docs, relative links should use normal browser navigation
    // Example: local doc at /?url=docs/about.md with link to ./guide.md
    //   → Should navigate to /?url=docs/guide.md (not resolve against localhost)
    let resolvedHref = href;
    if (state.loadedFromURL && isRelativeUrl(href)) {
        try {
            const sourceUrl = new URL(state.loadedFromURL);
            const isSameOrigin = sourceUrl.origin === globalThis.location.origin;
            // Only resolve relative URLs for remote/external sources
            if (!isSameOrigin) {
                const resolved = resolveRelativeUrl(href, state.loadedFromURL);
                if (resolved) {
                    resolvedHref = resolved;
                }
            }
        } catch {
            // Invalid URL - don't resolve
        }
    }

    // Build attributes
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';

    // Security: Sanitize link text to prevent XSS from raw HTML in markdown
    // Uses DOMPurify inline to preserve legitimate formatting while removing dangerous content
    const safeText = DOMPurify.sanitize(text || '');

    // Check if this is a remote markdown link that should open in Merview
    // Don't intercept root-relative URLs (/?url=..., /docs/...) - they navigate normally
    if (isMarkdownUrl(resolvedHref) && !resolvedHref.startsWith('/')) {
        // Add data attribute for JavaScript click handler to intercept
        return `<a href="${escapeHtml(resolvedHref)}"${titleAttr} data-merview-link="true">${safeText}</a>`;
    }

    // External or non-markdown links open normally
    return `<a href="${escapeHtml(resolvedHref)}"${titleAttr}>${safeText}</a>`;
};

/**
 * Custom image renderer to resolve relative image URLs against the source document URL (Issue #345)
 * When content is loaded from a remote URL (state.loadedFromURL), relative image paths
 * like "./images/diagram.png" are resolved to absolute URLs so images display correctly.
 */
renderer.image = function(href, title, text) {
    // Resolve relative URLs ONLY for remote sources (not same-origin)
    // For local docs, relative image paths work fine with normal browser resolution
    let resolvedHref = href;
    if (state.loadedFromURL && isRelativeUrl(href)) {
        try {
            const sourceUrl = new URL(state.loadedFromURL);
            const isSameOrigin = sourceUrl.origin === globalThis.location.origin;
            // Only resolve relative URLs for remote/external sources
            if (!isSameOrigin) {
                const resolved = resolveRelativeUrl(href, state.loadedFromURL);
                if (resolved) {
                    resolvedHref = resolved;
                }
            }
        } catch {
            // Invalid URL - don't resolve
        }
    }

    // Build attributes
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    const altAttr = text ? ` alt="${escapeHtml(text)}"` : ' alt=""';

    return `<img src="${escapeHtml(resolvedHref)}"${altAttr}${titleAttr}>`;
};

/**
 * Helper function to highlight markdown code blocks with YAML front matter
 * Detects YAML front matter pattern (---\nYAML\n---) and highlights YAML and markdown separately
 * @param {string} code - The code content to highlight
 * @returns {string|null} HTML string with highlighted content, or null if not applicable
 */
function highlightYAMLFrontMatter(code) {
    // Early exit if code doesn't start with YAML delimiter
    if (!code.startsWith('---')) {
        return null;
    }

    // Prevent ReDoS with extremely large inputs
    if (code.length > 100000) {
        return null;
    }

    // Early exit optimization: check for closing delimiter before running regex
    // If there's no closing delimiter (must have \n--- somewhere after opening), there's no valid YAML front matter
    if (!code.includes('\n---')) {
        return null;
    }

    // Detect YAML front matter pattern: starts with ---, has content, ends with ---
    const frontMatterMatch = YAML_FRONTMATTER_REGEX.exec(code);
    if (!frontMatterMatch || typeof hljs === 'undefined') {
        return null;
    }

    try {
        const yamlContent = frontMatterMatch[1];
        const mdContent = frontMatterMatch[2];

        // Handle empty or whitespace-only YAML content
        // This handles the edge case of "---\n---" or "---\n  \n---" with no actual YAML
        if (!yamlContent?.trim()) {
            const delimiterClass = 'hljs-meta';
            const hasMdContent = mdContent.trim();
            const highlightedMd = hasMdContent
                ? hljs.highlight(mdContent, { language: 'markdown', ignoreIllegals: true })
                : { value: '' };
            const mdOutput = highlightedMd.value ? '\n' + highlightedMd.value : '';
            return `<pre><code class="hljs language-markdown" data-language="markdown"><span class="${delimiterClass}">---</span>\n<span class="${delimiterClass}">---</span>${mdOutput}</code></pre>`;
        }

        // Highlight each section with appropriate language
        const highlightedYaml = hljs.highlight(yamlContent, { language: 'yaml', ignoreIllegals: true });
        const highlightedMd = mdContent.trim()
            ? hljs.highlight(mdContent, { language: 'markdown', ignoreIllegals: true })
            : { value: '' };

        // Combine with styled delimiters (hljs-meta for the --- markers)
        const delimiterClass = 'hljs-meta';
        return `<pre><code class="hljs language-markdown" data-language="markdown"><span class="${delimiterClass}">---</span>\n${highlightedYaml.value}\n<span class="${delimiterClass}">---</span>${highlightedMd.value ? '\n' + highlightedMd.value : ''}</code></pre>`;
    } catch (err) {
        console.error('YAML front matter highlight error:', err);
        return null;
    }
}

/**
 * Helper function to apply syntax highlighting to code blocks
 * Handles language detection, normalization, and fallback to auto-detection
 * @param {string} code - The code content to highlight
 * @param {string} language - The language identifier (may be null/undefined)
 * @returns {string} HTML string with highlighted code
 */
function highlightCodeBlock(code, language) {
    // Check if highlight.js is available
    if (typeof hljs === 'undefined') {
        console.error('highlight.js (hljs) is not loaded!');
        const escaped = escapeHtml(code);
        return `<pre><code data-language="${language || 'text'}">${escaped}</code></pre>`;
    }

    // Apply syntax highlighting for specified language
    if (language) {
        try {
            // Normalize language names (yaml/yml are the same)
            const normalizedLang = language.toLowerCase();
            const langMap = { 'yml': 'yaml' };
            const mappedLang = langMap[normalizedLang] || normalizedLang;

            if (hljs.getLanguage(mappedLang)) {
                const highlighted = hljs.highlight(code, { language: mappedLang, ignoreIllegals: true });
                return `<pre><code class="hljs language-${mappedLang}" data-language="${mappedLang}">${highlighted.value}</code></pre>`;
            } else {
                console.warn('Language not supported by highlight.js:', language);
            }
        } catch (err) {
            console.error('Highlight error for language', language, ':', err);
            // Fall through to auto-detection on error
        }
    }

    // Fallback to auto-detection or plain rendering
    try {
        const highlighted = hljs.highlightAuto(code);
        return `<pre><code class="hljs" data-language="${highlighted.language || language || 'text'}">${highlighted.value}</code></pre>`;
    } catch (err) {
        console.error('Auto-highlight error:', err);
        // Final fallback to plain code block
        const escaped = escapeHtml(code);
        return `<pre><code data-language="${language || 'text'}">${escaped}</code></pre>`;
    }
}

/**
 * Custom code block renderer
 * - Detects and renders Mermaid diagrams with expand buttons
 * - Applies syntax highlighting to code blocks using highlight.js
 * - Handles language detection and normalization
 */
renderer.code = function(code, language) {
    // Handle Mermaid diagrams specially
    // Note: Using data attributes instead of inline event handlers because DOMPurify strips onclick/ondblclick
    // Event listeners are attached programmatically after rendering in renderMarkdown()
    if (language === 'mermaid') {
        const id = `mermaid-${state.mermaidCounter++}`;
        return `<div class="mermaid-container" data-mermaid-id="${id}">
            <button class="mermaid-expand-btn" data-expand-target="${id}" title="Expand diagram">⛶</button>
            <div class="mermaid" id="${id}">${code}</div>
        </div>`;
    }

    // Handle markdown with YAML front matter
    if (language === 'markdown' || language === 'md') {
        const yamlResult = highlightYAMLFrontMatter(code);
        if (yamlResult) {
            return yamlResult;
        }
    }

    // Apply syntax highlighting for other code blocks
    return highlightCodeBlock(code, language);
};

// Apply the custom renderer to marked
marked.setOptions({ renderer });

/**
 * Pre-compiled regex for YAML front matter detection
 * Used by highlightYAMLFrontMatter() - compiled once for performance
 *
 * Pattern: /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
 *
 * Delimiter Handling:
 * - Opening delimiter (---\n): Requires a newline after '---' because YAML front matter
 *   MUST have content or structure following the opening delimiter. An opening delimiter
 *   without a newline would be incomplete or malformed.
 *
 * - Closing delimiter (---\n?): Has an OPTIONAL newline (\n?) because the closing '---'
 *   may appear at the end of the file with no trailing newline, OR may have markdown
 *   content following it. This flexibility handles both EOF scenarios and documents
 *   with content after the front matter.
 *
 * Capture Groups:
 * - Group 1 ([\s\S]*?): The YAML content between delimiters (non-greedy)
 * - Group 2 ([\s\S]*): The markdown content after the closing delimiter (greedy)
 *
 * Regex Backtracking Safety:
 * The non-greedy quantifier ([\s\S]*?) in Group 1 could potentially cause catastrophic
 * backtracking with malicious inputs. However, this risk is mitigated by several guards
 * in highlightYAMLFrontMatter():
 * - 100KB size limit check (line 104) prevents extremely large inputs
 * - Early exit if '\n---' delimiter not found (line 110) prevents worst-case backtracking
 * - startsWith('---') check (line 99) ensures proper start pattern
 * These guards ensure the regex operates on validated, bounded inputs, making catastrophic
 * backtracking practically impossible.
 */
const YAML_FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/**
 * Security limits for YAML front matter parsing
 * These limits prevent resource exhaustion attacks through malicious YAML content
 */
const YAML_SECURITY_LIMITS = {
    MAX_VALUE_LENGTH: 10000,  // Maximum length of any single value in characters
    MAX_KEYS: 100,            // Maximum number of keys in the YAML object
    MAX_ARRAY_ITEMS: 500      // Maximum number of items in an array
};

/**
 * Check if a YAML line contains dangerous patterns (anchors, aliases, tags)
 * @param {string} line - The line to check
 * @returns {boolean} True if the line contains dangerous patterns
 */
function hasDangerousYAMLPattern(line) {
    // Anchors (&name) can be used for billion laughs attacks
    // Aliases (*name) can reference anchors causing exponential expansion
    // Custom tags (!tag or !!type) can execute arbitrary code in some YAML parsers
    // Note: Only reject YAML syntax patterns where the special character
    // is followed by a word character (anchor/alias/tag names)
    const dangerousPatterns = /&\w|\*\w|!\w|!!/;
    return dangerousPatterns.test(line);
}

/**
 * Truncate a value if it exceeds the maximum length limit
 * @param {string} value - The value to truncate
 * @param {string} context - Description for logging (e.g., key name)
 * @returns {string} The possibly truncated value
 */
function truncateYAMLValue(value, context) {
    if (value.length > YAML_SECURITY_LIMITS.MAX_VALUE_LENGTH) {
        console.warn(`YAML security: ${context} exceeds MAX_VALUE_LENGTH (${YAML_SECURITY_LIMITS.MAX_VALUE_LENGTH}), truncating`);
        return value.substring(0, YAML_SECURITY_LIMITS.MAX_VALUE_LENGTH) + '... [truncated]';
    }
    return value;
}

/**
 * Remove surrounding quotes from a YAML value (single or double quotes)
 * Only removes quotes if they match at both ends; internal quotes are preserved
 * @param {string} value - The value that may have surrounding quotes
 * @returns {string} The value with surrounding quotes removed
 */
function stripSurroundingQuotes(value) {
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return value.substring(1, value.length - 1);
    }
    return value;
}

/**
 * Parse YAML front matter from markdown content
 * Extracts YAML between --- delimiters at start of file
 * @param {string} markdown - The markdown content
 * @returns {Object} Object with frontMatter (parsed object), yamlText (raw YAML string), and remainingMarkdown
 */
function parseYAMLFrontMatter(markdown) {
    // Check if content starts with ---
    if (!markdown.trimStart().startsWith('---')) {
        return { frontMatter: null, yamlText: '', remainingMarkdown: markdown };
    }

    const lines = markdown.split('\n');
    let yamlStartIndex = -1;
    let yamlEndIndex = -1;

    // Find the YAML delimiters
    for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim();
        if (trimmedLine === '---') {
            if (yamlStartIndex === -1) {
                yamlStartIndex = i;
            } else {
                yamlEndIndex = i;
                break;
            }
        }
    }

    // No valid YAML front matter found
    if (yamlStartIndex === -1 || yamlEndIndex === -1 || yamlEndIndex <= yamlStartIndex + 1) {
        return { frontMatter: null, yamlText: '', remainingMarkdown: markdown };
    }

    // Extract YAML and remaining markdown
    const yamlLines = lines.slice(yamlStartIndex + 1, yamlEndIndex);
    const yamlText = yamlLines.join('\n');
    const remainingLines = lines.slice(yamlEndIndex + 1);
    const remainingMarkdown = remainingLines.join('\n');

    // Parse YAML into object (simple key-value parser)
    const frontMatter = parseSimpleYAML(yamlText);

    return { frontMatter, yamlText, remainingMarkdown };
}

/**
 * Simple YAML parser for common cases with security hardening
 * Handles basic key: value pairs, arrays, and simple nested structures
 *
 * Security Considerations:
 * - Rejects YAML anchors (&), aliases (*), and custom tags (!) to prevent injection attacks
 * - Enforces size limits on values, keys, and arrays to prevent resource exhaustion
 * - Does not support advanced YAML features (multiline strings, nested objects, etc.)
 * - All values are treated as strings and escaped during rendering
 *
 * Limitations:
 * - This is a simple parser, not a full YAML implementation
 * - Does not handle complex nested structures or multiline values
 * - Primarily designed for basic document metadata (title, author, date, tags, etc.)
 *
 * @param {string} yamlText - The YAML text to parse
 * @returns {Object} Parsed YAML object with security checks applied
 */
function parseSimpleYAML(yamlText) {
    const result = {};
    const lines = yamlText.split('\n');
    let currentArray = null;
    let keyCount = 0;

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip empty lines, comments, and dangerous patterns
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }
        if (hasDangerousYAMLPattern(trimmedLine)) {
            console.warn('YAML security: Skipping line with potentially dangerous pattern (anchor/alias/tag):', trimmedLine);
            continue;
        }

        // Process array items (starting with - )
        if (trimmedLine.startsWith('- ')) {
            const arrayResult = processYAMLArrayItem(trimmedLine, currentArray);
            currentArray = arrayResult.currentArray;
            continue;
        }

        // Process key-value pairs
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex > 0) {
            // Security: Enforce key count limit
            if (keyCount >= YAML_SECURITY_LIMITS.MAX_KEYS) {
                console.warn(`YAML security: Exceeded MAX_KEYS (${YAML_SECURITY_LIMITS.MAX_KEYS}), ignoring additional keys`);
                break;
            }

            const parseResult = processYAMLKeyValue(trimmedLine, colonIndex);
            result[parseResult.key] = parseResult.value;
            currentArray = parseResult.newArray;
            keyCount++;
        }
    }

    return result;
}

/**
 * Process a YAML array item line
 * @param {string} line - The trimmed line starting with '- '
 * @param {Array|null} currentArray - The current array being populated
 * @returns {Object} Object with currentArray property (consistent with processYAMLKeyValue API)
 */
function processYAMLArrayItem(line, currentArray) {
    // Early return if no array context - orphaned array items are ignored
    if (!currentArray) {
        return { currentArray: null };
    }

    // Security: Enforce array size limit before processing
    if (currentArray.length >= YAML_SECURITY_LIMITS.MAX_ARRAY_ITEMS) {
        console.warn(`YAML security: Array exceeds MAX_ARRAY_ITEMS (${YAML_SECURITY_LIMITS.MAX_ARRAY_ITEMS}), ignoring additional items`);
        return { currentArray };
    }

    // Extract and sanitize the value
    let value = line.substring(2).trim();
    value = truncateYAMLValue(value, 'Array item');

    currentArray.push(value);
    return { currentArray };
}

/**
 * Process a YAML key-value pair line
 * @param {string} line - The trimmed line containing a colon
 * @param {number} colonIndex - Index of the colon in the line
 * @returns {Object} Object with key, value, and newArray properties
 */
function processYAMLKeyValue(line, colonIndex) {
    const key = line.substring(0, colonIndex).trim();
    const rawValue = line.substring(colonIndex + 1).trim();

    // Key with no value - might be starting an array or object
    if (rawValue === '') {
        const newArray = [];
        return { key, value: newArray, newArray };
    }

    // Key with value - reset array tracking
    let cleanValue = stripSurroundingQuotes(rawValue);
    cleanValue = truncateYAMLValue(cleanValue, `Value for key "${key}"`);

    return { key, value: cleanValue, newArray: null };
}

/**
 * Render YAML front matter as a collapsible HTML panel with XSS protection
 *
 * Security Notes:
 * - All keys and values are escaped using escapeHtml() to prevent XSS attacks
 * - Arrays and nested objects are sanitized before rendering
 * - The entire output is further sanitized by DOMPurify in renderMarkdown()
 * - No user input is rendered as raw HTML
 *
 * @param {Object} frontMatter - Parsed YAML object (already validated by parseSimpleYAML)
 * @returns {string} HTML string for the front matter panel (will be sanitized by DOMPurify)
 */
function renderYAMLFrontMatter(frontMatter) {
    if (!frontMatter || Object.keys(frontMatter).length === 0) {
        return '';
    }

    let tableRows = '';
    for (const [key, value] of Object.entries(frontMatter)) {
        // Security: Escape all keys to prevent XSS
        const escapedKey = escapeHtml(key);
        let escapedValue;

        if (Array.isArray(value)) {
            // Security: Escape each array item to prevent XSS
            const listItems = value.map(item => `<li>${escapeHtml(String(item))}</li>`).join('');
            escapedValue = `<ul>${listItems}</ul>`;
        } else if (typeof value === 'object' && value !== null) {
            // Security: Escape nested object keys and values to prevent XSS
            const nested = Object.entries(value)
                .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(String(v))}`)
                .join('<br>');
            escapedValue = nested;
        } else {
            // Security: Escape scalar values to prevent XSS
            escapedValue = escapeHtml(String(value));
        }

        tableRows += `<tr>
            <td>${escapedKey}</td>
            <td>${escapedValue}</td>
        </tr>`;
    }

    return `<details class="yaml-front-matter">
        <summary>
            <span class="yaml-icon">📋</span>
            <span class="yaml-label">Document Metadata</span>
        </summary>
        <table>
            ${tableRows}
        </table>
    </details>`;
}

/**
 * Sanitize Mermaid SVG using two-pass approach
 * Extracts foreignObject content, sanitizes SVG structure, then re-injects sanitized HTML.
 * This preserves edge labels while blocking XSS attacks.
 * @param {string} svg - Raw SVG string from Mermaid
 * @returns {Element} Sanitized SVG DOM element ready for insertion
 * @throws {Error} If SVG is invalid or parsing fails
 */
function sanitizeMermaidSvg(svg) {
    // PASS 1: Extract foreignObject content using regex (no DOM parsing of raw content)
    const savedForeignObjectContent = new Map();
    let markedSvg = svg;
    const foRegex = /<foreignObject([^>]*)>([\s\S]*?)<\/foreignObject>/gi;
    let match;
    let foIndex = 0;

    while ((match = foRegex.exec(svg)) !== null) {
        savedForeignObjectContent.set(foIndex, match[2]);
        markedSvg = markedSvg.replace(
            match[0],
            `<foreignObject${match[1]} data-fo-idx="${foIndex}"></foreignObject>`
        );
        foIndex++;
    }

    // Fix Mermaid bug: xlink:href without xmlns:xlink declaration
    if (markedSvg.includes('xlink:href') && !markedSvg.includes('xmlns:xlink')) {
        markedSvg = markedSvg.replace('<svg', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    // Validate SVG content
    if (!markedSvg || (!markedSvg.startsWith('<svg') && !markedSvg.startsWith('<SVG'))) {
        throw new Error('Mermaid SVG generation failed: Invalid output');
    }

    // PASS 2: Sanitize SVG structure
    let sanitizedSvgString = DOMPurify.sanitize(markedSvg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['foreignObject'],
        ADD_ATTR: [
            'xmlns', 'xmlns:xlink', 'xlink:href', 'href',
            'style', 'class', 'transform', 'x', 'y', 'width', 'height',
            'data-fo-idx',
        ],
        ADD_URI_SAFE_ATTR: ['xlink:href', 'href'],
    });

    // Ensure xmlns:xlink namespace is declared after sanitization
    if (sanitizedSvgString.includes('xlink:href') && !sanitizedSvgString.includes('xmlns:xlink')) {
        sanitizedSvgString = sanitizedSvgString.replace(
            '<svg',
            '<svg xmlns:xlink="http://www.w3.org/1999/xlink"'
        );
    }

    // Parse the sanitized SVG
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(sanitizedSvgString, 'image/svg+xml');
    const parseError = svgDoc.querySelector('parsererror');
    if (parseError) {
        throw new Error('SVG parse error: ' + parseError.textContent);
    }

    // PASS 3: Re-inject saved foreignObject content with HTML sanitization
    svgDoc.querySelectorAll('foreignObject').forEach(fo => {
        const idx = Number.parseInt(fo.dataset.foIdx, 10);
        if (savedForeignObjectContent.has(idx)) {
            const sanitizedHtml = DOMPurify.sanitize(savedForeignObjectContent.get(idx), {
                ALLOWED_TAGS: ['div', 'span', 'p', 'br', 'b', 'i', 'strong', 'em'],
                ALLOWED_ATTR: ['class', 'style', 'xmlns'],
                KEEP_CONTENT: true,
            });
            // Strip external url() to prevent data exfiltration (preserve local #refs)
            fo.innerHTML = sanitizedHtml.replaceAll(
                /url\s*\(\s*['"]?(https?:|data:|javascript:|blob:)[^)]*\)/gi,
                ''
            );
        }
        delete fo.dataset.foIdx;
    });

    return svgDoc.documentElement;
}

/**
 * Lazy render a single mermaid diagram when it becomes visible
 * Uses the improved two-pass sanitization for security
 * @param {HTMLElement} element - The mermaid diagram element to render
 * @returns {Promise<void>}
 */
async function lazyRenderMermaid(element) {
    // Skip if already rendered or currently rendering (race condition guard)
    if (element.dataset.mermaidRendered === 'true' ||
        element.dataset.mermaidRendered === 'rendering') {
        return;
    }

    // Mark as being rendered to prevent duplicate renders
    element.dataset.mermaidRendered = 'rendering';

    // Start timing after race condition check and state update (micro-optimization)
    const startTime = mermaidPerfMetrics.recordRenderStart();

    try {

        // Remove loading indicator
        element.classList.remove('mermaid-loading');

        const { svg } = await mermaid.render(element.id + '-svg', element.textContent);
        // Use two-pass sanitization for better security
        const sanitizedSvg = sanitizeMermaidSvg(svg);
        element.innerHTML = '';
        element.appendChild(element.ownerDocument.importNode(sanitizedSvg, true));

        // Mark as successfully rendered and update accessibility attributes
        element.dataset.mermaidRendered = 'true';
        element.removeAttribute('aria-busy');
        element.setAttribute('aria-label', 'Mermaid diagram');
        mermaidPerfMetrics.recordRenderComplete(startTime);
    } catch (error) {
        // Limit console noise: log first 3 errors in detail, then suppress
        // Full error count is shown in status message at the end
        if (mermaidPerfMetrics.totalErrors < 3) {
            console.error('Mermaid render error:', error);
        } else if (mermaidPerfMetrics.totalErrors === 3) {
            console.error('Mermaid render error:', error);
            console.warn('[Mermaid] Suppressing further error details. Check status bar for total count.');
        }
        mermaidPerfMetrics.recordError();
        element.classList.add('mermaid-error');
        element.classList.remove('mermaid-loading');
        // Update accessibility attributes for error state
        element.removeAttribute('aria-busy');
        element.setAttribute('aria-label', 'Diagram failed to render');
        element.innerHTML = `<details class="mermaid-error-details">
            <summary>⚠️ Mermaid diagram failed to render</summary>
            <pre class="mermaid-error-message">${escapeHtml(error.message)}</pre>
        </details>`;
        element.dataset.mermaidRendered = 'error';
    }
}

/**
 * Set up lazy loading for mermaid diagrams using IntersectionObserver
 * Diagrams are rendered when they become visible in the viewport (Issue #326)
 * @param {NodeList} mermaidElements - The mermaid diagram elements
 */
function setupMermaidLazyLoading(mermaidElements) {
    // Disconnect and nullify previous observer if exists (explicit cleanup for GC)
    if (state.mermaidObserver) {
        state.mermaidObserver.disconnect();
        state.mermaidObserver = null;
    }

    // Reset performance metrics for new render
    mermaidPerfMetrics.reset();
    mermaidPerfMetrics.updatePendingCount(mermaidElements.length);

    // Generate unique ID to track this observer instance and prevent race conditions
    // when renderMarkdown() is called rapidly in succession
    const observerGeneration = Date.now();
    state.mermaidObserverGeneration = observerGeneration;

    // Create IntersectionObserver for lazy loading diagrams
    const observer = new IntersectionObserver(
        (entries) => {
            // Early exit if observer was disconnected or superseded by newer generation
            if (!state.mermaidObserver || state.mermaidObserverGeneration !== observerGeneration) {
                return;
            }

            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const element = entry.target;

                    // Verify element belongs to this observer generation
                    if (element.dataset.observerGeneration !== String(observerGeneration)) {
                        return;
                    }

                    // Render the diagram
                    lazyRenderMermaid(element).then(() => {
                        // Check observer still valid before updating metrics
                        if (!state.mermaidObserver || state.mermaidObserverGeneration !== observerGeneration) {
                            return;
                        }

                        // Update pending count
                        const pendingCount = document.querySelectorAll('.mermaid[data-mermaid-rendered="pending"]').length;
                        mermaidPerfMetrics.updatePendingCount(pendingCount);

                        // Log summary when all diagrams are done
                        if (pendingCount === 0) {
                            mermaidPerfMetrics.logSummary();
                            showMermaidRenderStatus();
                        }
                    }).catch(err => {
                        // Defensive error handling - lazyRenderMermaid has internal error handling
                        // but this catches any unexpected errors that might slip through
                        console.error('Unexpected error during lazy render:', err);
                        showStatus('Diagram rendering failed unexpectedly', 'warning');
                    });
                    // Stop observing this element
                    observer.unobserve(element);
                }
            });
        },
        {
            rootMargin: MERMAID_PRELOAD_MARGIN,
            // Trigger when 1% visible - starts render early for smoother UX
            threshold: 0.01
        }
    );

    // Observe all mermaid diagrams
    mermaidElements.forEach(element => {
        // Add loading state with visual indicator and accessibility attributes
        element.dataset.mermaidRendered = 'pending';
        element.dataset.observerGeneration = observerGeneration;
        element.classList.add('mermaid-loading');
        element.setAttribute('aria-busy', 'true');
        element.setAttribute('aria-label', 'Diagram loading...');
        observer.observe(element);
    });

    // Store observer in state for cleanup
    state.mermaidObserver = observer;

    // Log initial state
    if (isDebugMermaidPerf()) {
        console.log(`[Mermaid Perf] Starting lazy load for ${mermaidElements.length} diagrams (gen: ${observerGeneration})`);
    }
}

/**
 * Show status message after all Mermaid diagrams have rendered
 * Displays error count if any diagrams failed
 */
function showMermaidRenderStatus() {
    const { totalErrors, totalRendered } = mermaidPerfMetrics;

    if (totalErrors > 0) {
        showStatus(
            `${totalRendered} diagram${totalRendered === 1 ? '' : 's'} rendered, ${totalErrors} failed`,
            'warning'
        );
    }
}

/**
 * Attach event listeners for Mermaid expand functionality
 * DOMPurify strips inline handlers, so we attach them programmatically
 * @param {HTMLElement} wrapper - Container element
 */
function attachMermaidEventListeners(wrapper) {
    wrapper.querySelectorAll('.mermaid-expand-btn[data-expand-target]').forEach(btn => {
        btn.addEventListener('click', () => expandMermaid(btn.dataset.expandTarget));
    });
    wrapper.querySelectorAll('.mermaid[id]').forEach(el => {
        el.addEventListener('dblclick', () => expandMermaid(el.id));
    });
}

/**
 * Attach click handlers for markdown links to enable in-app navigation (Issue #345)
 * Links marked with data-merview-link="true" open within Merview instead of navigating away.
 * This allows seamless navigation between related markdown documents.
 * @param {HTMLElement} wrapper - Container element
 */
function attachMarkdownLinkHandlers(wrapper) {
    wrapper.querySelectorAll('a[data-merview-link="true"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = link.getAttribute('href');
            if (url) {
                // Safety: Don't double-wrap URLs that already have ?url= or are same-origin
                try {
                    const urlObj = new URL(url, globalThis.location.origin);
                    if (urlObj.origin === globalThis.location.origin) {
                        // Same-origin URL - just navigate directly
                        globalThis.location.href = url;
                        return;
                    }
                } catch {
                    // Invalid URL - continue with wrapping
                }

                // Navigate within Merview by updating the URL parameter
                // This triggers a page load with the new content
                const newUrl = new URL(globalThis.location.href);
                // Intentionally replace the entire query string rather than preserving other params.
                // Rationale: The ?url= param is the primary content source. Other params like ?style=
                // are user preferences that should persist in localStorage, not the URL. Keeping the
                // URL clean also makes sharing links easier. If we need to preserve specific params
                // in the future (e.g., ?style=), we can use URLSearchParams selectively.
                newUrl.search = `?url=${encodeURIComponent(url)}`;
                globalThis.location.href = newUrl.toString();
            }
        });
    });
}

/**
 * Render markdown with mermaid diagrams
 * Main rendering function that converts markdown to HTML, applies syntax highlighting,
 * and lazily renders mermaid diagrams as they come into view (performance optimization #326).
 * @async
 */
export async function renderMarkdown() {
    try {
        const { wrapper } = getElements();
        const markdown = state.cmEditor ? state.cmEditor.getValue() : '';

        // SAVE STATE: Preserve YAML metadata panel open/closed state before re-render (#268 fix)
        const yamlPanelWasOpen = wrapper?.querySelector('.yaml-front-matter')?.open;

        // Reset mermaid counter for consistent diagram IDs
        state.mermaidCounter = 0;

        // Parse YAML front matter if present
        const { frontMatter, remainingMarkdown } = parseYAMLFrontMatter(markdown);

        // Render YAML front matter panel
        const frontMatterHTML = renderYAMLFrontMatter(frontMatter);

        // Convert markdown to HTML and sanitize to prevent XSS attacks
        // DOMPurify removes dangerous elements like <script>, event handlers, and javascript: URLs
        // Using DOMPurify defaults (intentional) - they provide comprehensive protection while
        // preserving all safe HTML elements, classes (for syntax highlighting), and IDs (for anchors)
        const markdownHTML = marked.parse(remainingMarkdown);
        const combinedHTML = frontMatterHTML + markdownHTML;
        wrapper.innerHTML = DOMPurify.sanitize(combinedHTML);

        // Set up lazy loading for mermaid diagrams (Issue #326)
        // Instead of rendering all diagrams immediately (which blocks the UI),
        // we use IntersectionObserver to render them only when they're visible
        const mermaidElements = wrapper.querySelectorAll('.mermaid');
        if (mermaidElements.length > 0) {
            setupMermaidLazyLoading(mermaidElements);
        }

        // Attach mermaid expand/fullscreen event listeners
        attachMermaidEventListeners(wrapper);

        // Attach click handlers for markdown links to enable in-app navigation (Issue #345)
        attachMarkdownLinkHandlers(wrapper);

        // Save to localStorage (legacy) and update session
        saveMarkdownContent(markdown);
        if (isSessionsInitialized()) {
            updateSessionContent(markdown);
        }

        // Trigger validation if lint panel is enabled (debounced)
        if (state.lintEnabled) {
            scheduleValidation();
        }

        // RESTORE STATE: Restore YAML metadata panel state after re-render (#268 fix)
        if (yamlPanelWasOpen !== undefined) {
            const details = wrapper?.querySelector('.yaml-front-matter');
            if (details) {
                details.open = yamlPanelWasOpen;
            }
        }
    } catch (error) {
        console.error('Critical error in renderMarkdown:', error);
        showStatus('Error rendering: ' + error.message, 'warning');
    }
}

/**
 * Debounced render function
 * Schedules a render after 300ms of inactivity to avoid excessive rendering
 * during typing. Clears any pending render before scheduling a new one.
 */
export function scheduleRender() {
    clearTimeout(state.renderTimeout);
    state.renderTimeout = setTimeout(renderMarkdown, 300);
}

/**
 * Debounced validation function
 * Schedules code validation after 500ms of inactivity to avoid excessive
 * validation during typing. Separate from render debounce for independent timing.
 */
function scheduleValidation() {
    clearTimeout(state.validationTimeout);
    state.validationTimeout = setTimeout(() => {
        validateCode();
    }, 500);
}
