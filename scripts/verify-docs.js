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
import { join, dirname, relative } from 'node:path';
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
 * - `js/security.js`
 * - `docs/about.md`
 * - `index.html`
 * @param {string} content - Markdown content
 * @returns {string[]} Array of referenced file paths
 */
function extractFileReferences(content) {
    const refs = new Set();

    // Match code blocks with file paths (backtick enclosed)
    // Matches: `js/file.js`, `docs/file.md`, `index.html`
    const codePathRegex = /`([\w-]+\/[\w/-]+\.[a-zA-Z]+)`/g;
    let match;

    while ((match = codePathRegex.exec(content)) !== null) {
        const path = match[1];
        // Only include paths that look like files (have extension)
        // Exclude URLs (contain ://)
        if (!path.includes('://') && /\.[a-zA-Z]+$/.test(path)) {
            refs.add(path);
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

    // Built-in JavaScript functions/globals to skip
    const builtins = new Set([
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

    // Match function calls: `functionName()`
    const functionRegex = /`([a-zA-Z_]\w*)\(\)`/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
        const name = match[1];
        if (!builtins.has(name)) {
            refs.add(JSON.stringify({ name, type: 'function' }));
        }
    }

    // Match constants: `ALL_CAPS_NAME` (at least 2 chars, all uppercase with underscores)
    const constantRegex = /`([A-Z][A-Z0-9_]+)`/g;
    while ((match = constantRegex.exec(content)) !== null) {
        const name = match[1];
        // Only constants with at least one underscore or 2+ chars
        if (name.length >= 2 && (name.includes('_') || name.length > 2)) {
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

        // Match function declarations: function name() or const name = function()
        const functionPatterns = [
            /function\s+([a-zA-Z_]\w*)\s*\(/g,
            /const\s+([a-zA-Z_]\w*)\s*=\s*function/g,
            /const\s+([a-zA-Z_]\w*)\s*=\s*\([^)]*\)\s*=>/g,
            /export\s+function\s+([a-zA-Z_]\w*)\s*\(/g,
            /export\s+const\s+([a-zA-Z_]\w*)\s*=\s*function/g,
            /export\s+const\s+([a-zA-Z_]\w*)\s*=\s*\([^)]*\)\s*=>/g
        ];

        for (const pattern of functionPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                definitions.functions.add(match[1]);
            }
        }

        // Match constant declarations: const UPPER_CASE
        const constantPattern = /const\s+([A-Z][A-Z0-9_]+)\s*=/g;
        let match;
        while ((match = constantPattern.exec(content)) !== null) {
            definitions.constants.add(match[1]);
        }

        // Match exports: export { name, name2 }
        const exportPattern = /export\s+\{\s*([^}]+)\s*\}/g;
        while ((match = exportPattern.exec(content)) !== null) {
            const exports = match[1].split(',').map(e => e.trim().split(/\s+as\s+/)[0].trim());
            exports.forEach(exp => definitions.exports.add(exp));
        }

        // Match export function/const
        const exportDirectPattern = /export\s+(?:function|const)\s+([a-zA-Z_]\w*)/g;
        while ((match = exportDirectPattern.exec(content)) !== null) {
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
                const defs = parseJavaScriptFile(fullPath);
                const relPath = relative(ROOT_DIR, fullPath);

                // Add to index
                for (const func of defs.functions) {
                    if (!index.functions.has(func)) {
                        index.functions.set(func, []);
                    }
                    index.functions.get(func).push(relPath);
                }

                for (const constant of defs.constants) {
                    if (!index.constants.has(constant)) {
                        index.constants.set(constant, []);
                    }
                    index.constants.get(constant).push(relPath);
                }

                for (const exp of defs.exports) {
                    if (!index.exports.has(exp)) {
                        index.exports.set(exp, []);
                    }
                    index.exports.get(exp).push(relPath);
                }
            }
        }
    }

    await indexDirectory(jsDir);
    return index;
}

/**
 * Verify a single markdown file
 * @param {string} mdFile - Path to markdown file
 * @param {Object} codeIndex - Code index from buildCodeIndex
 * @param {boolean} isSessionNote - Whether this is a session note (historical doc)
 */
async function verifyMarkdownFile(mdFile, codeIndex, isSessionNote = false) {
    const relPath = relative(ROOT_DIR, mdFile);
    const content = readFileSync(mdFile, 'utf-8');

    console.log(`${COLORS.blue}Checking ${relPath}...${COLORS.reset}`);

    // For session notes, only verify file references (skip historical code refs)
    // Session notes document past changes and may reference old/removed code
    const skipCodeVerification = isSessionNote;

    // Verify file references
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

    if (skipCodeVerification) {
        console.log(`  ${COLORS.gray}(Skipping code verification for session note)${COLORS.reset}`);
        return;
    }

    // Verify code references (functions/constants)
    const codeRefs = extractCodeReferences(content);
    for (const { name, type } of codeRefs) {
        const found = type === 'function'
            ? codeIndex.functions.has(name)
            : codeIndex.constants.has(name);

        if (found) {
            results.codeRefs.passed.push({ file: relPath, name, type });
        } else {
            results.codeRefs.failed.push({ file: relPath, name, type });
            console.log(`  ${COLORS.red}✗ ${type} not found: ${name}${COLORS.reset}`);
        }
    }

    // Verify that documented exports exist (if any export syntax found)
    const exportRefs = content.match(/export\s+(?:function|const|class)\s+([a-zA-Z_]\w*)/g) || [];
    for (const ref of exportRefs) {
        const match = ref.match(/export\s+(?:function|const|class)\s+([a-zA-Z_]\w*)/);
        if (match) {
            const name = match[1];
            if (codeIndex.exports.has(name)) {
                results.exportRefs.passed.push({ file: relPath, name });
            } else {
                results.exportRefs.failed.push({ file: relPath, name });
                console.log(`  ${COLORS.red}✗ Export not found: ${name}${COLORS.reset}`);
            }
        }
    }
}

/**
 * Print summary of verification results
 */
function printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log(`${COLORS.blue}Verification Summary${COLORS.reset}`);
    console.log('='.repeat(60));

    console.log(`\n${COLORS.yellow}File References:${COLORS.reset}`);
    console.log(`  ${COLORS.green}✓ Passed: ${results.fileRefs.passed.length}${COLORS.reset}`);
    console.log(`  ${COLORS.red}✗ Failed: ${results.fileRefs.failed.length}${COLORS.reset}`);

    console.log(`\n${COLORS.yellow}Code References (Functions/Constants):${COLORS.reset}`);
    console.log(`  ${COLORS.green}✓ Passed: ${results.codeRefs.passed.length}${COLORS.reset}`);
    console.log(`  ${COLORS.red}✗ Failed: ${results.codeRefs.failed.length}${COLORS.reset}`);

    const hasExports = results.exportRefs.passed.length > 0 || results.exportRefs.failed.length > 0;
    if (hasExports) {
        console.log(`\n${COLORS.yellow}Export References:${COLORS.reset}`);
        console.log(`  ${COLORS.green}✓ Passed: ${results.exportRefs.passed.length}${COLORS.reset}`);
        console.log(`  ${COLORS.red}✗ Failed: ${results.exportRefs.failed.length}${COLORS.reset}`);
    }

    const totalFailed = results.fileRefs.failed.length +
                       results.codeRefs.failed.length +
                       results.exportRefs.failed.length;

    if (totalFailed > 0) {
        console.log(`\n${COLORS.red}❌ Verification failed with ${totalFailed} error(s)${COLORS.reset}`);

        // Show failed references
        if (results.fileRefs.failed.length > 0) {
            console.log(`\n${COLORS.red}Failed File References:${COLORS.reset}`);
            for (const { file, ref } of results.fileRefs.failed) {
                console.log(`  ${file}: ${ref}`);
            }
        }

        if (results.codeRefs.failed.length > 0) {
            console.log(`\n${COLORS.red}Failed Code References:${COLORS.reset}`);
            for (const { file, name, type } of results.codeRefs.failed) {
                console.log(`  ${file}: ${name} (${type})`);
            }
        }

        if (results.exportRefs.failed.length > 0) {
            console.log(`\n${COLORS.red}Failed Export References:${COLORS.reset}`);
            for (const { file, name } of results.exportRefs.failed) {
                console.log(`  ${file}: ${name}`);
            }
        }
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
            const isSessionNote = mdFile.includes('/session-notes/') || mdFile.includes('/session-notes-');
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
