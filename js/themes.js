/**
 * Theme Management Module
 * Handles loading and switching between preview styles, syntax highlighting themes,
 * and editor themes. Manages CSS scoping, security validation, and layout preferences.
 */

import { state } from './state.js';
import { getElements } from './dom.js';
import { syntaxThemes, syntaxThemeSRI, editorThemes, availableStyles } from './config.js';
import { getMarkdownStyle, saveMarkdownStyle, getSyntaxTheme, saveSyntaxTheme, getEditorTheme, saveEditorTheme, saveRespectStyleLayout } from './storage.js';
import { showStatus } from './utils.js';
import { isAllowedCSSURL, isValidBackgroundColor } from './security.js';

// Local state for theme management
let layoutToggleOption = null; // Cached reference for performance
let fileInput = null; // Hidden file input for CSS uploads

/**
 * Initialize the hidden file input for CSS file uploads
 */
function initFileInput() {
    if (fileInput) return; // Already initialized

    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.css';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // File input handler
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await loadCSSFromFile(file);
        }
        // Reset input so same file can be loaded again
        fileInput.value = '';
    });
}

/**
 * Extract background color from loaded CSS and apply to preview container.
 * Parses the #wrapper rule to find background or background-color values.
 *
 * SUPPORTED background types:
 * - Hex colors: #1e1e1e, #fff, #ffffff
 * - Named colors: white, black, darkgray, transparent
 * - RGB/RGBA values: rgb(30, 30, 30), rgba(0, 0, 0, 0.9)
 * - HSL/HSLA values: hsl(0, 0%, 12%), hsla(0, 0%, 12%, 0.95)
 *
 * NOT SUPPORTED (will fall back to white):
 * - CSS variables: var(--bg-color), var(--theme-background)
 * - Gradients: linear-gradient(...), radial-gradient(...)
 * - Complex multi-value backgrounds: url(...) #fff, image-set(...)
 *
 * This limitation is due to regex-based CSS parsing. For dark themes,
 * always use simple color values on #wrapper background property.
 *
 * @param {string} cssText - The loaded CSS text to parse
 */
function applyPreviewBackground(cssText) {
    const { preview } = getElements();
    if (!preview) return; // Guard against missing element

    // Look for #wrapper background in the CSS
    // Match patterns like: #wrapper { ... background: #1e1e1e; ... }
    // or: #wrapper { ... background-color: #1e1e1e; ... }
    const wrapperMatch = cssText.match(/#wrapper\s*\{[^}]*\}/);
    if (wrapperMatch) {
        const wrapperRule = wrapperMatch[0];
        // Extract background or background-color value
        const bgMatch = wrapperRule.match(/background(?:-color)?\s*:\s*([^;}\s]+(?:\s+[^;}\s]+)*)/);
        if (bgMatch) {
            const bgValue = bgMatch[1].trim();
            // Validate the color value for security before applying
            if (isValidBackgroundColor(bgValue)) {
                preview.style.background = bgValue;
                return;
            }
        }
    }
    // Default to white if no valid background found
    preview.style.background = 'white';
}

/**
 * Apply or remove layout constraint overrides based on the "Respect Style Layout" toggle.
 * When OFF (default): Forces full-width layout, user controls width via drag handle.
 * When ON: Allows loaded styles to apply their own max-width, margins, and gutters.
 */
function applyLayoutConstraints() {
    const { wrapper } = getElements();
    if (!wrapper) return; // Guard against missing element

    if (state.respectStyleLayout) {
        // Remove overrides - let loaded style control layout
        wrapper.style.maxWidth = '';
        wrapper.style.margin = '';
        wrapper.style.width = '';
    } else {
        // Apply overrides - user controls width via drag handle
        wrapper.style.maxWidth = 'none';
        wrapper.style.margin = '0';
        wrapper.style.width = 'auto';
    }
}

// Helper: Check if current position starts a print media query
function isPrintMediaStart(css, i) {
    const startsWithPrint = css.substring(i, i + 12) === '@media print';
    const startsWithScreen = css.substring(i, i + 13) === '@media screen';
    // Handle indexOf returning -1 (not found) by treating as "no print before brace"
    const printIndex = css.indexOf('print', i);
    const braceIndex = css.indexOf('{', i);
    const hasPrintBeforeBrace = printIndex !== -1 && braceIndex !== -1 && printIndex < braceIndex;
    return startsWithPrint || (startsWithScreen && hasPrintBeforeBrace);
}

// Helper: Skip to the opening brace of a media query
function skipToOpeningBrace(css, startIndex) {
    let i = startIndex;
    while (i < css.length && css[i] !== '{') {
        i++;
    }
    return i;
}

// Helper: Process a character when inside a print media block
function processInsidePrintMedia(css, i, depth) {
    if (css[i] === '{') {
        return { newDepth: depth + 1, stillInPrintMedia: true };
    }
    if (css[i] === '}') {
        const newDepth = depth - 1;
        return { newDepth, stillInPrintMedia: newDepth > 0 };
    }
    return { newDepth: depth, stillInPrintMedia: true };
}

/**
 * Strip @media print blocks from CSS to preserve screen colors in PDF
 * @param {string} css - CSS text to process
 * @returns {string} CSS with print media queries removed
 */
function stripPrintMediaQueries(css) {
    let depth = 0;
    let inPrintMedia = false;
    let result = '';
    let i = 0;

    while (i < css.length) {
        if (!inPrintMedia && isPrintMediaStart(css, i)) {
            const restOfLine = css.substring(i, css.indexOf('{', i) + 1);
            if (restOfLine.includes('print')) {
                inPrintMedia = true;
                depth = 0;
                i = skipToOpeningBrace(css, i);
                continue;
            }
        }

        if (inPrintMedia) {
            const { newDepth, stillInPrintMedia } = processInsidePrintMedia(css, i, depth);
            depth = newDepth;
            inPrintMedia = stillInPrintMedia;
            i++;
        } else {
            result += css[i];
            i++;
        }
    }

    return result;
}

/**
 * Scope a single CSS selector by adding #wrapper prefix
 * @param {string} selector - Single CSS selector to scope
 * @returns {string} Scoped selector
 */
function scopeSelector(selector) {
    const trimmed = selector.trim();
    // Skip empty, @-rules, comments, or already scoped
    if (!trimmed ||
        trimmed.startsWith('@') ||
        trimmed.startsWith('/*') ||
        trimmed.includes('#wrapper') ||
        trimmed.includes('#preview')) {
        return trimmed;
    }
    // Replace body/html with #wrapper
    if (trimmed === 'body' || trimmed === 'html') {
        return '#wrapper';
    }
    // Prefix with #wrapper
    return '#wrapper ' + trimmed;
}

/**
 * Skip whitespace characters and add them to result
 * @param {string} css - CSS text
 * @param {number} i - Current index
 * @param {Array<string>} result - Result array to append to
 * @returns {number} New index after skipping whitespace
 */
function skipWhitespace(css, i, result) {
    const len = css.length;
    while (i < len && /\s/.test(css[i])) {
        result.push(css[i]);
        i++;
    }
    return i;
}

/**
 * Parse an @-rule and add it to result unchanged
 * @param {string} css - CSS text
 * @param {number} i - Current index (pointing at '@')
 * @param {Array<string>} result - Result array to append to
 * @returns {number} New index after parsing @-rule
 */
function parseAtRule(css, i, result) {
    const atStart = i;
    const len = css.length;

    // Find the opening brace or semicolon
    while (i < len && css[i] !== '{' && css[i] !== ';') {
        i++;
    }

    if (i < len && css[i] === '{') {
        // Find matching closing brace (handle nested braces)
        let depth = 1;
        i++;
        while (i < len && depth > 0) {
            if (css[i] === '{') {
                depth++;
            } else if (css[i] === '}') {
                depth--;
            }
            i++;
        }
    } else if (i < len) {
        i++; // Skip the semicolon
    }

    result.push(css.substring(atStart, i));
    return i;
}

/**
 * Parse a CSS comment and add it to result
 * @param {string} css - CSS text
 * @param {number} i - Current index (pointing at '/')
 * @param {Array<string>} result - Result array to append to
 * @returns {number} New index after parsing comment
 */
function parseComment(css, i, result) {
    const commentStart = i;
    const len = css.length;
    i += 2; // Skip /*

    while (i < len - 1 && !(css[i] === '*' && css[i + 1] === '/')) {
        i++;
    }
    i += 2; // Skip closing */

    result.push(css.substring(commentStart, i));
    return i;
}

/**
 * Parse selector and rule block, scoping the selectors
 * @param {string} css - CSS text
 * @param {number} i - Current index (pointing at start of selector)
 * @param {Array<string>} result - Result array to append to
 * @returns {number} New index after parsing selector and block
 */
function parseSelectorAndBlock(css, i, result) {
    const selectorStart = i;
    const len = css.length;

    // Read selector(s) until opening brace
    while (i < len && css[i] !== '{') {
        i++;
    }

    if (i >= len) {
        result.push(css.substring(selectorStart));
        return i;
    }

    // Extract and scope selectors
    const selectorText = css.substring(selectorStart, i);
    const selectors = selectorText.split(',');
    const scopedSelectors = selectors.map(scopeSelector).join(', ');
    result.push(scopedSelectors);

    // Copy the opening brace
    result.push(css[i]);
    i++;

    // Copy rule body until closing brace (handle nested braces for @-rules)
    let depth = 1;
    while (i < len && depth > 0) {
        if (css[i] === '{') {
            depth++;
        } else if (css[i] === '}') {
            depth--;
        }
        result.push(css[i]);
        i++;
    }

    return i;
}

/**
 * Scope CSS to only affect #wrapper using a character-by-character parser
 * This avoids regex backtracking vulnerabilities (DoS prevention)
 * @param {string} css - CSS text to scope
 * @returns {string} Scoped CSS
 */
function scopeCSSToPreview(css) {
    const result = [];
    let i = 0;
    const len = css.length;

    while (i < len) {
        // Skip whitespace
        i = skipWhitespace(css, i, result);
        if (i >= len) break;

        // Check for @-rule (pass through unchanged until matching brace)
        if (css[i] === '@') {
            i = parseAtRule(css, i, result);
            continue;
        }

        // Check for comment
        if (css[i] === '/' && css[i + 1] === '*') {
            i = parseComment(css, i, result);
            continue;
        }

        // Parse selector and rule block
        i = parseSelectorAndBlock(css, i, result);
    }

    return result.join('');
}

/**
 * Apply minimal syntax override - just set structure, let .hljs handle colors naturally
 */
function applySyntaxOverride() {
    let syntaxOverride = document.getElementById('syntax-override');
    if (!syntaxOverride) {
        syntaxOverride = document.createElement('style');
        syntaxOverride.id = 'syntax-override';
        document.head.appendChild(syntaxOverride);
    }

    // Minimal override - just structure, NO color overrides
    syntaxOverride.textContent = `
        /* Let syntax theme .hljs rule handle ALL colors naturally */
        #wrapper pre {
            padding: 0;
            margin: 1em 0;
        }

        #wrapper pre code.hljs {
            display: block;
            padding: 1em;
            overflow-x: auto;
            border-radius: 4px;
        }
    `;
}

/**
 * Apply loaded CSS to the page
 * @param {string} cssText - CSS text to apply
 * @param {string} styleName - Name of the style for saving preference
 * @param {object} style - Style config object
 */
async function applyStyleToPage(cssText, styleName, style) {
    // Remove @media print blocks that might override colors for printing
    cssText = stripPrintMediaQueries(cssText);

    // Scope the CSS to only affect #wrapper (the content area)
    if (style.source !== 'local' && !cssText.includes('#wrapper')) {
        cssText = scopeCSSToPreview(cssText);
    }

    // Remove previous style if exists
    if (state.currentStyleLink) {
        state.currentStyleLink.remove();
    }

    // Create style element with scoped CSS
    const styleElement = document.createElement('style');
    styleElement.id = 'marked-custom-style';
    styleElement.textContent = cssText;
    document.head.appendChild(styleElement);

    state.currentStyleLink = styleElement;

    // Extract and apply background color from style to preview container
    applyPreviewBackground(cssText);

    // Apply layout constraints based on toggle setting
    applyLayoutConstraints();

    // Apply minimal structure override (no color changes)
    applySyntaxOverride();

    // Save preference
    saveMarkdownStyle(styleName);

    // Re-render markdown to update Mermaid diagrams with new CSS
    if (state.renderMarkdown) {
        await state.renderMarkdown();
    }
}

/**
 * Handle special style source types (none, file, url, repository)
 * @param {object} style - Style config object
 * @returns {Promise<boolean>} True if handled, false otherwise
 */
async function handleSpecialStyleSource(style) {
    if (style.source === 'none') {
        // Remove all custom styles
        if (state.currentStyleLink) {
            state.currentStyleLink.remove();
            state.currentStyleLink = null;
        }
        showStatus('CSS removed');
        if (state.renderMarkdown) {
            await state.renderMarkdown();
        }
        return true;
    }
    if (style.source === 'file') {
        initFileInput();
        fileInput.click();
        return true;
    }
    if (style.source === 'url') {
        promptForURL();
        return true;
    }
    if (style.source === 'repository') {
        promptForRepositoryStyle(style);
        return true;
    }
    return false;
}

/**
 * Load a style by name
 * @param {string} styleName - Name of the style to load
 */
async function loadStyle(styleName) {
    const style = availableStyles.find(s => s.name === styleName);
    if (!style || style.source === 'separator') return;

    // Handle special actions (file picker, URL prompt, etc.)
    if (await handleSpecialStyleSource(style)) return;

    showStatus(`Loading style: ${style.name}...`);

    try {
        // Load from local styles/ directory or external URL
        const response = await fetch(style.file);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const cssText = await response.text();

        await applyStyleToPage(cssText, styleName, style);
        showStatus(`Style loaded: ${style.name}`);
    } catch (error) {
        showStatus(`Error loading style: ${style.name}`);
        console.error(`Failed to load style:`, error);
    }
}

/**
 * Load CSS from uploaded file
 * @param {File} file - CSS file to load
 */
async function loadCSSFromFile(file) {
    if (!file || !file.name.endsWith('.css')) {
        showStatus('Please select a valid CSS file');
        return;
    }

    try {
        showStatus(`Loading: ${file.name}...`);
        const cssText = await file.text();
        await applyCSSDirectly(cssText, file.name);
        showStatus(`Loaded: ${file.name}`);
    } catch (error) {
        showStatus(`Error loading file: ${error.message}`);
        console.error('File load error:', error);
    }
}

/**
 * Prompt user for URL to load CSS from
 */
function promptForURL() {
    const url = prompt('Enter CSS file URL:\n\n' +
        'Allowed domains (for security):\n' +
        '• raw.githubusercontent.com\n' +
        '• cdn.jsdelivr.net\n' +
        '• cdnjs.cloudflare.com\n' +
        '• gist.githubusercontent.com\n' +
        '• unpkg.com\n\n' +
        'Example:\nhttps://raw.githubusercontent.com/user/repo/main/style.css');

    if (url) {
        loadCSSFromURL(url);
    }
}

/**
 * Load CSS from URL (with domain validation)
 * @param {string} url - URL to load CSS from
 */
async function loadCSSFromURL(url) {
    // Validate URL against allowlist
    if (!isAllowedCSSURL(url)) {
        const ALLOWED_CSS_DOMAINS = [
            'cdn.jsdelivr.net',
            'cdnjs.cloudflare.com',
            'raw.githubusercontent.com',
            'gist.githubusercontent.com',
            'unpkg.com'
        ];
        showStatus(`URL not allowed. Trusted: ${ALLOWED_CSS_DOMAINS.join(', ')}`);
        return;
    }

    try {
        showStatus(`Loading from URL...`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const cssText = await response.text();
        await applyCSSDirectly(cssText, url);
        showStatus(`Loaded from URL`);
    } catch (error) {
        showStatus(`Error loading URL: ${error.message}`);
        console.error('URL load error:', error);
    }
}

/**
 * Prompt for repository-based style (like MarkedCustomStyles)
 * @param {object} repoConfig - Repository configuration
 */
async function promptForRepositoryStyle(repoConfig) {
    const fileName = prompt(`Enter CSS filename from ${repoConfig.name}:\n\n` +
        `Repository: ${repoConfig.url}\n\n` +
        `${repoConfig.note || ''}\n\n` +
        `Example: Academia.css`);

    if (fileName) {
        const fullURL = repoConfig.url + encodeURIComponent(fileName);
        await loadCSSFromURL(fullURL);
    }
}

/**
 * Apply CSS directly without scope processing (for already-scoped files)
 * @param {string} cssText - CSS text to apply
 * @param {string} sourceName - Source name for saving preference
 */
async function applyCSSDirectly(cssText, sourceName) {
    // Strip print media queries
    cssText = stripPrintMediaQueries(cssText);

    // Only scope if it doesn't appear to be pre-scoped
    if (!cssText.includes('#wrapper')) {
        cssText = scopeCSSToPreview(cssText);
    }

    // Remove previous style
    if (state.currentStyleLink) {
        state.currentStyleLink.remove();
    }

    // Create style element
    const styleElement = document.createElement('style');
    styleElement.id = 'marked-custom-style';
    styleElement.textContent = cssText;
    document.head.appendChild(styleElement);

    state.currentStyleLink = styleElement;

    // Apply minimal structure override
    applySyntaxOverride();

    // Save preference (if it's a named style)
    if (sourceName && !sourceName.startsWith('http')) {
        saveMarkdownStyle(sourceName);
    }

    // Re-render to apply styles
    if (state.renderMarkdown) {
        await state.renderMarkdown();
    }
}

/**
 * Update just the checkbox state for the layout toggle option (uses cached reference)
 */
function updateLayoutToggleCheckbox() {
    if (layoutToggleOption) {
        layoutToggleOption.textContent = (state.respectStyleLayout ? '✓ ' : '☐ ') + 'Respect Style Layout';
    }
}

/**
 * Change the current style
 * @param {string} styleName - Name of the style to change to
 */
async function changeStyle(styleName) {
    if (!styleName) return;

    // Handle toggle option
    if (styleName === 'Respect Style Layout') {
        state.respectStyleLayout = !state.respectStyleLayout;
        saveRespectStyleLayout(state.respectStyleLayout);
        applyLayoutConstraints();
        // Update just the checkbox without rebuilding the entire dropdown
        updateLayoutToggleCheckbox();
        // Restore previous selection
        const { styleSelector } = getElements();
        const currentStyle = getMarkdownStyle() || 'Clean';
        if (styleSelector) {
            styleSelector.value = currentStyle;
        }
        showStatus(state.respectStyleLayout ? 'Style layout respected' : 'Style layout overridden');
        return;
    }

    await loadStyle(styleName);
}

/**
 * Load syntax highlighting theme
 * @param {string} themeName - Name of the theme to load
 */
async function loadSyntaxTheme(themeName) {
    const theme = syntaxThemes.find(t => t.name === themeName);
    if (!theme) return;

    // Verify theme has SRI hash for security
    const sriHash = syntaxThemeSRI[theme.file];
    if (!sriHash) {
        console.error(`No SRI hash for theme: ${theme.file}`);
        return;
    }

    try {
        // Remove previous theme
        if (state.currentSyntaxThemeLink) {
            state.currentSyntaxThemeLink.remove();
        }

        // Load new theme with SRI verification
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${theme.file}.min.css`;
        link.integrity = sriHash;
        link.crossOrigin = 'anonymous';
        link.id = 'syntax-theme';

        // Wait for CSS to load before continuing
        await new Promise((resolve, reject) => {
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });

        state.currentSyntaxThemeLink = link;

        // CRITICAL: Wait a bit for browser to parse the stylesheet
        // The onload event fires when downloaded, but CSSOM might not be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Save preference
        saveSyntaxTheme(themeName);

        showStatus(`Syntax theme: ${theme.name}`);
    } catch (error) {
        console.error('Failed to load syntax theme:', error);
        showStatus(`Error loading syntax theme: ${theme.name}`);
    }
}

/**
 * Change syntax theme
 * @param {string} themeName - Name of the theme to change to
 */
async function changeSyntaxTheme(themeName) {
    if (!themeName) return;
    await loadSyntaxTheme(themeName);
    // Re-render to apply new syntax theme
    if (state.renderMarkdown) {
        await state.renderMarkdown();
    }
}

/**
 * Initialize syntax theme selector (for preview code blocks)
 */
async function initSyntaxThemeSelector() {
    const { syntaxThemeSelector } = getElements();
    if (!syntaxThemeSelector) return;

    syntaxThemeSelector.innerHTML = '';

    syntaxThemes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.name;
        option.textContent = theme.name;
        syntaxThemeSelector.appendChild(option);
    });

    // Load saved theme or default
    const savedTheme = getSyntaxTheme();
    const defaultTheme = syntaxThemes.find(t => t.default)?.name || 'GitHub Dark';
    const themeToLoad = savedTheme || defaultTheme;

    syntaxThemeSelector.value = themeToLoad;
    await loadSyntaxTheme(themeToLoad);
}

/**
 * Load editor theme (CodeMirror) from local CSS files
 * @param {string} themeName - Name of the theme to load
 */
async function loadEditorTheme(themeName) {
    const theme = editorThemes.find(t => t.name === themeName);
    if (!theme) return;

    try {
        // Remove previous editor theme
        if (state.currentEditorThemeLink) {
            state.currentEditorThemeLink.remove();
        }

        // Load new theme from local styles/editor/ directory
        const response = await fetch(`styles/editor/${theme.file}.css`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const cssText = await response.text();

        // Create style element
        const styleElement = document.createElement('style');
        styleElement.id = 'editor-theme';
        styleElement.textContent = cssText;
        document.head.appendChild(styleElement);

        state.currentEditorThemeLink = styleElement;

        // Save preference
        saveEditorTheme(themeName);

        showStatus(`Editor theme: ${theme.name}`);
    } catch (error) {
        console.error('Failed to load editor theme:', error);
        showStatus(`Error loading editor theme: ${theme.name}`);
    }
}

/**
 * Change editor theme
 * @param {string} themeName - Name of the theme to change to
 */
async function changeEditorTheme(themeName) {
    if (!themeName) return;
    await loadEditorTheme(themeName);
}

/**
 * Initialize editor theme selector
 */
async function initEditorThemeSelector() {
    const { editorThemeSelector } = getElements();
    if (!editorThemeSelector) return;

    editorThemeSelector.innerHTML = '';

    editorThemes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.name;
        option.textContent = theme.name;
        editorThemeSelector.appendChild(option);
    });

    // Load saved theme or default
    const savedTheme = getEditorTheme();
    const defaultTheme = editorThemes.find(t => t.default)?.name || 'Material Darker';
    const themeToLoad = savedTheme || defaultTheme;

    editorThemeSelector.value = themeToLoad;
    await loadEditorTheme(themeToLoad);
}

/**
 * Initialize style selector
 */
async function initStyleSelector() {
    const { styleSelector } = getElements();
    if (!styleSelector) return;

    styleSelector.innerHTML = '';

    availableStyles.forEach(style => {
        const option = document.createElement('option');
        option.value = style.name;
        option.textContent = style.name;

        // Handle separators
        if (style.source === 'separator') {
            option.disabled = true;
            option.textContent = '──────────────────';
        }

        // Handle toggle with checkmark and cache reference for performance
        if (style.source === 'toggle') {
            option.textContent = (state.respectStyleLayout ? '✓ ' : '☐ ') + style.name;
            layoutToggleOption = option;
        }

        styleSelector.appendChild(option);
    });

    // Load saved style or default
    const savedStyle = getMarkdownStyle();
    const defaultStyle = availableStyles.find(s => s.default)?.name || 'Clean';
    const styleToLoad = savedStyle || defaultStyle;

    styleSelector.value = styleToLoad;
    await loadStyle(styleToLoad);
}

/**
 * Initialize drag-and-drop functionality for the preview panel
 * Allows users to drag CSS files onto the preview to load custom styles
 */
function initPreviewDragDrop() {
    const { preview } = getElements();
    if (!preview) return;

    // Handle dragover event - show visual feedback for CSS files
    preview.addEventListener('dragover', (e) => {
        e.preventDefault();
        // Check if dragged item is a file
        if (e.dataTransfer.types.includes('Files')) {
            preview.style.outline = '3px dashed #3498db';
        }
    });

    // Handle dragleave event - remove visual feedback
    preview.addEventListener('dragleave', (e) => {
        e.preventDefault();
        preview.style.outline = '';
    });

    // Handle drop event - load CSS file if valid
    preview.addEventListener('drop', async (e) => {
        e.preventDefault();
        preview.style.outline = '';

        const files = e.dataTransfer.files;
        if (files.length === 0) return;

        const file = files[0];

        // Check if file is a CSS file
        if (!file.name.endsWith('.css')) {
            showStatus('Please drop a CSS file to change styles');
            return;
        }

        // Load the CSS file
        await loadCSSFromFile(file);
    });
}

// Export public API
export {
    initStyleSelector,
    initSyntaxThemeSelector,
    initEditorThemeSelector,
    initPreviewDragDrop,
    changeStyle,
    changeSyntaxTheme,
    changeEditorTheme,
    applyLayoutConstraints,
    applyPreviewBackground
};
