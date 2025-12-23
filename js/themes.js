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
import { getMarkdownStyle, saveMarkdownStyle, getSyntaxTheme, saveSyntaxTheme, getEditorTheme, saveEditorTheme, saveRespectStyleLayout, saveHRAsPageBreak, getMermaidTheme, saveMermaidTheme, getCachedBackgroundColor, saveCachedBackgroundColor } from './storage.js';
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

/**
 * Apply cached background color early to prevent Mermaid theme flash on back navigation
 * Called during app initialization BEFORE any style loading occurs (fixes #175)
 * This ensures the Mermaid theme is correct even if the style CSS hasn't loaded yet
 */
export function applyCachedBackground() {
    const cachedBgColor = getCachedBackgroundColor();
    if (cachedBgColor) {
        const { preview } = getElements();
        if (preview) {
            preview.style.background = cachedBgColor;
            // Update Mermaid theme based on cached background
            updateMermaidTheme(isDarkColor(cachedBgColor));
        }
    }
}

// Local state for theme management (module-local)
// Note: These are intentionally NOT in state.js because:
// - They're only used within this module for UI caching and file uploads
// - No other modules need to read or write these values
// - Keeping them local reduces coupling and makes the code easier to reason about
let layoutToggleOption = null; // Cached reference for performance
let hrPageBreakToggleOption = null; // Cached reference for performance
let fileInput = null; // Hidden file input for CSS uploads

// Track dynamically loaded styles (file uploads, URLs) for display in dropdown
const loadedStyles = [];

// SessionStorage keys for persisting loaded styles across page navigation (#390)
// Version prefix allows clean migration if data structure changes in future
const LOADED_STYLES_KEY = 'merview-v1-loaded-styles';

// Store the current scoped CSS (before layout stripping) for toggle reapplication
let currentScopedCSS = null;

/**
 * Save loaded styles to sessionStorage for persistence across page navigation
 * Stores the entire loadedStyles array as JSON (Issue #390 fix)
 */
function saveLoadedStylesToSession() {
    try {
        if (loadedStyles.length === 0) {
            // Clear sessionStorage if no loaded styles
            sessionStorage.removeItem(LOADED_STYLES_KEY);
            return;
        }
        sessionStorage.setItem(LOADED_STYLES_KEY, JSON.stringify(loadedStyles));
    } catch (error) {
        // SessionStorage can throw if quota exceeded or disabled
        console.warn('Failed to save loaded styles to sessionStorage:', error);
    }
}

/**
 * Restore loaded styles from sessionStorage on page initialization
 * Populates loadedStyles array and adds to dropdown (Issue #390 fix)
 */
function restoreLoadedStylesFromSession() {
    try {
        const saved = sessionStorage.getItem(LOADED_STYLES_KEY);
        if (!saved) return;

        const restoredStyles = JSON.parse(saved);
        if (!Array.isArray(restoredStyles)) return;

        // Validate and restore each style
        restoredStyles.forEach(style => {
            if (style?.name && style?.css && style?.source) {
                loadedStyles.push(style);
            }
        });
    } catch (error) {
        // JSON parse can fail on corrupted data
        console.warn('Failed to restore loaded styles from sessionStorage:', error);
        // Clear corrupted data
        sessionStorage.removeItem(LOADED_STYLES_KEY);
    }
}

// Theme loading constants
const SYNTAX_THEME_LOADING_ID = 'syntax-theme-loading';
const SYNTAX_THEME_ID = 'syntax-theme';
const EDITOR_THEME_LOADING_ID = 'editor-theme-loading';
const EDITOR_THEME_ID = 'editor-theme';

/**
 * Stylesheet parse delay for syntax themes (CDN-loaded)
 * CDN resources need more time because:
 * - External network latency
 * - Browser security checks for SRI
 * - Cross-origin resource processing
 * The onload event fires when downloaded, but CSSOM might not be ready yet
 */
const SYNTAX_THEME_PARSE_DELAY = 100;

/**
 * Stylesheet parse delay for editor themes (local CSS)
 * Local resources are faster because:
 * - No network latency
 * - Same-origin (no CORS checks)
 * - Smaller file sizes (custom themes vs full highlight.js themes)
 */
const EDITOR_THEME_PARSE_DELAY = 50;

// Race condition protection: track if theme loads are in progress
let syntaxThemeLoading = false;
let editorThemeLoading = false;

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
        // Cache background color to prevent theme flash on back navigation (#175 fix)
        saveCachedBackgroundColor(bgColor);
        return bgColor;
    }

    // Default to white if no valid background found
    preview.style.background = 'white';
    updateMermaidTheme(false); // White background = light theme
    saveCachedBackgroundColor('white');
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

/**
 * Layout properties that should be stripped from #wrapper rules when
 * "Respect Style Layout" is OFF. These properties conflict with user
 * control of the preview pane width via the drag handle.
 */
const LAYOUT_PROPERTIES = new Set([
    'max-width',
    'min-width',
    'width',
    'margin',
    'margin-left',
    'margin-right',
    'margin-top',
    'margin-bottom',
    'padding',
    'padding-left',
    'padding-right',
    'padding-top',
    'padding-bottom'
]);

/**
 * Check if a declaration is a layout property that should be stripped
 * @param {string} declaration - CSS declaration to check
 * @returns {boolean} True if the declaration should be kept
 */
function shouldKeepDeclaration(declaration) {
    const trimmed = declaration.trim();
    if (!trimmed) return false;
    const propRegex = /^([a-z-]+)\s*:/i;
    const propMatch = propRegex.exec(trimmed);
    if (!propMatch) return true;
    const prop = propMatch[1].toLowerCase();
    return !LAYOUT_PROPERTIES.has(prop);
}

/**
 * Filter layout properties from a CSS rule body
 * @param {string} ruleBody - CSS rule body (declarations)
 * @returns {string} Filtered rule body
 */
function filterLayoutProperties(ruleBody) {
    return ruleBody
        .split(';')
        .filter(shouldKeepDeclaration)
        .join(';');
}

/**
 * Check if selector targets #wrapper directly
 * @param {string} selectorText - CSS selector text
 * @returns {boolean} True if selector targets #wrapper directly
 */
function isDirectWrapperSelector(selectorText) {
    const trimmed = selectorText.trim();
    if (trimmed === '#wrapper') return true;
    return /(?:^|,\s*)#wrapper\s*(?:,|$)/.test(selectorText);
}

/**
 * Find matching closing brace and return position after it
 * @param {string} css - CSS text
 * @param {number} start - Position after opening brace
 * @param {number} len - Length of CSS
 * @returns {{end: number, contentEnd: number}} Position after closing brace and content end
 */
function findMatchingBrace(css, start, len) {
    let depth = 1;
    let i = start;
    while (i < len && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') depth--;
        i++;
    }
    return { end: i, contentEnd: i - 1 };
}

/**
 * Check if @-rule is a grouping rule that needs recursive processing
 * @param {string} atRuleName - Name of the @-rule
 * @returns {boolean} True if grouping rule
 */
function isGroupingAtRuleForStrip(atRuleName) {
    return ['media', 'supports', 'document', 'layer'].includes(atRuleName.toLowerCase());
}

/**
 * Strip layout-related properties from CSS rules targeting #wrapper.
 * Called when "Respect Style Layout" is OFF to allow user width control.
 *
 * This handles external CSS with !important rules like:
 *   #wrapper { max-width: 700px !important; }
 *
 * @param {string} css - CSS text to process
 * @param {number} depth - Recursion depth (default 0)
 * @returns {string} CSS with layout properties removed from #wrapper rules
 */
function stripWrapperLayoutProperties(css, depth = 0) {
    // Prevent infinite recursion on malformed or deeply nested CSS
    if (depth > MAX_CSS_RECURSION_DEPTH) {
        console.warn('CSS layout stripping: max recursion depth exceeded, returning unprocessed');
        return css;
    }

    const result = [];
    let i = 0;
    const len = css.length;

    while (i < len) {
        // Skip and preserve whitespace
        const wsStart = i;
        while (i < len && /\s/.test(css[i])) i++;
        if (i > wsStart) result.push(css.substring(wsStart, i));
        if (i >= len) break;

        // Handle comments
        if (css[i] === '/' && css[i + 1] === '*') {
            i = parseCommentForStrip(css, i, len, result);
            continue;
        }

        // Handle @-rules
        if (css[i] === '@') {
            i = parseAtRuleForStrip(css, i, len, result, depth);
            continue;
        }

        // Handle regular rules
        i = parseRuleForStrip(css, i, len, result);
    }

    return result.join('');
}

/**
 * Parse a CSS comment for stripWrapperLayoutProperties
 */
function parseCommentForStrip(css, i, len, result) {
    const commentStart = i;
    i += 2;
    while (i < len - 1 && !(css[i] === '*' && css[i + 1] === '/')) i++;
    i += 2;
    result.push(css.substring(commentStart, i));
    return i;
}

/**
 * Parse an @-rule for stripWrapperLayoutProperties
 */
function parseAtRuleForStrip(css, i, len, result, depth) {
    const atStart = i;
    i++; // Skip '@'

    // Get @-rule name
    let nameEnd = i;
    while (nameEnd < len && /[a-zA-Z-]/.test(css[nameEnd])) nameEnd++;
    const atRuleName = css.substring(i, nameEnd);
    i = nameEnd;

    // Find opening brace or semicolon
    while (i < len && css[i] !== '{' && css[i] !== ';') i++;

    if (i >= len || css[i] === ';') {
        if (i < len) i++;
        result.push(css.substring(atStart, i));
        return i;
    }

    // Has opening brace
    const bracePos = i;
    i++;
    const { end, contentEnd } = findMatchingBrace(css, i, len);
    i = end;

    if (isGroupingAtRuleForStrip(atRuleName)) {
        const prelude = css.substring(atStart, bracePos + 1);
        const innerContent = css.substring(bracePos + 1, contentEnd);
        const processedInner = stripWrapperLayoutProperties(innerContent, depth + 1);
        result.push(prelude, processedInner, '}');
    } else {
        result.push(css.substring(atStart, i));
    }

    return i;
}

/**
 * Parse a regular CSS rule for stripWrapperLayoutProperties
 */
function parseRuleForStrip(css, i, len, result) {
    const selectorStart = i;
    while (i < len && css[i] !== '{') i++;
    if (i >= len) {
        result.push(css.substring(selectorStart));
        return len;
    }

    const selectorText = css.substring(selectorStart, i).trim();
    const openBrace = css[i];
    i++;

    const { end, contentEnd } = findMatchingBrace(css, i, len);
    const ruleBody = css.substring(i, contentEnd);
    i = end;

    if (isDirectWrapperSelector(selectorText)) {
        const filteredBody = filterLayoutProperties(ruleBody);
        if (filteredBody.trim()) {
            result.push(selectorText, openBrace, filteredBody, '}');
        }
    } else {
        result.push(selectorText, openBrace, ruleBody, '}');
    }

    return i;
}

/**
 * Check if a selector is already scoped to #wrapper or #preview
 * Uses word boundary matching to avoid false positives like #wrapper-other
 * @param {string} selector - CSS selector to check
 * @returns {boolean} True if already scoped
 */
function isSelectorScoped(selector) {
    // Match #wrapper or #preview as complete selectors (with word boundaries)
    // This prevents false matches like #wrapper-container or #preview-panel
    return /(?:^|[\s,>+~])#wrapper(?:$|[\s,.:#>[+~])/.test(selector) ||
           /(?:^|[\s,>+~])#preview(?:$|[\s,.:#>[+~])/.test(selector);
}

/**
 * Check if a selector targets code block elements
 * These selectors should be excluded from scoping to prevent preview styles
 * from overriding syntax highlighting (Issue #387)
 * @param {string} selector - CSS selector to check
 * @returns {boolean} True if selector targets code blocks
 */
function isCodeBlockSelector(selector) {
    const trimmed = selector.trim().toLowerCase();
    // Direct code block element selectors
    if (trimmed === 'pre' || trimmed === 'code' || trimmed === '.hljs') {
        return true;
    }
    // Selectors that start with code block elements (e.g., "pre code", "code.hljs")
    if (/^(pre|code|\.hljs)(\s|\.|\[|:|\{|$)/.test(trimmed)) {
        return true;
    }
    // Selectors containing code block descendants (e.g., "div pre", ".content code")
    // We allow these but they're handled by syntax override CSS
    return false;
}

/**
 * Scope a single CSS selector by adding #wrapper prefix
 * @param {string} selector - Single CSS selector to scope
 * @returns {string} Scoped selector (empty string if should be excluded)
 */
function scopeSelector(selector) {
    const trimmed = selector.trim();
    // Skip empty, @-rules, or comments
    if (!trimmed ||
        trimmed.startsWith('@') ||
        trimmed.startsWith('/*')) {
        return trimmed;
    }
    // Exclude code block selectors to prevent preview style bleeding (Issue #387)
    if (isCodeBlockSelector(trimmed)) {
        return ''; // Will be filtered out by parseSelectorAndBlock
    }
    // Skip if already scoped to #wrapper or #preview
    if (isSelectorScoped(trimmed)) {
        return trimmed;
    }
    // Replace :root, body, or html with #wrapper (these target the whole document)
    if (trimmed === ':root' || trimmed === 'body' || trimmed === 'html') {
        return '#wrapper';
    }
    // Scope universal selector
    if (trimmed === '*') {
        return '#wrapper *';
    }
    // Handle compound selectors starting with :root, body, html (e.g., "body.dark", ":root[data-theme]")
    if (/^(:root|body|html)([.#[:].*)$/.test(trimmed)) {
        return trimmed.replace(/^(:root|body|html)/, '#wrapper');
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
 * Check if an @-rule is a grouping rule that contains style rules
 * Grouping rules like @media, @supports contain nested selectors that need scoping
 * @param {string} atRuleName - The @-rule name (e.g., 'media', 'supports')
 * @returns {boolean} True if it's a grouping rule
 */
function isGroupingAtRule(atRuleName) {
    // Grouping rules contain style rules with selectors that need scoping
    const groupingRules = ['media', 'supports', 'document', 'layer'];
    return groupingRules.includes(atRuleName.toLowerCase());
}

/**
 * Extract @-rule name from CSS starting after '@'
 * @param {string} css - CSS text
 * @param {number} start - Position after '@'
 * @param {number} len - Length of CSS
 * @returns {{name: string, end: number}} Rule name and position after name
 */
function extractAtRuleName(css, start, len) {
    let end = start;
    while (end < len && /[a-zA-Z-]/.test(css[end])) {
        end++;
    }
    return { name: css.substring(start, end), end };
}

/**
 * Find opening brace or semicolon in @-rule
 * @param {string} css - CSS text
 * @param {number} start - Position to start searching
 * @param {number} len - Length of CSS
 * @returns {number} Position of brace or semicolon
 */
function findAtRuleDelimiter(css, start, len) {
    let i = start;
    while (i < len && css[i] !== '{' && css[i] !== ';') {
        i++;
    }
    return i;
}

/**
 * Handle @-rule with braces (block rule)
 * @param {string} css - CSS text
 * @param {number} atStart - Start of @-rule
 * @param {number} bracePos - Position of opening brace
 * @param {string} atRuleName - Name of @-rule
 * @param {Array<string>} result - Result array
 * @param {number} depth - Recursion depth
 * @param {number} len - CSS length
 * @returns {number} Position after closing brace
 */
function handleBlockAtRule(css, atStart, bracePos, atRuleName, result, depth, len) {
    const contentStart = bracePos + 1;
    const { end, contentEnd } = findMatchingBrace(css, contentStart, len);

    if (isGroupingAtRule(atRuleName)) {
        const prelude = css.substring(atStart, bracePos + 1);
        const innerContent = css.substring(contentStart, contentEnd);
        const scopedInner = scopeCSSToPreview(innerContent, depth + 1);
        result.push(prelude, scopedInner, '}');
    } else {
        result.push(css.substring(atStart, end));
    }
    return end;
}

/**
 * Parse an @-rule and add it to result, scoping selectors inside grouping rules
 * @param {string} css - CSS text
 * @param {number} i - Current index (pointing at '@')
 * @param {Array<string>} result - Result array to append to
 * @param {number} depth - Current recursion depth
 * @returns {number} New index after parsing @-rule
 */
function parseAtRule(css, i, result, depth = 0) {
    const atStart = i;
    const len = css.length;
    i++; // Skip '@'

    const { name: atRuleName, end: nameEnd } = extractAtRuleName(css, i, len);
    const delimPos = findAtRuleDelimiter(css, nameEnd, len);

    // Block rule with braces
    if (delimPos < len && css[delimPos] === '{') {
        return handleBlockAtRule(css, atStart, delimPos, atRuleName, result, depth, len);
    }

    // Statement rule ending with semicolon or EOF
    const ruleEnd = delimPos < len ? delimPos + 1 : delimPos;
    result.push(css.substring(atStart, ruleEnd));
    return ruleEnd;
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

    // Extract and scope selectors, filtering out empty ones (code block selectors)
    const selectorText = css.substring(selectorStart, i);
    const selectors = selectorText.split(',');
    const scopedSelectors = selectors
        .map(scopeSelector)
        .filter(s => s.trim() !== '') // Remove excluded selectors (code blocks)
        .join(', ');

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

    // Skip entire rule if all selectors were filtered out (code block selectors)
    if (scopedSelectors.trim() === '') {
        return i;
    }

    // Push all parts at once to avoid multiple push calls
    result.push(scopedSelectors, openBrace, ruleBodyChars.join(''));

    return i;
}

/**
 * Maximum recursion depth for CSS parsing to prevent infinite loops.
 *
 * This limit protects against:
 * - Malformed CSS with deeply nested @-rules (e.g., @media inside @media inside @supports...)
 * - Potential DoS from adversarial CSS designed to cause stack overflow
 * - Infinite recursion bugs in our parsing logic
 *
 * Value of 10 is generous - real-world CSS rarely exceeds 3-4 levels of nesting.
 * If this limit is hit, the CSS is returned unprocessed with a console warning.
 *
 * @see stripWrapperLayoutProperties - uses this for layout property stripping
 * @see scopeCSSToPreview - uses this for selector scoping
 */
const MAX_CSS_RECURSION_DEPTH = 10;

/**
 * Scope CSS to only affect #wrapper using a character-by-character parser
 * This avoids regex backtracking vulnerabilities (DoS prevention)
 * @param {string} css - CSS text to scope
 * @param {number} depth - Current recursion depth (default 0)
 * @returns {string} Scoped CSS
 */
function scopeCSSToPreview(css, depth = 0) {
    // Prevent infinite recursion on malformed CSS
    if (depth > MAX_CSS_RECURSION_DEPTH) {
        console.warn('CSS scoping: max recursion depth exceeded, returning unscoped');
        return css;
    }

    const result = [];
    let i = 0;
    const len = css.length;

    while (i < len) {
        // Skip whitespace
        i = skipWhitespace(css, i, result);
        if (i >= len) break;

        // Check for @-rule (pass through unchanged until matching brace)
        if (css[i] === '@') {
            i = parseAtRule(css, i, result, depth);
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
 * Apply syntax override - isolate code blocks from preview style contamination
 *
 * The three styling domains must be completely isolated:
 * 1. Preview styles → Only affect content (NOT code blocks, NOT mermaid)
 * 2. Syntax theme → Only affect code blocks (from CDN, not hardcoded)
 * 3. Mermaid theme → Only affect mermaid diagrams
 *
 * With CSS Cascade Layers, the layer order handles isolation automatically.
 * This function now only provides minimal structural styles for code blocks.
 */
function applySyntaxOverride() {
    let syntaxOverride = document.getElementById('syntax-override');
    if (!syntaxOverride) {
        syntaxOverride = document.createElement('style');
        syntaxOverride.id = 'syntax-override';
        document.head.appendChild(syntaxOverride);
    }

    // Basic structure for code blocks
    syntaxOverride.textContent = `
        #wrapper pre {
            margin: 1em 0;
            padding: 0;
            background: transparent !important;
        }

        #wrapper pre code.hljs {
            display: block;
            padding: 1em;
            overflow-x: auto;
            border-radius: 4px;
            white-space: pre;
            font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace !important;
            font-size: 0.9em;
            line-height: 1.5;
            tab-size: 4;
        }

        /* Inline code (not in pre) */
        #wrapper code:not(.hljs):not(pre code) {
            font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace !important;
            font-size: 0.9em;
            background: rgba(0,0,0,0.05) !important;
            padding: 0.2em 0.4em;
            border-radius: 3px;
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
            // Cache background color to prevent theme flash on back navigation (#175 fix)
            saveCachedBackgroundColor(bgColor);
        }
    }

    // NOW remove previous style (preview already has new background color)
    if (state.currentStyleLink) {
        state.currentStyleLink.remove();
    }

    // Create style element with scoped CSS wrapped in preview-styles layer
    const styleElement = document.createElement('style');
    styleElement.id = 'marked-custom-style';
    styleElement.textContent = `@layer preview-styles { ${cssText} }`;
    document.head.appendChild(styleElement);

    state.currentStyleLink = styleElement;

    // If background wasn't found during preload, set default (white)
    if (!bgColor) {
        const { preview } = getElements();
        if (preview) {
            preview.style.background = 'white';
            updateMermaidTheme(false); // White background = light theme
            saveCachedBackgroundColor('white');
        }
    }

    // Apply syntax override structure
    applySyntaxOverride();

    // Re-render markdown to update Mermaid diagrams with new CSS
    // Note: YAML panel state preservation is handled automatically in renderMarkdown() (#268 fix)
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
    // NOTE: We no longer strip @media print blocks as they're needed for PDF page breaks
    // The print media queries contain essential rules for hr elements (page breaks),
    // tables (page-break-inside: avoid), and other print-specific formatting

    // Scope the CSS to only affect #wrapper (the content area)
    // Always scope non-local CSS - individual already-scoped selectors are handled by scopeSelector()
    // This fixes #384: CSS with partial #wrapper rules was bypassing scoping entirely
    if (style.source !== 'local') {
        cssText = scopeCSSToPreview(cssText);
    }

    // Store scoped CSS before layout stripping for toggle reapplication
    currentScopedCSS = cssText;

    // Strip layout properties from #wrapper rules if "Respect Style Layout" is OFF
    // This allows user control of preview width via drag handle, overriding !important rules
    if (!state.respectStyleLayout) {
        cssText = stripWrapperLayoutProperties(cssText);
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
        // Clear loaded styles from memory and sessionStorage (#390)
        loadedStyles.length = 0;
        saveLoadedStylesToSession();
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
        const success = await promptForURLWithResult('Style', 'style');
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
    // First check if this is a dynamically loaded style
    const loadedStyle = loadedStyles.find(s => s.name === styleName);
    if (loadedStyle?.css) {
        showStatus(`Loading style: ${styleName}...`);
        await applyCSSDirectly(loadedStyle.css, styleName);
        showStatus(`Style loaded: ${styleName}`);
        return true;
    }

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
        // Add to dropdown with CSS content for re-selection
        addLoadedStyleToDropdown(file.name, 'file', cssText);
        // Save to sessionStorage for persistence across navigation (#390)
        saveLoadedStylesToSession();
        showStatus(`Loaded: ${file.name}`);
    } catch (error) {
        showStatus(`Error loading file: ${error.message}`);
        console.error('File load error:', error);
    }
}

/**
 * Prompt user for URL to load CSS from using accessible modal
 * @param {string} context - Context for the modal title (e.g., "Style", "Syntax Theme")
 * @param {string} contextType - Content type for screen reader description (style, syntax, editor, mermaid)
 * @returns {Promise<boolean>} True if URL was provided and loading initiated
 */
async function promptForURLWithResult(context = 'Style', contextType = 'style') {
    const url = await showURLModal({
        title: `Load ${context} from URL`,
        placeholder: 'https://raw.githubusercontent.com/user/repo/main/style.css',
        allowedDomains: ALLOWED_CSS_DOMAINS,
        context: contextType
    });

    if (!url) {
        return false; // User cancelled
    }

    await loadCSSFromURL(url);
    return true;
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
        // Extract filename from URL for dropdown display
        const urlParts = normalizedUrl.split('/');
        const displayName = urlParts.at(-1) || normalizedUrl;
        // Add to dropdown with CSS content for re-selection
        addLoadedStyleToDropdown(displayName, 'url', cssText);
        // Save to sessionStorage for persistence across navigation (#390)
        saveLoadedStylesToSession();
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
 * Apply CSS directly without scope processing (for already-scoped files)
 * Preloads background color before removing old CSS to prevent white flash (#110 fix)
 * @param {string} cssText - CSS text to apply
 * @param {string} sourceName - Source name for saving preference
 */
async function applyCSSDirectly(cssText, sourceName) {
    // NOTE: We no longer strip @media print blocks as they're needed for PDF page breaks
    // The print media queries contain essential rules for hr elements (page breaks),
    // tables (page-break-inside: avoid), and other print-specific formatting

    // Always scope external CSS to #wrapper - the scopeSelector function handles
    // already-scoped selectors by passing them through unchanged.
    // DO NOT skip scoping based on cssText.includes('#wrapper') - this was bug #384
    // where CSS containing partial #wrapper rules bypassed scoping entirely.
    cssText = scopeCSSToPreview(cssText);

    // Store scoped CSS before layout stripping for toggle reapplication
    currentScopedCSS = cssText;

    // Strip layout properties from #wrapper rules if "Respect Style Layout" is OFF
    // This allows user control of preview width via drag handle, overriding !important rules
    if (!state.respectStyleLayout) {
        cssText = stripWrapperLayoutProperties(cssText);
    }

    // Apply core CSS logic (handles preload, swap, render)
    await applyCSSCore(cssText);

    // Apply layout constraints based on toggle setting
    applyLayoutConstraints();

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
 * Update just the checkbox state for the HR page break toggle option (uses cached reference)
 */
function updateHRPageBreakToggleCheckbox() {
    if (hrPageBreakToggleOption) {
        hrPageBreakToggleOption.textContent = (state.hrAsPageBreak ? '✓ ' : '☐ ') + 'HR as Page Break';
    }
}

/**
 * Apply or remove page break CSS for horizontal rules based on the toggle setting
 */
function applyHRPageBreakStyle() {
    // Find or create the dynamic style element for HR page breaks
    let styleEl = document.getElementById('hr-page-break-style');

    if (state.hrAsPageBreak) {
        // Add page break CSS if not present
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'hr-page-break-style';
            styleEl.textContent = `
                @media print {
                    #wrapper hr {
                        page-break-after: always;
                        break-after: page;
                        border: none;
                        margin: 0;
                        padding: 0;
                        visibility: hidden;
                        height: 0;
                    }
                }
            `;
            document.head.appendChild(styleEl);
        }
    } else if (styleEl) {
        // Remove page break CSS if present
        styleEl.remove();
    }
}

/**
 * Handle the Respect Style Layout toggle
 * @param {HTMLElement|null} styleSelector - The style selector element
 */
async function handleRespectStyleLayoutToggle(styleSelector) {
    state.respectStyleLayout = !state.respectStyleLayout;
    saveRespectStyleLayout(state.respectStyleLayout);

    // Reapply CSS with new toggle state if we have stored CSS
    if (currentScopedCSS) {
        const cssToApply = state.respectStyleLayout
            ? currentScopedCSS
            : stripWrapperLayoutProperties(currentScopedCSS);
        await applyCSSCore(cssToApply);
    }

    applyLayoutConstraints();
    updateLayoutToggleCheckbox();

    // Restore previous selection
    const currentStyle = getMarkdownStyle() || 'Clean';
    if (styleSelector) {
        styleSelector.value = currentStyle;
    }
    showStatus(state.respectStyleLayout ? 'Style layout respected' : 'Style layout overridden');
}

/**
 * Handle the HR as Page Break toggle
 * @param {HTMLElement|null} styleSelector - The style selector element
 */
function handleHRPageBreakToggle(styleSelector) {
    state.hrAsPageBreak = !state.hrAsPageBreak;
    saveHRAsPageBreak(state.hrAsPageBreak);
    applyHRPageBreakStyle();
    updateHRPageBreakToggleCheckbox();

    // Restore previous selection
    const currentStyle = getMarkdownStyle() || 'Clean';
    if (styleSelector) {
        styleSelector.value = currentStyle;
    }
    showStatus(state.hrAsPageBreak ? 'HR as page break enabled' : 'HR as visual separator enabled');
}

/**
 * Change the current style
 * Reverts dropdown selection if style loading fails or is cancelled (#108 fix)
 * @param {string} styleName - Name of the style to change to
 */
async function changeStyle(styleName) {
    if (!styleName) return;

    const { styleSelector } = getElements();

    // Handle toggle options
    if (styleName === 'Respect Style Layout') {
        await handleRespectStyleLayoutToggle(styleSelector);
        return;
    }

    if (styleName === 'HR as Page Break') {
        handleHRPageBreakToggle(styleSelector);
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
 * Loads new theme BEFORE removing old to prevent flicker (Issue #376)
 * @param {string} themeName - Name of the theme to load
 */
async function loadSyntaxTheme(themeName) {
    const theme = syntaxThemes.find(t => t.name === themeName);
    if (!theme) return;

    // Race condition protection: ignore new requests while a load is in progress
    if (syntaxThemeLoading) {
        console.log('Syntax theme load already in progress, ignoring new request');
        return;
    }

    // Verify theme has SRI hash for security
    const sriHash = syntaxThemeSRI[theme.file];
    if (!sriHash) {
        console.error(`No SRI hash for theme: ${theme.file}`);
        return;
    }

    // Mark as loading
    syntaxThemeLoading = true;

    // Store reference to old theme for cleanup after new one loads
    const oldThemeLink = state.currentSyntaxThemeLink;

    try {
        // Fetch the CSS content first to verify SRI and wrap in layer
        const cdnUrl = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${theme.file}.min.css`;

        // Load new theme FIRST (Issue #376 fix)
        // Keep old theme in place during load to prevent flicker
        const response = await fetch(cdnUrl, {
            integrity: sriHash,
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const cssText = await response.text();

        // Create style element with @layer wrapper (instead of link element)
        const styleElement = document.createElement('style');
        styleElement.id = SYNTAX_THEME_LOADING_ID;
        styleElement.textContent = `@layer syntax-theme { ${cssText} }`;
        document.head.appendChild(styleElement);

        // Brief wait for browser to parse the stylesheet
        await new Promise(resolve => setTimeout(resolve, SYNTAX_THEME_PARSE_DELAY));

        // NOW remove old theme (after new one is loaded and ready)
        if (oldThemeLink) {
            oldThemeLink.remove();
        }

        // Update ID and store reference
        styleElement.id = SYNTAX_THEME_ID;
        state.currentSyntaxThemeLink = styleElement;

        // Save preference
        saveSyntaxTheme(themeName);

        showStatus(`Syntax theme: ${theme.name}`);
    } catch (error) {
        console.error('Failed to load syntax theme:', error);
        showStatus(`Error loading syntax theme: ${theme.name}`);
        // Clean up failed load attempt, keep old theme
        const failedLink = document.getElementById(SYNTAX_THEME_LOADING_ID);
        if (failedLink) failedLink.remove();
    } finally {
        // Clear loading flag
        syntaxThemeLoading = false;
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
        const success = await promptForURLWithResult('Syntax Theme', 'syntax');
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
 * Loads new theme BEFORE removing old to prevent flicker (Issue #376)
 * @param {string} themeName - Name of the theme to load
 */
async function loadEditorTheme(themeName) {
    const theme = editorThemes.find(t => t.name === themeName);
    if (!theme) return;

    // Race condition protection: ignore new requests while a load is in progress
    if (editorThemeLoading) {
        console.log('Editor theme load already in progress, ignoring new request');
        return;
    }

    // Mark as loading
    editorThemeLoading = true;

    // Store reference to old theme for cleanup after new one loads
    const oldThemeLink = state.currentEditorThemeLink;

    try {
        // Load new theme from local styles/editor/ directory FIRST (Issue #376 fix)
        const response = await fetch(`styles/editor/${theme.file}.css`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const cssText = await response.text();

        // Create style element with temporary ID
        const styleElement = document.createElement('style');
        styleElement.id = EDITOR_THEME_LOADING_ID;
        styleElement.textContent = cssText;
        document.head.appendChild(styleElement);

        // Brief wait for browser to parse the stylesheet
        await new Promise(resolve => setTimeout(resolve, EDITOR_THEME_PARSE_DELAY));

        // NOW remove old theme (after new one is loaded and ready)
        if (oldThemeLink) {
            oldThemeLink.remove();
        }

        // Update ID and store reference
        styleElement.id = EDITOR_THEME_ID;
        state.currentEditorThemeLink = styleElement;

        // Save preference
        saveEditorTheme(themeName);

        showStatus(`Editor theme: ${theme.name}`);
    } catch (error) {
        console.error('Failed to load editor theme:', error);
        showStatus(`Error loading editor theme: ${theme.name}`);
        // Clean up failed load attempt, keep old theme
        const failedStyle = document.getElementById(EDITOR_THEME_LOADING_ID);
        if (failedStyle) failedStyle.remove();
    } finally {
        // Clear loading flag
        editorThemeLoading = false;
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
        const success = await promptForURLWithResult('Editor Theme', 'editor');
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
        const success = await promptForURLWithResult('Mermaid Theme', 'mermaid');
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

    // FIRST: Restore loaded styles from sessionStorage (#390 fix)
    // This must happen BEFORE populating the dropdown so restored styles
    // can be added to the "Loaded" optgroup
    restoreLoadedStylesFromSession();

    populateSelectorWithOptgroups(
        styleSelector,
        availableStyles,
        ['Preview Style', 'Options', 'Import'],
        (style) => {
            const option = document.createElement('option');
            option.value = style.name;
            option.textContent = style.name;

            // Handle toggles with checkmark and cache reference for performance
            if (style.source === 'toggle') {
                if (style.name === 'Respect Style Layout') {
                    option.textContent = (state.respectStyleLayout ? '✓ ' : '☐ ') + style.name;
                    layoutToggleOption = option;
                } else if (style.name === 'HR as Page Break') {
                    option.textContent = (state.hrAsPageBreak ? '✓ ' : '☐ ') + style.name;
                    hrPageBreakToggleOption = option;
                }
            }

            return option;
        }
    );

    // Add restored styles to dropdown (Issue #390 fix)
    // This populates the "Loaded" optgroup with styles from sessionStorage.
    // Note: addLoadedStyleToDropdown() has duplicate prevention via
    // `!loadedStyles.some(s => s.name === styleName)` check, which is necessary
    // because restoreLoadedStylesFromSession() already populated the loadedStyles
    // array before this loop runs.
    if (loadedStyles.length > 0) {
        loadedStyles.forEach(style => {
            addLoadedStyleToDropdown(style.name, style.source, style.css);
        });
    }

    // Load saved style or default
    const savedStyle = getMarkdownStyle();
    const defaultStyle = availableStyles.find(s => s.default)?.name || 'Clean';
    const styleToLoad = savedStyle || defaultStyle;

    styleSelector.value = styleToLoad;
    await loadStyle(styleToLoad);

    // Apply HR page break style based on saved preference
    applyHRPageBreakStyle();
}

/**
 * Add a dynamically loaded style to the dropdown and select it
 * Creates a "Loaded" optgroup if it doesn't exist
 * @param {string} styleName - Name of the style (filename or short URL)
 * @param {string} source - Source type: 'file' or 'url'
 * @param {string} cssContent - The CSS content (stored for re-selection)
 */
function addLoadedStyleToDropdown(styleName, source, cssContent) {
    const { styleSelector } = getElements();
    if (!styleSelector) return;

    // Check if style already exists in dropdown
    const existingOption = Array.from(styleSelector.options).find(opt => opt.value === styleName);
    if (existingOption) {
        // Update CSS content in case it changed
        const existingStyle = loadedStyles.find(s => s.name === styleName);
        if (existingStyle) {
            existingStyle.css = cssContent;
            // Update sessionStorage when CSS content changes (#390)
            saveLoadedStylesToSession();
        }
        styleSelector.value = styleName;
        return;
    }

    // Find or create "Loaded" optgroup
    let loadedOptgroup = styleSelector.querySelector('optgroup[label="Loaded"]');
    if (!loadedOptgroup) {
        loadedOptgroup = document.createElement('optgroup');
        loadedOptgroup.label = 'Loaded';
        // Insert after "Preview Style" optgroup
        const importOptgroup = styleSelector.querySelector('optgroup[label="Import"]');
        if (importOptgroup) {
            importOptgroup.before(loadedOptgroup);
        } else {
            styleSelector.appendChild(loadedOptgroup);
        }
    }

    // Create and add option
    const option = document.createElement('option');
    option.value = styleName;
    option.textContent = styleName + (source === 'url' ? ' (URL)' : '');
    loadedOptgroup.appendChild(option);

    // Track in loadedStyles array with CSS content for re-selection
    if (!loadedStyles.some(s => s.name === styleName)) {
        loadedStyles.push({ name: styleName, source, css: cssContent });
    }

    // Select the new style
    styleSelector.value = styleName;
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
    applyPreviewBackground,
    loadCSSFromFile,
    applyCSSDirectly
};
