#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

/**
 * UI Reference Verification Script
 *
 * Verifies that documentation references to UI elements (buttons, menus, labels)
 * and document names match what actually exists in the application.
 *
 * GitHub Issue: #303
 */

const fs = require('node:fs');
const path = require('node:path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

class UIReferenceVerifier {
  /**
   * Creates a new UI reference verifier instance
   * @description Initializes the verifier with empty collections for tracking
   * UI elements, documentation references, errors, and warnings.
   * @example
   * const verifier = new UIReferenceVerifier();
   * verifier.run('/path/to/project');
   */
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.uiElements = {
      buttons: new Set(),
      dropdowns: new Set(),
      dropdownOptions: new Map(), // dropdownId -> Set of options
      labels: new Set(),
      titles: new Set(),

    };
    this.docReferences = [];
  }

  /**
   * Extract matches from HTML using a regex pattern
   * @description Iterates through all regex matches in the HTML content and
   * applies a processor function to each match. Used for extracting UI elements
   * like buttons, dropdowns, and labels.
   * @param {string} html - HTML content to search
   * @param {RegExp} regex - Regular expression pattern with global flag
   * @param {Function} processor - Function to process each match (receives RegExpExecArray)
   * @returns {void}
   * @example
   * this.extractMatches(html, /<button[^>]*>([^<]+)/gi, (match) => {
   *   console.log('Found button:', match[1]);
   * });
   */
  extractMatches(html, regex, processor) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      processor(match);
    }
  }

  /**
   * Add known UI elements that require manual extraction
   * @description Adds hardcoded UI element names that cannot be easily extracted
   * from HTML via regex (e.g., dynamically generated text, icon-only buttons).
   * This ensures common buttons, labels, and dialog titles are recognized.
   * @returns {void}
   * @maintenance REQUIRED: Update this list when adding/renaming UI elements.
   * See scripts/README.md#hardcoded-ui-elements for details.
   */
  addKnownUIElements() {
    // Add common button names that are in the HTML but need manual extraction
    const knownButtons = [
      'Save',
      'Save as PDF',
      'Share to Gist',
      'Welcome',
      'Code Validation',
      'Clear',
      'Cancel',
      'Load',
      'Close',
      'Clear All',
    ];
    knownButtons.forEach(button => this.uiElements.buttons.add(button));

    // Add dropdown and label names
    const knownLabels = [
      'Style',
      'Code Theme',
      'Editor Theme',
      'Mermaid Theme',
      'Current Document',
      'Preview Style',
      'Code Block Theme',
      'Syntax Theme',
      'Open',
      'Open URL',
      'Manage Sessions',
      'Load from file...',
      'Load from URL...',
      'MarkedCustomStyles (external)',
      'Manage sessions...',
      'New document',
      'Raw', // GitHub Raw button
    ];
    knownLabels.forEach(label => this.uiElements.labels.add(label));

    // Add modal/dialog names
    const knownTitles = [
      'Load from URL',
      'Private Repository Detected',
      'Manage Sessions',
    ];
    knownTitles.forEach(title => this.uiElements.titles.add(title));
  }

  /**
   * Extract UI elements from index.html
   * @description Parses the HTML file to extract all UI elements including buttons,
   * dropdowns, labels, and dialog titles. Populates the uiElements collections
   * for later verification against documentation references.
   * @param {string} htmlPath - Absolute path to the index.html file
   * @returns {void}
   * @example
   * verifier.extractUIElements('/path/to/project/index.html');
   */
  extractUIElements(htmlPath) {
    console.log(`${colors.cyan}Extracting UI elements from ${htmlPath}...${colors.reset}`);

    const html = fs.readFileSync(htmlPath, 'utf8');

    // Extract button text (visible text between button tags)
    const buttonRegex = /<button[^>]*>([^<]+)/gi;
    this.extractMatches(html, buttonRegex, (match) => {
      // Remove emojis using Unicode ranges (more robust than hardcoded list)
      const text = match[1].trim()
        .replaceAll(/[\u{1F300}-\u{1F9FF}]/gu, '')  // Misc symbols, emoticons, etc.
        .replaceAll(/[\u{2700}-\u{27BF}]/gu, '')    // Dingbats (✕, etc.)
        .replaceAll('\uFE0F', '')                    // Variation selector
        .trim();
      if (text) {
        this.uiElements.buttons.add(text);
      }
    });

    // Extract dropdown/select element IDs and their options
    const selectRegex = /<select[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi;
    this.extractMatches(html, selectRegex, (match) => {
      const selectId = match[1];
      const selectContent = match[2];

      this.uiElements.dropdowns.add(selectId);

      // Extract options from this select
      const optionRegex = /<option[^>]*>([^<]+)<\/option>/gi;
      const options = new Set();
      this.extractMatches(selectContent, optionRegex, (optMatch) => {
        const optText = optMatch[1].trim();
        if (optText && optText !== 'Document...' && optText !== 'Theme...' &&
            optText !== 'Style...' && optText !== 'Code...') {
          options.add(optText);
        }
      });

      if (options.size > 0) {
        this.uiElements.dropdownOptions.set(selectId, options);
      }
    });

    // Extract dialog/modal titles
    const h2Regex = /<h2[^>]*id="([^"]*)"[^>]*>([^<]+)<\/h2>/gi;
    this.extractMatches(html, h2Regex, (match) => {
      const title = match[2].trim();
      if (title) {
        this.uiElements.titles.add(title);
      }
    });

    // Extract labels and spans with significant text
    const labelRegex = /<(?:label|span)[^>]*>([^<]+)<\/(?:label|span)>/gi;
    this.extractMatches(html, labelRegex, (match) => {
      const text = match[1].trim();
      if (text && text.length > 2 && !/^\d+$/.test(text)) {
        this.uiElements.labels.add(text);
      }
    });

    // Add known UI elements that require manual extraction
    this.addKnownUIElements();

    console.log(`${colors.green}✓ Found ${this.uiElements.buttons.size} buttons${colors.reset}`);
    console.log(`${colors.green}✓ Found ${this.uiElements.dropdowns.size} dropdowns${colors.reset}`);
    console.log(`${colors.green}✓ Found ${this.uiElements.titles.size} dialog titles${colors.reset}`);
  }

  /**
   * Extract UI references from documentation files
   * @description Scans all markdown files in the docs directory for references
   * to UI elements (quoted text in bold, click/select patterns) and file paths.
   * Populates the docReferences array with all found references.
   * @param {string} docsPath - Absolute path to the documentation directory
   * @returns {void}
   * @example
   * verifier.extractDocReferences('/path/to/project/docs');
   */
  extractDocReferences(docsPath) {
    console.log(`${colors.cyan}Extracting references from documentation...${colors.reset}`);

    const docFiles = this.getAllMarkdownFiles(docsPath);

    for (const filePath of docFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, lineIndex) => {
        // Pattern 1: **"Button Name"** - bold quoted text
        const boldQuotedRegex = /\*\*"([^"]+)"\*\*/g;
        let match;
        while ((match = boldQuotedRegex.exec(line)) !== null) {
          this.docReferences.push({
            file: filePath,
            line: lineIndex + 1,
            reference: match[1],
            context: line.trim(),
            pattern: 'bold-quoted',
          });
        }

        // Pattern 2: Click the "X" button/link/menu
        const clickRegex = /(?:click|select|choose|press|use)(?: the)?\s+"([^"]+)"\s+(?:button|link|menu|dropdown|option|tab)/gi;
        while ((match = clickRegex.exec(line)) !== null) {
          this.docReferences.push({
            file: filePath,
            line: lineIndex + 1,
            reference: match[1],
            context: line.trim(),
            pattern: 'action-reference',
          });
        }

        // Pattern 3: In the "X" dropdown/menu/dialog
        const locationRegex = /(?:in|from|via)(?: the)?\s+"([^"]+)"\s+(?:dropdown|menu|dialog|modal|panel|selector)/gi;
        while ((match = locationRegex.exec(line)) !== null) {
          this.docReferences.push({
            file: filePath,
            line: lineIndex + 1,
            reference: match[1],
            context: line.trim(),
            pattern: 'location-reference',
          });
        }

        // Pattern 4: File references - docs/*.md, README.md, CONTRIBUTING.md, etc.
        const fileRefRegex = /\(?(?:\.?\/?docs\/[a-z0-9/_-]+\.md|(?:README|CONTRIBUTING|CHANGELOG|LICENSE)\.md)\)?/gi;
        while ((match = fileRefRegex.exec(line)) !== null) {
          const docPath = match[0].replaceAll(/[()]/gu, '');
          this.docReferences.push({
            file: filePath,
            line: lineIndex + 1,
            reference: docPath,
            context: line.trim(),
            pattern: 'file-reference',
          });
        }
      });
    }

    console.log(`${colors.green}✓ Found ${this.docReferences.length} references to verify${colors.reset}`);
  }

  /**
   * Get all markdown files recursively
   * @description Recursively traverses a directory to find all markdown files (.md).
   * Used to locate all documentation files that need reference verification.
   * @param {string} dir - Root directory to search
   * @returns {string[]} Array of absolute paths to markdown files
   * @example
   * const mdFiles = verifier.getAllMarkdownFiles('/path/to/docs');
   * // Returns: ['/path/to/docs/guide.md', '/path/to/docs/api/reference.md']
   */
  getAllMarkdownFiles(dir) {
    const files = [];

    const walk = (currentPath) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    };

    walk(dir);
    return files;
  }

  /**
   * Check if normalized reference exists in a collection (case-insensitive)
   * @description Performs case-insensitive search for a reference string within
   * a Set or Array of UI element names.
   * @param {string} normalized - Lowercase reference string to search for
   * @param {Set<string>|Array<string>} collection - Collection of UI element names
   * @returns {boolean} True if the reference exists in the collection
   * @example
   * existsInCollection('save', new Set(['Save', 'Cancel'])) // returns true
   */
  existsInCollection(normalizedReference, collection) {
    for (const item of collection) {
      if (item.toLowerCase() === normalizedReference) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if normalized reference exists in any dropdown options
   * @description Searches through all dropdown option sets to find a matching
   * reference. Used to verify that documented dropdown options actually exist.
   * @param {string} normalized - Lowercase reference string to search for
   * @returns {boolean} True if the reference exists in any dropdown's options
   * @example
   * existsInDropdownOptions('github') // returns true if 'GitHub' is in any dropdown
   */
  existsInDropdownOptions(normalized) {
    for (const [, options] of this.uiElements.dropdownOptions) {
      if (this.existsInCollection(normalized, options)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a reference matches any known UI element
   * @description Searches all UI element collections (buttons, titles, labels,
   * dropdown options) to determine if a documentation reference is valid.
   * @param {string} normalized - Lowercase reference string to search for
   * @returns {boolean} True if the reference matches any known UI element
   * @example
   * findUIElement('save') // returns true if 'Save' exists in any UI collection
   */
  findUIElement(normalized) {
    return this.existsInCollection(normalized, this.uiElements.buttons) ||
           this.existsInCollection(normalized, this.uiElements.titles) ||
           this.existsInCollection(normalized, this.uiElements.labels) ||
           this.existsInDropdownOptions(normalized);
  }

  /**
   * Add error for unmatched UI reference
   * @description Records an error when a documentation reference doesn't match
   * any known UI element. Includes fuzzy match suggestions if available.
   * @param {Object} ref - Reference object containing file, line, reference text, and context
   * @param {string} normalized - Lowercase normalized reference string
   * @param {string} projectRoot - Project root path for creating relative file paths
   * @returns {void}
   */
  addUnmatchedError(ref, normalized, projectRoot) {
    const suggestions = this.findSimilar(normalized);
    const relativePath = path.relative(projectRoot, ref.file);

    this.errors.push({
      file: relativePath,
      line: ref.line,
      reference: ref.reference,
      context: ref.context,
      message: `UI element "${ref.reference}" not found in index.html`,
      suggestions: suggestions.length > 0 ? suggestions : null,
    });
  }

  /**
   * Verify UI element references
   * @description Checks all documentation references against known UI elements
   * and file paths. Populates the errors array with any mismatches found.
   * @param {string} projectRoot - Project root path for file resolution
   * @returns {void}
   * @example
   * verifier.verifyReferences('/path/to/project');
   */
  verifyReferences(projectRoot) {
    console.log(`${colors.cyan}Verifying references...${colors.reset}`);

    const uniqueRefs = new Map();

    for (const ref of this.docReferences) {
      if (ref.pattern === 'file-reference') {
        this.verifyFileReference(ref, projectRoot);
        continue;
      }

      const refKey = `${ref.reference.toLowerCase()}:${ref.file}:${ref.line}`;
      if (uniqueRefs.has(refKey)) {
        continue;
      }
      uniqueRefs.set(refKey, true);

      const normalized = ref.reference.toLowerCase().trim();
      if (!this.findUIElement(normalized)) {
        this.addUnmatchedError(ref, normalized, projectRoot);
      }
    }
  }

  /**
   * Verify file reference exists
   * @description Checks if a file path referenced in documentation actually exists.
   * Skips validation for example URLs and placeholder paths.
   * @param {Object} ref - Reference object containing file path and metadata
   * @param {string} projectRoot - Project root path for file resolution
   * @returns {void}
   */
  verifyFileReference(ref, projectRoot) {
    // Extract clean path
    let filePath = ref.reference.trim();

    // Skip example URLs and placeholder paths
    const examplePatterns = [
      /(?:^|\/\/)example\.com\b/i,
      /(?:^|\/\/)username\.github\b/i,
      /(?:^|\/\/)username\.gitlab\b/i,
      /(?:^|\/)\buser\/repo\b/i,
      /(?:^|\/)\borg\/repo\b/i,
      /\byour-org\b/i,
      /(?:^|\/\/)例え\.jp\b/i, // Japanese example domain
      /(?:^|\/\/)cdn\.example\b/i,
      /\bdocs\/(api|guide|guides|faq|start|file|readme)\.md$/i, // Common example filenames
    ];

    for (const pattern of examplePatterns) {
      if (pattern.test(ref.context) || pattern.test(filePath)) {
        return; // Skip validation for example URLs
      }
    }

    // Handle various formats: docs/file.md, /docs/file.md, (docs/file.md)
    filePath = filePath.replace(/^\//, '');

    const fullPath = path.join(projectRoot, filePath);

    if (!fs.existsSync(fullPath)) {
      const relativePath = path.relative(projectRoot, ref.file);
      this.errors.push({
        file: relativePath,
        line: ref.line,
        reference: ref.reference,
        context: ref.context,
        message: `Referenced file "${filePath}" does not exist`,
        suggestions: null,
      });
    }
  }

  /**
   * Find similar UI elements (fuzzy matching)
   * @description Uses string similarity calculation to find UI elements that
   * closely match an unmatched reference. Helpful for suggesting corrections.
   * @param {string} needle - Lowercase reference string to find matches for
   * @returns {string[]} Array of up to 3 similar UI element names
   * @example
   * findSimilar('sav') // returns ['Save', 'Save as PDF']
   */
  findSimilar(needle) {
    const suggestions = [];
    const allElements = [
      ...this.uiElements.buttons,
      ...this.uiElements.labels,
      ...this.uiElements.titles,
    ];

    for (const element of allElements) {
      const similarity = this.calculateSimilarity(needle, element.toLowerCase());
      if (similarity > 0.6) {
        suggestions.push(element);
      }
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   * @description Computes similarity between two strings as a ratio (0-1) based
   * on Levenshtein edit distance. Higher values indicate greater similarity.
   * @param {string} s1 - First string to compare
   * @param {string} s2 - Second string to compare
   * @returns {number} Similarity ratio between 0 (completely different) and 1 (identical)
   * @example
   * calculateSimilarity('save', 'Save') // returns 1.0
   * calculateSimilarity('save', 'load') // returns 0.25
   */
  calculateSimilarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) {
      return 1;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   * @description Computes the minimum number of single-character edits (insertions,
   * deletions, or substitutions) required to change one string into another.
   * @param {string} s1 - First string
   * @param {string} s2 - Second string
   * @returns {number} Minimum number of edits required
   * @example
   * levenshteinDistance('kitten', 'sitting') // returns 3
   * levenshteinDistance('save', 'Save') // returns 0
   */
  levenshteinDistance(s1, s2) {
    const matrix = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  /**
   * Print report
   * @description Outputs a formatted report of all errors and warnings found during
   * verification. Includes file locations, context, and suggestions for fixes.
   * @returns {number} Exit code (0 for success, 1 if errors found)
   * @example
   * const exitCode = verifier.printReport();
   * process.exit(exitCode);
   */
  printReport() {
    console.log('\n' + '='.repeat(80));
    console.log(`${colors.bold}UI Reference Verification Report${colors.reset}`);
    console.log('='.repeat(80) + '\n');

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log(`${colors.green}${colors.bold}✓ All UI references verified successfully!${colors.reset}\n`);
      return 0;
    }

    if (this.errors.length > 0) {
      console.log(`${colors.red}${colors.bold}Errors (${this.errors.length}):${colors.reset}\n`);

      for (const error of this.errors) {
        console.log(`${colors.red}✗${colors.reset} ${colors.bold}${error.file}:${error.line}${colors.reset}`);
        console.log(`  ${error.message}`);
        console.log(`  ${colors.blue}Reference:${colors.reset} "${error.reference}"`);
        console.log(`  ${colors.blue}Context:${colors.reset} ${error.context}`);

        if (error.suggestions && error.suggestions.length > 0) {
          console.log(`  ${colors.yellow}Did you mean:${colors.reset} ${error.suggestions.join(', ')}`);
        }

        console.log();
      }
    }

    if (this.warnings.length > 0) {
      console.log(`${colors.yellow}${colors.bold}Warnings (${this.warnings.length}):${colors.reset}\n`);

      for (const warning of this.warnings) {
        console.log(`${colors.yellow}⚠${colors.reset} ${colors.bold}${warning.file}:${warning.line}${colors.reset}`);
        console.log(`  ${warning.message}`);
        console.log();
      }
    }

    console.log('='.repeat(80));
    console.log(`${colors.red}Found ${this.errors.length} error(s)${colors.reset}`);

    return this.errors.length > 0 ? 1 : 0;
  }

  /**
   * Main verification flow
   * @description Orchestrates the complete verification process: extracts UI elements
   * from HTML, extracts references from documentation, verifies matches, and prints
   * a report. This is the primary entry point for the verification tool.
   * @param {string} projectRoot - Absolute path to the project root directory
   * @returns {number} Exit code (0 for success, 1 if errors found)
   * @example
   * const verifier = new UIReferenceVerifier();
   * const exitCode = verifier.run('/path/to/project');
   * process.exit(exitCode);
   */
  run(projectRoot) {
    const htmlPath = path.join(projectRoot, 'index.html');
    const docsPath = path.join(projectRoot, 'docs');

    // Verify paths exist
    if (!fs.existsSync(htmlPath)) {
      console.error(`${colors.red}Error: index.html not found at ${htmlPath}${colors.reset}`);
      return 1;
    }

    if (!fs.existsSync(docsPath)) {
      console.error(`${colors.red}Error: docs directory not found at ${docsPath}${colors.reset}`);
      return 1;
    }

    // Extract and verify
    this.extractUIElements(htmlPath);
    this.extractDocReferences(docsPath);
    this.verifyReferences(projectRoot);

    // Print report
    return this.printReport();
  }
}

// Main execution
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd();
  const verifier = new UIReferenceVerifier();
  const exitCode = verifier.run(projectRoot);
  process.exit(exitCode);
}

module.exports = UIReferenceVerifier;
