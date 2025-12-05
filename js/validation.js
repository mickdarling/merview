/**
 * validation.js - Code Linting and Validation Module
 *
 * Provides code block validation functionality for JSON, JavaScript, HTML, and CSS.
 * Validates code blocks in the rendered preview and displays issues in the lint panel.
 */

import { state } from './state.js';
import { getElements } from './dom.js';

/**
 * Toggle the lint panel visibility
 * Updates state and triggers validation if enabling
 */
export function toggleLintPanel() {
    const { lintPanel, lintToggle } = getElements();

    state.lintEnabled = !state.lintEnabled;
    lintPanel.classList.toggle('show');
    lintToggle.classList.toggle('active');

    if (state.lintEnabled) {
        validateCode();
    }
}

/**
 * Validate all code blocks in the preview
 * Scans for code blocks with data-language attributes and validates based on language
 */
export function validateCode() {
    const { wrapper } = getElements();

    state.codeIssues = [];
    const codeBlocks = wrapper.querySelectorAll('pre code[data-language]');

    codeBlocks.forEach((block, index) => {
        const language = block.dataset.language;
        const code = block.textContent;

        // Validate based on language
        switch (language) {
            case 'json':
                validateJSON(code, index);
                break;
            case 'javascript':
            case 'js':
                validateJavaScript(code, index);
                break;
            case 'html':
                validateHTML(code, index);
                break;
            case 'css':
                validateCSS(code, index);
                break;
        }
    });

    updateLintPanel();
}

/**
 * Validate JSON code block
 * @param {string} code - The JSON code to validate
 * @param {number} blockIndex - The index of the code block
 */
function validateJSON(code, blockIndex) {
    try {
        JSON.parse(code);
    } catch (error) {
        state.codeIssues.push({
            type: 'error',
            language: 'JSON',
            block: blockIndex + 1,
            message: error.message
        });
    }
}

/**
 * Basic JavaScript validation
 * NOTE: JavaScript validation has been removed for security reasons.
 * Using Function constructor to validate JS code can execute arbitrary code.
 * For proper JS validation, use a dedicated linting tool like ESLint.
 * @param {string} code - The JavaScript code to validate
 * @param {number} blockIndex - The index of the code block
 */
function validateJavaScript(code, blockIndex) {
    // Disabled for security - would require a proper parser library
    // to validate without executing code
    return;
}

/**
 * Basic HTML validation
 * Checks for common HTML issues like unclosed tags and missing DOCTYPE
 * @param {string} code - The HTML code to validate
 * @param {number} blockIndex - The index of the code block
 */
function validateHTML(code, blockIndex) {
    // Check for common issues
    const issues = [];

    // Unclosed tags
    const openTags = code.match(/<(\w+)[^>]*>/g) || [];
    const closeTags = code.match(/<\/(\w+)>/g) || [];

    if (openTags.length !== closeTags.length) {
        issues.push('Possible unclosed HTML tags');
    }

    // Missing DOCTYPE in full HTML documents
    if (code.includes('<html') && !code.includes('<!DOCTYPE')) {
        issues.push('Missing DOCTYPE declaration');
    }

    issues.forEach(issue => {
        state.codeIssues.push({
            type: 'warning',
            language: 'HTML',
            block: blockIndex + 1,
            message: issue
        });
    });
}

/**
 * Basic CSS validation
 * Checks for mismatched braces in CSS code
 * @param {string} code - The CSS code to validate
 * @param {number} blockIndex - The index of the code block
 */
function validateCSS(code, blockIndex) {
    // Check for common issues
    const braceOpen = (code.match(/{/g) || []).length;
    const braceClose = (code.match(/}/g) || []).length;

    if (braceOpen !== braceClose) {
        state.codeIssues.push({
            type: 'error',
            language: 'CSS',
            block: blockIndex + 1,
            message: 'Mismatched braces'
        });
    }
}

/**
 * Update the lint panel with validation issues
 * Displays all issues or a success message if no issues found
 */
function updateLintPanel() {
    const { lintContent } = getElements();

    if (state.codeIssues.length === 0) {
        lintContent.innerHTML = '<p class="lint-empty">✅ No issues found in code blocks!</p>';
        return;
    }

    let html = '';
    state.codeIssues.forEach(issue => {
        html += `
            <div class="lint-issue ${issue.type}">
                <div class="lint-issue-header">
                    <span class="lint-issue-type">${issue.type.toUpperCase()}</span>
                    <span>${issue.language} - Block #${issue.block}</span>
                </div>
                <div class="lint-issue-message">${issue.message}</div>
            </div>
        `;
    });

    lintContent.innerHTML = html;
}
