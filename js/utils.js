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
 * Parse a color string to RGB values
 * Supports hex (#fff, #ffffff), rgb(), rgba(), and common named colors
 * @param {string} colorString - CSS color value
 * @returns {{r: number, g: number, b: number}|null} RGB values (0-255) or null if unparseable
 */
export function parseColorToRGB(colorString) {
    if (!colorString || typeof colorString !== 'string') return null;

    const color = colorString.trim().toLowerCase();

    // Named colors (common dark/light ones)
    const namedColors = {
        'white': { r: 255, g: 255, b: 255 },
        'black': { r: 0, g: 0, b: 0 },
        'transparent': { r: 255, g: 255, b: 255 }, // Treat transparent as white
        'darkgray': { r: 169, g: 169, b: 169 },
        'darkgrey': { r: 169, g: 169, b: 169 },
        'lightgray': { r: 211, g: 211, b: 211 },
        'lightgrey': { r: 211, g: 211, b: 211 },
        'gray': { r: 128, g: 128, b: 128 },
        'grey': { r: 128, g: 128, b: 128 },
    };

    if (namedColors[color]) {
        return namedColors[color];
    }

    // Hex color (#fff or #ffffff)
    const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
        };
    }

    // RGB/RGBA color
    const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1], 10),
            g: parseInt(rgbMatch[2], 10),
            b: parseInt(rgbMatch[3], 10)
        };
    }

    return null; // Cannot parse (CSS variables, gradients, etc.)
}

/**
 * Calculate relative luminance (brightness) of a color
 * Uses WCAG formula for perceptual brightness
 * @param {string} colorString - CSS color value
 * @returns {number} Brightness value 0 (black) to 255 (white), or 127.5 if unparseable
 */
export function getBrightness(colorString) {
    const rgb = parseColorToRGB(colorString);
    if (!rgb) return 127.5; // Default to medium if parse fails

    // WCAG relative luminance formula (weighted for human perception)
    return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

/**
 * Determine if a color is dark (for theme selection)
 * @param {string} colorString - CSS color value
 * @returns {boolean} True if dark, false if light or unparseable
 */
export function isDarkColor(colorString) {
    return getBrightness(colorString) < 127.5;
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
