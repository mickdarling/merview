/**
 * Theme Management Module
 * Handles loading and switching between preview styles, syntax highlighting themes,
 * and editor themes. Manages CSS scoping, security validation, and layout preferences.
 */

import { state } from './state.js';
import { getElements } from './dom.js';
import { syntaxThemes, syntaxThemeSRI, editorThemes, availableStyles, mermaidThemes, ALLOWED_CSS_DOMAINS } from './config.js';
import { showURLModal } from './components/url-modal.js';
// Re-export initURLModalHandlers for main.js
export { initURLModalHandlers } from './components/url-modal.js';
import { getMarkdownStyle, saveMarkdownStyle, getSyntaxTheme, saveSyntaxTheme, getEditorTheme, saveEditorTheme, saveRespectStyleLayout, getMermaidTheme, saveMermaidTheme } from './storage.js';
import { showStatus, isDarkColor } from './utils.js';
import { isAllowedCSSURL, isValidBackgroundColor, normalizeGitHubContentUrl } from './security.js';
import { updateMermaidTheme, scheduleRender } from './renderer.js';
import { updateFullscreenBackground } from './mermaid-fullscreen.js';

// Debug flag for Mermaid theme investigation (#168)
// Enable via: localStorage.setItem('debug-mermaid-theme', 'true')
// Note: Checked at runtime so changes take effect immediately without page refresh
function isDebugMermaidTheme() {
    return localStorage.getItem('debug-mermaid-theme') === 'true';
}

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
 * Extract background color from CSS text
 * @param {string} cssText - CSS text to parse
 * @returns {string|null} Background color value or null
 */
function extractBackgroundColor(cssText) {
    // Look for #wrapper background in the CSS
    const wrapperRegex = /#wrapper\s*\{[^}]*\}/;
    const wrapperMatch = wrapperRegex.exec(cssText);
    if (wrapperMatch) {
        const wrapperRule = wrapperMatch[0];
        const bgRegex = /background(?:-color)?\s*:\s*([^;}\s]+(?:\s+[^;}\s]+)*)/;
        const bgMatch = bgRegex.exec(wrapperRule);
        if (bgMatch) {
            const bgValue = bgMatch[1].trim();
            if (isValidBackgroundColor(bgValue)) {
                return bgValue;
            }
        }
    }
    return null;
}

/**
 * Extract background color from loaded CSS and apply to preview container.
 * Parses the #wrapper rule to find background or background-color values.
 * Also updates Mermaid theme based on background brightness.
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
 * @returns {string} The background color applied ('white' if none found)
 */
function applyPreviewBackground(cssText) {
    const { preview } = getElements();
    if (!preview) return 'white'; // Guard against missing element

    const bgColor = extractBackgroundColor(cssText);
    if (bgColor) {
        preview.style.background = bgColor;
        // Update Mermaid theme based on background brightness (#109 fix)
        updateMermaidTheme(isDarkColor(bgColor));
        return bgColor;
    }

    // Default to white if no valid background found
    preview.style.background = 'white';
    updateMermaidTheme(false); // White background = light theme
    return 'white';
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

    // Copy the opening brace
    const openBrace = css[i];
    i++;

    // Collect rule body until closing brace (handle nested braces for @-rules)
    const ruleBodyChars = [];
    let depth = 1;
    while (i < len && depth > 0) {
        if (css[i] === '{') {
            depth++;
        } else if (css[i] === '}') {
            depth--;
        }
        ruleBodyChars.push(css[i]);
        i++;
    }

    // Push all parts at once to avoid multiple push calls
    result.push(scopedSelectors, openBrace, ruleBodyChars.join(''));

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
 * Core CSS application logic - preloads background, swaps CSS, re-renders
 * Shared by applyStyleToPage and applyCSSDirectly to avoid duplication
 * @param {string} cssText - Processed CSS text to apply
 * @returns {Promise<void>}
 */
async function applyCSSCore(cssText) {
    // PRELOAD: Extract and apply background BEFORE removing old CSS (#110 fix)
    // This prevents the white flash by setting background early
    const bgColor = extractBackgroundColor(cssText);
    if (bgColor) {
        const { preview } = getElements();
        if (preview) {
            preview.style.background = bgColor;
            // Also update Mermaid theme early (#109 fix)
            updateMermaidTheme(isDarkColor(bgColor));
        }
    }

    // NOW remove previous style (preview already has new background color)
    if (state.currentStyleLink) {
        state.currentStyleLink.remove();
    }

    // Create style element with scoped CSS
    const styleElement = document.createElement('style');
    styleElement.id = 'marked-custom-style';
    styleElement.textContent = cssText;
    document.head.appendChild(styleElement);

    state.currentStyleLink = styleElement;

    // If background wasn't found during preload, set default (white)
    if (!bgColor) {
        const { preview } = getElements();
        if (preview) {
            preview.style.background = 'white';
            updateMermaidTheme(false); // White background = light theme
        }
    }

    // Apply minimal structure override (no color changes)
    applySyntaxOverride();

    // Re-render markdown to update Mermaid diagrams with new CSS
    scheduleRender();
}

/**
 * Apply loaded CSS to the page
 * Preloads background color before removing old CSS to prevent white flash (#110 fix)
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

    // Apply core CSS logic
    await applyCSSCore(cssText);

    // Apply layout constraints based on toggle setting
    applyLayoutConstraints();

    // Save preference
    saveMarkdownStyle(styleName);
}

/**
 * Handle special style source types (none, file, url, repository)
 * @param {object} style - Style config object
 * @returns {Promise<{handled: boolean, success: boolean}>} Result object
 */
async function handleSpecialStyleSource(style) {
    if (style.source === 'none') {
        // Remove all custom styles
        if (state.currentStyleLink) {
            state.currentStyleLink.remove();
            state.currentStyleLink = null;
        }
        // Reset Mermaid to default (light) theme
        updateMermaidTheme(false);
        showStatus('CSS removed');
        scheduleRender();
        return { handled: true, success: true };
    }
    if (style.source === 'file') {
        initFileInput();
        fileInput.click();
        // File picker is async - success determined later, but user may cancel
        return { handled: true, success: false };
    }
    if (style.source === 'url') {
        const success = await promptForURLWithResult();
        return { handled: true, success };
    }
    if (style.source === 'repository') {
        const success = await promptForRepositoryStyleWithResult(style);
        return { handled: true, success };
    }
    return { handled: false, success: false };
}

/**
 * Load a style by name
 * @param {string} styleName - Name of the style to load
 * @returns {Promise<boolean>} True if style loaded successfully, false otherwise
 */
async function loadStyle(styleName) {
    const style = availableStyles.find(s => s.name === styleName);
    if (!style || style.source === 'separator') return false;

    // Handle special actions (file picker, URL prompt, etc.)
    const specialResult = await handleSpecialStyleSource(style);
    if (specialResult.handled) {
        return specialResult.success;
    }

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
        return true;
    } catch (error) {
        showStatus(`Error loading style: ${style.name}`);
        console.error(`Failed to load style:`, error);
        return false;
    }
}

/**
 * Load CSS from uploaded file
 * @param {File} file - CSS file to load
 */
async function loadCSSFromFile(file) {
    if (!file?.name?.endsWith('.css')) {
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
 * Prompt user for URL to load CSS from using accessible modal
 * @param {string} context - Context for the modal title (e.g., "Style", "Syntax Theme")
 * @returns {Promise<boolean>} True if URL was provided and loading initiated
 */
async function promptForURLWithResult(context = 'Style') {
    const url = await showURLModal({
        title: `Load ${context} from URL`,
        placeholder: 'https://raw.githubusercontent.com/user/repo/main/style.css',
        allowedDomains: ALLOWED_CSS_DOMAINS
    });

    if (!url) {
        return false; // User cancelled
    }

    await loadCSSFromURL(url);
    return true;
}

/**
 * Prompt user for URL to load CSS from (legacy, for backwards compatibility)
 */
function promptForURL() {
    promptForURLWithResult();
}

/**
 * Load CSS from URL (with domain validation and gist URL normalization)
 * @param {string} url - URL to load CSS from
 */
async function loadCSSFromURL(url) {
    // Normalize GitHub URLs (gist.github.com and github.com/blob) to raw URLs
    const normalizedUrl = normalizeGitHubContentUrl(url);

    // Validate URL against allowlist
    if (!isAllowedCSSURL(normalizedUrl)) {
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
        const response = await fetch(normalizedUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const cssText = await response.text();
        await applyCSSDirectly(cssText, normalizedUrl);
        showStatus(`Loaded from URL`);
    } catch (error) {
        showStatus(`Error loading URL: ${error.message}`);
        console.error('URL load error:', error);
    }
}

/**
 * Prompt for repository-based style with result tracking (#108 fix)
 * @param {object} repoConfig - Repository configuration
 * @returns {Promise<boolean>} True if filename was provided
 */
async function promptForRepositoryStyleWithResult(repoConfig) {
    const fileName = prompt(`Enter CSS filename from ${repoConfig.name}:\n\n` +
        `Repository: ${repoConfig.url}\n\n` +
        `${repoConfig.note || ''}\n\n` +
        `Example: Academia.css`);

    if (!fileName) {
        return false; // User cancelled
    }

    const fullURL = repoConfig.url + encodeURIComponent(fileName);
    await loadCSSFromURL(fullURL);
    return true;
}

/**
 * Prompt for repository-based style (legacy, for backwards compatibility)
 * @param {object} repoConfig - Repository configuration
 */
async function promptForRepositoryStyle(repoConfig) {
    await promptForRepositoryStyleWithResult(repoConfig);
}

/**
 * Apply CSS directly without scope processing (for already-scoped files)
 * Preloads background color before removing old CSS to prevent white flash (#110 fix)
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

    // Apply core CSS logic (handles preload, swap, render)
    await applyCSSCore(cssText);

    // Save preference (if it's a named style)
    if (sourceName && !sourceName.startsWith('http')) {
        saveMarkdownStyle(sourceName);
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
 * Reverts dropdown selection if style loading fails or is cancelled (#108 fix)
 * @param {string} styleName - Name of the style to change to
 */
async function changeStyle(styleName) {
    if (!styleName) return;

    const { styleSelector } = getElements();

    // Handle toggle option
    if (styleName === 'Respect Style Layout') {
        state.respectStyleLayout = !state.respectStyleLayout;
        saveRespectStyleLayout(state.respectStyleLayout);
        applyLayoutConstraints();
        // Update just the checkbox without rebuilding the entire dropdown
        updateLayoutToggleCheckbox();
        // Restore previous selection
        const currentStyle = getMarkdownStyle() || 'Clean';
        if (styleSelector) {
            styleSelector.value = currentStyle;
        }
        showStatus(state.respectStyleLayout ? 'Style layout respected' : 'Style layout overridden');
        return;
    }

    // Save previous selection for revert on failure (#108 fix)
    const previousStyle = getMarkdownStyle() || 'Clean';

    // Check if this style uses file picker (async, handled by file input)
    const style = availableStyles.find(s => s.name === styleName);
    const isFilePicker = style?.source === 'file';

    // Try to load the style
    const success = await loadStyle(styleName);

    // If loading failed or was cancelled, revert dropdown to previous selection
    // EXCEPT for file picker - it handles its own success/failure through file input handler
    if (!success && !isFilePicker && styleSelector) {
        styleSelector.value = previousStyle;
    }
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

    const theme = syntaxThemes.find(t => t.name === themeName);
    const { syntaxThemeSelector } = getElements();
    const previousTheme = getSyntaxTheme() || 'GitHub Dark';

    // Handle file picker
    if (theme?.source === 'file') {
        initFileInput();
        fileInput.click();
        // Revert dropdown to previous selection
        if (syntaxThemeSelector) {
            syntaxThemeSelector.value = previousTheme;
        }
        return;
    }

    // Handle URL loading
    if (theme?.source === 'url') {
        const success = await promptForURLWithResult('Syntax Theme');
        // Revert dropdown if cancelled
        if (!success && syntaxThemeSelector) {
            syntaxThemeSelector.value = previousTheme;
        }
        return;
    }

    await loadSyntaxTheme(themeName);
    // Re-render to apply new syntax theme
    scheduleRender();
}

/**
 * Initialize syntax theme selector (for preview code blocks) with optgroups
 */
async function initSyntaxThemeSelector() {
    const { syntaxThemeSelector } = getElements();
    if (!syntaxThemeSelector) return;

    populateSelectorWithOptgroups(
        syntaxThemeSelector,
        syntaxThemes,
        ['Code Block Theme', 'Import'],
        (theme) => {
            const option = document.createElement('option');
            option.value = theme.name;
            option.textContent = theme.name;
            return option;
        }
    );

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

    const theme = editorThemes.find(t => t.name === themeName);
    const { editorThemeSelector } = getElements();
    const previousTheme = getEditorTheme() || 'Material Darker';

    // Handle file picker
    if (theme?.source === 'file') {
        initFileInput();
        fileInput.click();
        // Revert dropdown to previous selection
        if (editorThemeSelector) {
            editorThemeSelector.value = previousTheme;
        }
        return;
    }

    // Handle URL loading
    if (theme?.source === 'url') {
        const success = await promptForURLWithResult('Editor Theme');
        // Revert dropdown if cancelled
        if (!success && editorThemeSelector) {
            editorThemeSelector.value = previousTheme;
        }
        return;
    }

    await loadEditorTheme(themeName);
}

/**
 * Initialize editor theme selector with optgroups
 */
async function initEditorThemeSelector() {
    const { editorThemeSelector } = getElements();
    if (!editorThemeSelector) return;

    populateSelectorWithOptgroups(
        editorThemeSelector,
        editorThemes,
        ['Editor Theme', 'Import'],
        (theme) => {
            const option = document.createElement('option');
            option.value = theme.name;
            option.textContent = theme.name;
            return option;
        }
    );

    // Load saved theme or default
    const savedTheme = getEditorTheme();
    const defaultTheme = editorThemes.find(t => t.default)?.name || 'Material Darker';
    const themeToLoad = savedTheme || defaultTheme;

    editorThemeSelector.value = themeToLoad;
    await loadEditorTheme(themeToLoad);
}

/**
 * Load Mermaid theme
 * @param {string} themeValue - Theme value to load ('auto', 'default', 'forest', 'dark', 'neutral', 'base')
 */
async function loadMermaidTheme(themeValue) {
    const theme = mermaidThemes.find(t => t.value === themeValue);
    if (!theme) return;

    try {
        // Update state with user's selection
        state.mermaidThemeMode = themeValue;

        // If in auto mode, determine theme based on current background
        if (themeValue === 'auto') {
            const { preview } = getElements();
            if (preview) {
                const bgColor = globalThis.getComputedStyle(preview).backgroundColor;
                if (isDebugMermaidTheme()) {
                    console.log('[Mermaid Auto] Detecting background:', bgColor, 'isDark:', isDarkColor(bgColor));
                }
                updateMermaidTheme(isDarkColor(bgColor));
            }
        } else {
            // Manual theme selection: mermaidThemeMode is already set above to the user's chosen theme.
            // updateMermaidTheme() checks mermaidThemeMode first - when it's not 'auto', it uses
            // mermaidThemeMode directly as the theme name, ignoring the isDark parameter entirely.
            updateMermaidTheme(false);
        }

        // Update fullscreen overlay background if it's currently open
        updateFullscreenBackground(state.mermaidTheme);

        // Save preference
        saveMermaidTheme(themeValue);

        showStatus(`Mermaid theme: ${theme.name}`);
    } catch (error) {
        console.error('Failed to load Mermaid theme:', error);
        showStatus(`Error loading Mermaid theme: ${theme.name}`);
    }
}

/**
 * Change Mermaid theme
 * @param {string} themeValue - Theme value to change to
 */
async function changeMermaidTheme(themeValue) {
    if (!themeValue) return;

    // Find theme by value or name (for import actions)
    const theme = mermaidThemes.find(t => t.value === themeValue || t.name === themeValue);
    const { mermaidThemeSelector } = getElements();
    const previousTheme = getMermaidTheme() || 'auto';

    // Handle file picker
    if (theme?.source === 'file') {
        initFileInput();
        fileInput.click();
        // Revert dropdown to previous selection
        if (mermaidThemeSelector) {
            mermaidThemeSelector.value = previousTheme;
        }
        return;
    }

    // Handle URL loading
    if (theme?.source === 'url') {
        const success = await promptForURLWithResult('Mermaid Theme');
        // Revert dropdown if cancelled
        if (!success && mermaidThemeSelector) {
            mermaidThemeSelector.value = previousTheme;
        }
        return;
    }

    await loadMermaidTheme(themeValue);
    // Re-render to apply new Mermaid theme
    scheduleRender();
}

/**
 * Initialize Mermaid theme selector with optgroups
 */
async function initMermaidThemeSelector() {
    const { mermaidThemeSelector } = getElements();
    if (!mermaidThemeSelector) return;

    populateSelectorWithOptgroups(
        mermaidThemeSelector,
        mermaidThemes,
        ['Mermaid Theme', 'Import'],
        (theme) => {
            const option = document.createElement('option');
            // Use value for regular themes, name for import actions
            option.value = theme.value || theme.name;
            option.textContent = theme.name;
            if (theme.description) {
                option.title = theme.description;
            }
            return option;
        }
    );

    // Load saved theme or default
    const savedTheme = getMermaidTheme();
    const defaultTheme = mermaidThemes.find(t => t.default)?.value || 'auto';
    const themeToLoad = savedTheme || defaultTheme;

    mermaidThemeSelector.value = themeToLoad;
    await loadMermaidTheme(themeToLoad);
}

/**
 * Helper function to populate a selector with optgroups
 * @param {HTMLSelectElement} selector - The select element to populate
 * @param {Array} items - Array of items with group property
 * @param {Array<string>} groupOrder - Order of groups to render
 * @param {Function} createOption - Function to create option element from item
 */
function populateSelectorWithOptgroups(selector, items, groupOrder, createOption) {
    selector.innerHTML = '';

    // Group items by their group property
    const groups = {};
    items.forEach(item => {
        const groupName = item.group || 'Other';
        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(item);
    });

    // Render optgroups in specified order
    groupOrder.forEach(groupName => {
        if (groups[groupName] && groups[groupName].length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = groupName;

            groups[groupName].forEach(item => {
                const option = createOption(item);
                if (option) {
                    optgroup.appendChild(option);
                }
            });

            selector.appendChild(optgroup);
        }
    });
}

/**
 * Initialize style selector with optgroups
 */
async function initStyleSelector() {
    const { styleSelector } = getElements();
    if (!styleSelector) return;

    populateSelectorWithOptgroups(
        styleSelector,
        availableStyles,
        ['Preview Style', 'Options', 'Import'],
        (style) => {
            const option = document.createElement('option');
            option.value = style.name;
            option.textContent = style.name;

            // Handle toggle with checkmark and cache reference for performance
            if (style.source === 'toggle') {
                option.textContent = (state.respectStyleLayout ? '✓ ' : '☐ ') + style.name;
                layoutToggleOption = option;
            }

            return option;
        }
    );

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
    initMermaidThemeSelector,
    initPreviewDragDrop,
    changeStyle,
    changeSyntaxTheme,
    changeEditorTheme,
    changeMermaidTheme,
    applyLayoutConstraints,
    applyPreviewBackground
};
