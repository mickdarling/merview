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

const fs = require('fs');
const path = require('path');

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
   * @param {string} html - HTML content to search
   * @param {RegExp} regex - Regular expression pattern
   * @param {Function} processor - Function to process each match
   */
  extractMatches(html, regex, processor) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      processor(match);
    }
  }

  /**
   * Add known UI elements that require manual extraction
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
   */
  extractUIElements(htmlPath) {
    console.log(`${colors.cyan}Extracting UI elements from ${htmlPath}...${colors.reset}`);

    const html = fs.readFileSync(htmlPath, 'utf8');

    // Extract button text (visible text between button tags)
    const buttonRegex = /<button[^>]*>([^<]+)/gi;
    this.extractMatches(html, buttonRegex, (match) => {
      const text = match[1].trim().replace(/[🔍💾📄🔗📋🗑️✕]/gu, '').trim();
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

        // Pattern 4: File references - docs/*.md or paths
        const fileRefRegex = /\(?\/?docs\/[a-zA-Z0-9/_-]+\.md\)?/g;
        while ((match = fileRefRegex.exec(line)) !== null) {
          const docPath = match[0].replaceAll(/[()]/g, '');
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
   * Verify UI element references
   */
  verifyReferences(projectRoot) {
    console.log(`${colors.cyan}Verifying references...${colors.reset}`);

    const uniqueRefs = new Map(); // Track unique references to avoid duplicate reports

    for (const ref of this.docReferences) {
      // Skip file references for now (handle separately)
      if (ref.pattern === 'file-reference') {
        this.verifyFileReference(ref, projectRoot);
        continue;
      }

      // Create unique key for this reference
      const refKey = `${ref.reference.toLowerCase()}:${ref.file}:${ref.line}`;
      if (uniqueRefs.has(refKey)) {
        continue;
      }
      uniqueRefs.set(refKey, true);

      const normalized = ref.reference.toLowerCase().trim();
      let found = false;

      // Check buttons
      for (const button of this.uiElements.buttons) {
        if (button.toLowerCase() === normalized) {
          found = true;
          break;
        }
      }

      // Check titles
      if (!found) {
        for (const title of this.uiElements.titles) {
          if (title.toLowerCase() === normalized) {
            found = true;
            break;
          }
        }
      }

      // Check labels
      if (!found) {
        for (const label of this.uiElements.labels) {
          if (label.toLowerCase() === normalized) {
            found = true;
            break;
          }
        }
      }

      // Check dropdown options
      if (!found) {
        for (const [, options] of this.uiElements.dropdownOptions) {
          for (const option of options) {
            if (option.toLowerCase() === normalized) {
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      // Check for fuzzy matches to suggest corrections
      if (!found) {
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
    }
  }

  /**
   * Verify file reference exists
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
