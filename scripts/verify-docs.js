#!/usr/bin/env node

/**
 * Documentation-to-Code Verification Script
 *
 * This script verifies that documentation references match actual code:
 * - File paths referenced in docs actually exist
 * - Functions/constants mentioned in docs exist in source files
 * - Exports documented are actually exported
 *
 * Helps prevent documentation drift by catching broken references.
 *
 * Usage: node scripts/verify-docs.js
 * Exit code: 0 if all checks pass, 1 if any verification fails
 */

import { readFileSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get script directory for relative paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// ANSI colors for terminal output
const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m'
};

// Track verification results
const results = {
    fileRefs: { passed: [], failed: [] },
    codeRefs: { passed: [], failed: [] },
    exportRefs: { passed: [], failed: [] }
};

// Built-in JavaScript functions/globals to skip during code reference verification
// These are defined at module scope for performance (avoid recreation per call)
const JAVASCRIPT_BUILTINS = new Set([
    'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean',
    'Function', 'Date', 'RegExp', 'Error', 'Math',
    'JSON', 'console', 'window', 'document',
    'fetch', 'alert', 'confirm', 'prompt',
    'URL', 'URLSearchParams', 'Blob', 'File',
    'addEventListener', 'removeEventListener',
    'querySelector', 'querySelectorAll',
    'getElementById', 'getElementsByClassName',
    'createElement', 'createTextNode',
    'appendChild', 'removeChild',
    'waitForFunction', // Playwright/test framework function
    'url' // Generic placeholder
]);

// Regex patterns for parsing JavaScript files
// Defined at module scope to avoid recreation on each function call
const JS_FUNCTION_PATTERNS = [
    /function\s+([a-zA-Z_]\w*)\s*\(/g,
    /const\s+([a-zA-Z_]\w*)\s*=\s*function/g,
    /const\s+([a-zA-Z_]\w*)\s*=\s*\([^)]*\)\s*=>/g,
    /export\s+function\s+([a-zA-Z_]\w*)\s*\(/g,
    /export\s+const\s+([a-zA-Z_]\w*)\s*=\s*function/g,
    /export\s+const\s+([a-zA-Z_]\w*)\s*=\s*\([^)]*\)\s*=>/g
];
const JS_CONSTANT_PATTERN = /const\s+([A-Z][A-Z0-9_]+)\s*=/g;
// Note: Avoid \s* around [^}]+ to prevent ReDoS from overlapping quantifiers (S5852)
// The captured content is trimmed in code anyway
const JS_EXPORT_BLOCK_PATTERN = /export\s+\{([^}]+)\}/g;
const JS_EXPORT_DIRECT_PATTERN = /export\s+(?:function|const)\s+([a-zA-Z_]\w*)/g;

/**
 * Find all markdown files in a directory recursively
 * @param {string} dir - Directory to search
 * @param {string[]} exclude - Directory names to exclude
 * @returns {Promise<string[]>} Array of markdown file paths
 */
async function findMarkdownFiles(dir, exclude = ['node_modules', '.git']) {
    const files = [];

    async function walk(currentDir) {
        const entries = await readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(currentDir, entry.name);

            if (entry.isDirectory()) {
                if (!exclude.includes(entry.name)) {
                    await walk(fullPath);
                }
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }
    }

    await walk(dir);
    return files;
}

/**
 * Extract file path references from markdown content
 * Matches patterns like:
 * - `js/security.js` (path with directory)
 * - `docs/about.md` (nested path)
 * - `node_modules/pkg.name/file.js` (dots in directory names)
 *
 * Single-segment files (no directory) like `index.html` are only matched if they're
 * known root-level project files, to avoid false positives from example filenames
 * in documentation like `custom.css` or `my-theme.css`.
 *
 * @param {string} content - Markdown content
 * @returns {string[]} Array of referenced file paths
 */
function extractFileReferences(content) {
    const refs = new Set();

    // Known file extensions to include (allowlist approach prevents false positives
    // from object property access like `URL.username` or domain names like `example.com`)
    const validExtensions = new Set([
        // Code files
        'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
        'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'hpp', 'cs',
        'php', 'pl', 'pm', 'swift', 'kt', 'scala', 'lua', 'r',
        // Web files
        'html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte',
        // Config/data files
        'json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'cfg', 'conf',
        // Documentation
        'md', 'mdx', 'txt', 'rst', 'adoc',
        // Shell scripts
        'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
        // Assets
        'svg', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp',
        // Other
        'sql', 'graphql', 'gql', 'proto', 'env', 'lock', 'log'
    ]);

    // Known root-level project files that don't have a directory path.
    //
    // DESIGN DECISION: Single-segment filenames (no directory path) are only verified
    // if they appear in this allowlist. This prevents false positives from example
    // filenames in documentation tutorials, such as:
    //   - `custom.css` (example in CSS loading guide)
    //   - `my-theme.css` (example theme filename)
    //   - `Academia.css` (example style name)
    //
    // Files with directory paths like `js/security.js` are always verified since
    // they clearly reference project structure. To add support for additional
    // root-level files, add them to this Set.
    const knownRootFiles = new Set([
        'README.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md',
        'LICENSE', 'LICENSE.md', 'index.html', 'package.json',
        'tsconfig.json', 'Dockerfile', 'docker-compose.yml'
    ]);

    // Match file paths with or without directories (backtick enclosed)
    // - `(?:[\w.-]+\/)*` matches zero or more directory segments (allows dots in dir names)
    // - `[\w.-]+` matches the filename (allows dots for things like file.min.js)
    // - `\.([a-zA-Z]+)` captures the extension
    const codePathRegex = /`((?:[\w.-]+\/)*[\w.-]+\.([a-zA-Z]+))`/g;
    let match;

    while ((match = codePathRegex.exec(content)) !== null) {
        const path = match[1];
        const ext = match[2].toLowerCase();
        const hasDirectory = path.includes('/');

        // Only include if:
        // 1. Has valid file extension (not a URL/domain/property access)
        // 2. Not a URL (contains ://)
        // 3. Either has a directory path OR is a known root-level file
        //    (single-segment files like `custom.css` are likely examples in docs)
        if (!path.includes('://') && validExtensions.has(ext)) {
            if (hasDirectory || knownRootFiles.has(path)) {
                refs.add(path);
            }
        }
    }

    return Array.from(refs);
}

/**
 * Extract function/constant references from markdown content
 * Matches patterns like:
 * - `functionName()`
 * - `CONSTANT_NAME`
 * - `className.methodName()`
 * @param {string} content - Markdown content
 * @returns {Object[]} Array of {name, type} objects
 */
function extractCodeReferences(content) {
    const refs = new Set();

    // Match function calls: `functionName()`
    const functionRegex = /`([a-zA-Z_]\w*)\(\)`/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
        const name = match[1];
        if (!JAVASCRIPT_BUILTINS.has(name)) {
            refs.add(JSON.stringify({ name, type: 'function' }));
        }
    }

    // Match constants: `ALL_CAPS_NAME` (min 3 chars, or 2+ with underscore)
    // Requires minimum 3 chars to avoid matching HTML abbreviations like ID, IP, UI
    const constantRegex = /`([A-Z][A-Z0-9_]{2,})`/g;
    while ((match = constantRegex.exec(content)) !== null) {
        const name = match[1];
        // Include if: has underscore (like A_B), or 3+ chars without underscore (like MAX, API)
        if (name.includes('_') || name.length >= 3) {
            refs.add(JSON.stringify({ name, type: 'constant' }));
        }
    }

    // Convert back to objects (using JSON to dedupe)
    return Array.from(refs).map(str => JSON.parse(str));
}

/**
 * Read and parse a JavaScript file to find function/constant definitions
 * @param {string} filePath - Path to JS file
 * @returns {Object} {functions: Set, constants: Set, exports: Set}
 */
function parseJavaScriptFile(filePath) {
    const definitions = {
        functions: new Set(),
        constants: new Set(),
        exports: new Set()
    };

    try {
        const content = readFileSync(filePath, 'utf-8');

        // Match function declarations using module-level patterns
        // Reset lastIndex before use since global regex maintains state
        for (const pattern of JS_FUNCTION_PATTERNS) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(content)) !== null) {
                definitions.functions.add(match[1]);
            }
        }

        // Match constant declarations: const UPPER_CASE
        JS_CONSTANT_PATTERN.lastIndex = 0;
        let match;
        while ((match = JS_CONSTANT_PATTERN.exec(content)) !== null) {
            definitions.constants.add(match[1]);
        }

        // Match exports: export { name, name2 }
        JS_EXPORT_BLOCK_PATTERN.lastIndex = 0;
        while ((match = JS_EXPORT_BLOCK_PATTERN.exec(content)) !== null) {
            const exports = match[1].split(',').map(e => e.trim().split(/\s+as\s+/)[0].trim());
            exports.forEach(exp => definitions.exports.add(exp));
        }

        // Match export function/const
        JS_EXPORT_DIRECT_PATTERN.lastIndex = 0;
        while ((match = JS_EXPORT_DIRECT_PATTERN.exec(content)) !== null) {
            definitions.exports.add(match[1]);
        }

    } catch (error) {
        console.error(`${COLORS.red}Error parsing ${filePath}: ${error.message}${COLORS.reset}`);
    }

    return definitions;
}

/**
 * Build an index of all code definitions across JS files
 * @param {string} jsDir - Directory containing JS files
 * @returns {Promise<Object>} Index of all definitions
 */
/**
 * Add items from a Set to an index Map
 * @param {Map} indexMap - The index map to add to
 * @param {Set} items - Items to add
 * @param {string} filePath - File path to associate with items
 */
function addToIndex(indexMap, items, filePath) {
    for (const item of items) {
        if (!indexMap.has(item)) {
            indexMap.set(item, []);
        }
        indexMap.get(item).push(filePath);
    }
}

/**
 * Process a single JavaScript file and add its definitions to the index
 * @param {string} fullPath - Full path to the JS file
 * @param {Object} index - The code index to update
 */
function indexJavaScriptFile(fullPath, index) {
    const defs = parseJavaScriptFile(fullPath);
    const relPath = relative(ROOT_DIR, fullPath);

    addToIndex(index.functions, defs.functions, relPath);
    addToIndex(index.constants, defs.constants, relPath);
    addToIndex(index.exports, defs.exports, relPath);
}

async function buildCodeIndex(jsDir) {
    const index = {
        functions: new Map(),  // name -> files[]
        constants: new Map(),  // name -> files[]
        exports: new Map()     // name -> files[]
    };

    async function indexDirectory(dir) {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                await indexDirectory(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                indexJavaScriptFile(fullPath, index);
            }
        }
    }

    await indexDirectory(jsDir);
    return index;
}

/**
 * Verify file references in content
 * @param {string} content - Markdown content
 * @param {string} relPath - Relative path of the markdown file
 */
function verifyFileRefs(content, relPath) {
    const fileRefs = extractFileReferences(content);
    for (const ref of fileRefs) {
        const fullPath = join(ROOT_DIR, ref);
        if (existsSync(fullPath)) {
            results.fileRefs.passed.push({ file: relPath, ref });
        } else {
            results.fileRefs.failed.push({ file: relPath, ref });
            console.log(`  ${COLORS.red}✗ File not found: ${ref}${COLORS.reset}`);
        }
    }
}

/**
 * Find similar names in the index (for helpful error messages)
 * @param {string} name - The name to find similar matches for
 * @param {Map} indexMap - The index to search in
 * @param {number} maxSuggestions - Maximum number of suggestions to return
 * @returns {string[]} Array of similar names with their file locations
 */
function findSimilarNames(name, indexMap, maxSuggestions = 3) {
    const nameLower = name.toLowerCase();
    const suggestions = [];

    for (const [indexName, files] of indexMap.entries()) {
        const indexNameLower = indexName.toLowerCase();
        // Check for substring match or similar prefix
        if (indexNameLower.includes(nameLower) ||
            nameLower.includes(indexNameLower) ||
            indexNameLower.startsWith(nameLower.slice(0, 3))) {
            suggestions.push({ name: indexName, files });
        }
    }

    // Sort by similarity (shorter names first, then alphabetically)
    suggestions.sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));
    return suggestions.slice(0, maxSuggestions);
}

/**
 * Verify code references (functions/constants) in content
 * @param {string} content - Markdown content
 * @param {string} relPath - Relative path of the markdown file
 * @param {Object} codeIndex - Code index from buildCodeIndex
 */
function verifyCodeRefs(content, relPath, codeIndex) {
    const codeRefs = extractCodeReferences(content);
    for (const { name, type } of codeRefs) {
        const indexMap = type === 'function' ? codeIndex.functions : codeIndex.constants;
        if (indexMap.has(name)) {
            const definedIn = indexMap.get(name);
            results.codeRefs.passed.push({ file: relPath, name, type, definedIn });
        } else {
            // Find similar names to suggest
            const suggestions = findSimilarNames(name, indexMap);
            results.codeRefs.failed.push({ file: relPath, name, type, suggestions });
            console.log(`  ${COLORS.red}✗ ${type} not found: ${name}${COLORS.reset}`);
            if (suggestions.length > 0) {
                // Build suggestion text without nested template literals (SonarCloud S6617)
                const suggestionText = suggestions.map(s => s.name + ' (' + s.files[0] + ')').join(', ');
                console.log(`    ${COLORS.gray}Did you mean: ${suggestionText}?${COLORS.reset}`);
            }
        }
    }
}

/**
 * Verify export references in content
 * Matches export statements found in markdown code blocks and verifies
 * the exported names exist in the codebase.
 * @param {string} content - Markdown content
 * @param {string} relPath - Relative path of the markdown file
 * @param {Object} codeIndex - Code index from buildCodeIndex
 */
function verifyExportRefs(content, relPath, codeIndex) {
    // Use RegExp.exec() instead of String.match() for better type safety (SonarCloud S6594)
    const exportPattern = /export\s+(?:function|const|class)\s+([a-zA-Z_]\w*)/g;
    let match;
    while ((match = exportPattern.exec(content)) !== null) {
        const name = match[1];
        if (codeIndex.exports.has(name)) {
            results.exportRefs.passed.push({ file: relPath, name });
        } else {
            results.exportRefs.failed.push({ file: relPath, name });
            console.log(`  ${COLORS.red}✗ Export not found: ${name}${COLORS.reset}`);
        }
    }
}

/**
 * Verify a single markdown file
 * @param {string} mdFile - Path to markdown file
 * @param {Object} codeIndex - Code index from buildCodeIndex
 * @param {boolean} isSessionNote - Whether this is a session note (historical doc)
 */
async function verifyMarkdownFile(mdFile, codeIndex, isSessionNote = false) {
    const relPath = relative(ROOT_DIR, mdFile);

    // Read file content with error handling for files that may be deleted/moved during verification
    let content;
    try {
        content = readFileSync(mdFile, 'utf-8');
    } catch (error) {
        console.log(`${COLORS.red}✗ Unable to read file: ${relPath} - ${error.message}${COLORS.reset}`);
        return;
    }

    console.log(`${COLORS.blue}Checking ${relPath}...${COLORS.reset}`);

    // Skip all verification for session notes (historical documentation)
    if (isSessionNote) {
        console.log(`  ${COLORS.gray}(Skipping verification for session note)${COLORS.reset}`);
        return;
    }

    verifyFileRefs(content, relPath);
    verifyCodeRefs(content, relPath, codeIndex);
    verifyExportRefs(content, relPath, codeIndex);
}

/**
 * Print a category summary (passed/failed counts)
 * @param {string} title - Category title
 * @param {Object} category - Category object with passed/failed arrays
 */
function printCategorySummary(title, category) {
    console.log(`\n${COLORS.yellow}${title}:${COLORS.reset}`);
    console.log(`  ${COLORS.green}✓ Passed: ${category.passed.length}${COLORS.reset}`);
    console.log(`  ${COLORS.red}✗ Failed: ${category.failed.length}${COLORS.reset}`);
}

/**
 * Print failed references for a category
 * @param {string} title - Section title
 * @param {Array} failures - Array of failure objects
 * @param {Function} formatter - Function to format each failure
 */
function printFailures(title, failures, formatter) {
    if (failures.length === 0) return;
    console.log(`\n${COLORS.red}${title}:${COLORS.reset}`);
    for (const item of failures) {
        console.log(`  ${formatter(item)}`);
    }
}

/**
 * Print summary of verification results
 */
function printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log(`${COLORS.blue}Verification Summary${COLORS.reset}`);
    console.log('='.repeat(60));

    printCategorySummary('File References', results.fileRefs);
    printCategorySummary('Code References (Functions/Constants)', results.codeRefs);

    const hasExports = results.exportRefs.passed.length > 0 || results.exportRefs.failed.length > 0;
    if (hasExports) {
        printCategorySummary('Export References', results.exportRefs);
    }

    const totalFailed = results.fileRefs.failed.length +
                       results.codeRefs.failed.length +
                       results.exportRefs.failed.length;

    if (totalFailed > 0) {
        console.log(`\n${COLORS.red}❌ Verification failed with ${totalFailed} error(s)${COLORS.reset}`);
        printFailures('Failed File References', results.fileRefs.failed, ({ file, ref }) => `${file}: ${ref}`);
        printFailures('Failed Code References', results.codeRefs.failed, ({ file, name, type }) => `${file}: ${name} (${type})`);
        printFailures('Failed Export References', results.exportRefs.failed, ({ file, name }) => `${file}: ${name}`);
    } else {
        console.log(`\n${COLORS.green}✅ All documentation references verified successfully!${COLORS.reset}`);
    }

    console.log('');
    return totalFailed === 0;
}

/**
 * Run verification when executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(`${COLORS.blue}Documentation-to-Code Verification${COLORS.reset}`);
    console.log(`${COLORS.gray}Verifying documentation references match actual code...${COLORS.reset}\n`);

    try {
        // Find all markdown files
        const docsDir = join(ROOT_DIR, 'docs');
        const markdownFiles = await findMarkdownFiles(docsDir);

        // Also check root-level markdown files
        const rootMdFiles = ['README.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md']
            .map(f => join(ROOT_DIR, f))
            .filter(f => existsSync(f));

        const allMdFiles = [...markdownFiles, ...rootMdFiles];

        console.log(`${COLORS.gray}Found ${allMdFiles.length} markdown files${COLORS.reset}\n`);

        // Build code index
        console.log(`${COLORS.gray}Building code index...${COLORS.reset}`);
        const jsDir = join(ROOT_DIR, 'js');
        const codeIndex = await buildCodeIndex(jsDir);
        console.log(`${COLORS.gray}Indexed ${codeIndex.functions.size} functions, ${codeIndex.constants.size} constants, ${codeIndex.exports.size} exports${COLORS.reset}\n`);

        // Verify each markdown file
        for (const mdFile of allMdFiles) {
            // Check if this is a session note (historical documentation)
            // Session notes are identified by:
            // 1. Being in a /session-notes/ directory, or
            // 2. Having a filename starting with SESSION_NOTES_ or session-notes-
            // This is more precise than checking for path substring to avoid false positives
            const fileName = basename(mdFile);
            const isSessionNote = mdFile.includes('/session-notes/') ||
                                  fileName.startsWith('SESSION_NOTES_') ||
                                  fileName.startsWith('session-notes-');
            await verifyMarkdownFile(mdFile, codeIndex, isSessionNote);
        }

        // Print summary and exit
        const success = printSummary();
        process.exit(success ? 0 : 1);

    } catch (error) {
        console.error(`${COLORS.red}Error: ${error.message}${COLORS.reset}`);
        console.error(error.stack);
        process.exit(1);
    }
}

export { verifyMarkdownFile, buildCodeIndex, extractFileReferences, extractCodeReferences };
