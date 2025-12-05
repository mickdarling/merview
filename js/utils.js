/**
 * Utility functions for Merview
 * @module utils
 */

import { getElements } from './dom.js';

/**
 * Escape HTML entities to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML text
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Convert text to URL-safe slug
 * @param {string} text - Text to slugify
 * @returns {string} URL-safe slug
 */
export function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replaceAll(/[^\w\s-]/g, '')   // Remove special chars (keeps letters, numbers, underscore, hyphen, space)
        .replaceAll(/[\s_]+/g, '-')    // Replace spaces and underscores with hyphens
        .replaceAll(/-+/g, '-')        // Collapse multiple hyphens
        .replaceAll(/(^-)|(-$)/g, '');     // Trim leading/trailing hyphens
}

/**
 * Show status message to user
 * @param {string} message - Message to display
 * @param {string} type - Message type ('success' or 'warning')
 */
export function showStatus(message, type = 'success') {
    const { statusDiv } = getElements();
    statusDiv.textContent = message;
    statusDiv.classList.remove('warning');
    if (type === 'warning') {
        statusDiv.classList.add('warning');
    }
    statusDiv.classList.add('show');
    // Warnings show longer (6s) than success messages (3s)
    const duration = type === 'warning' ? 6000 : 3000;
    setTimeout(() => {
        statusDiv.classList.remove('show', 'warning');
    }, duration);
}
