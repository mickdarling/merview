/**
 * renderer.js - Markdown and Mermaid rendering module for Merview
 * Handles converting markdown to HTML with syntax highlighting and mermaid diagrams
 */

import { state } from './state.js';
import { getElements } from './dom.js';
import { saveMarkdownContent } from './storage.js';
import { escapeHtml, slugify } from './utils.js';
import { validateCode } from './validation.js';

// Debug flag for Mermaid theme investigation (#168)
// Enable via: localStorage.setItem('debug-mermaid-theme', 'true')
// Note: Checked at runtime so changes take effect immediately without page refresh
function isDebugMermaidTheme() {
    return localStorage.getItem('debug-mermaid-theme') === 'true';
}

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

    // Check if highlight.js is available
    if (typeof hljs === 'undefined') {
        console.error('highlight.js (hljs) is not loaded!');
        const escaped = escapeHtml(code);
        return `<pre><code data-language="${language || 'text'}">${escaped}</code></pre>`;
    }

    // Apply syntax highlighting for other code blocks
    try {
        if (language) {
            // Normalize language names (yaml/yml are the same)
            const normalizedLang = language.toLowerCase();
            const langMap = {
                'yml': 'yaml'
            };
            const mappedLang = langMap[normalizedLang] || normalizedLang;

            if (hljs.getLanguage(mappedLang)) {
                const highlighted = hljs.highlight(code, { language: mappedLang, ignoreIllegals: true });
                return `<pre><code class="hljs language-${mappedLang}" data-language="${mappedLang}">${highlighted.value}</code></pre>`;
            } else {
                console.warn('Language not supported by highlight.js:', language);
            }
        }
    } catch (err) {
        console.error('Highlight error for language', language, ':', err);
        // Fall through to auto-detection on error
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
};

// Apply the custom renderer to marked
marked.setOptions({ renderer });

/**
 * Render markdown with mermaid diagrams
 * Main rendering function that converts markdown to HTML, applies syntax highlighting,
 * and renders all mermaid diagrams in the content.
 * @async
 */
export async function renderMarkdown() {
    try {
        const { wrapper } = getElements();
        const markdown = state.cmEditor ? state.cmEditor.getValue() : '';

        // Reset mermaid counter for consistent diagram IDs
        state.mermaidCounter = 0;

        // Convert markdown to HTML and sanitize to prevent XSS attacks
        // DOMPurify removes dangerous elements like <script>, event handlers, and javascript: URLs
        // Using DOMPurify defaults (intentional) - they provide comprehensive protection while
        // preserving all safe HTML elements, classes (for syntax highlighting), and IDs (for anchors)
        const html = marked.parse(markdown);
        wrapper.innerHTML = DOMPurify.sanitize(html);

        // Render mermaid diagrams
        const mermaidElements = wrapper.querySelectorAll('.mermaid');

        for (const element of mermaidElements) {
            try {
                const { svg } = await mermaid.render(element.id + '-svg', element.textContent);
                element.innerHTML = svg;
            } catch (error) {
                console.error('Mermaid render error:', error);
                element.innerHTML = `<div style="color: red; padding: 10px; border: 1px solid red; border-radius: 4px;">
                    <strong>Mermaid Error:</strong><br>${escapeHtml(error.message)}
                </div>`;
            }
        }

        // Attach event listeners for mermaid expand functionality
        // (DOMPurify strips inline onclick/ondblclick handlers, so we attach programmatically)
        wrapper.querySelectorAll('.mermaid-expand-btn[data-expand-target]').forEach(btn => {
            btn.addEventListener('click', () => expandMermaid(btn.dataset.expandTarget));
        });
        wrapper.querySelectorAll('.mermaid[id]').forEach(el => {
            el.addEventListener('dblclick', () => expandMermaid(el.id));
        });

        // Save to localStorage
        saveMarkdownContent(markdown);

        // Trigger validation if lint panel is enabled (debounced)
        // This ensures the lint panel updates in real-time as content changes
        if (state.lintEnabled) {
            scheduleValidation();
        }
    } catch (error) {
        console.error('Critical error in renderMarkdown:', error);
        const { showStatus } = await import('./utils.js');
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
