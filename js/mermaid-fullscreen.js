/**
 * Mermaid Fullscreen Module
 *
 * Provides fullscreen viewing capability for Mermaid diagrams with zoom and pan functionality.
 * Extracted from index.html to modularize the codebase.
 */

import { state } from './state.js';

// Fullscreen overlay background colors
// Using 0.98 opacity (not 1.0) to allow subtle content hints behind the overlay
// while still providing enough contrast for diagram readability
const FULLSCREEN_BG_DARK = 'rgba(30, 30, 30, 0.98)';
const FULLSCREEN_BG_LIGHT = 'rgba(255, 255, 255, 0.98)';

// Mermaid themes that require a dark fullscreen background for readability
// Currently only 'dark' theme has light-colored diagram elements that need dark background
// NOTE: Update this Set if Mermaid adds new dark/high-contrast themes in the future
const DARK_MERMAID_THEMES = new Set(['dark']);

/**
 * Update fullscreen overlay background if it's currently open
 * Called when Mermaid theme changes to keep background in sync
 * @param {string} mermaidTheme - The new Mermaid theme value
 */
export function updateFullscreenBackground(mermaidTheme) {
    const overlay = document.getElementById('mermaid-fullscreen-overlay');
    if (overlay) {
        overlay.style.background = DARK_MERMAID_THEMES.has(mermaidTheme)
            ? FULLSCREEN_BG_DARK
            : FULLSCREEN_BG_LIGHT;
    }
}

/**
 * Open a Mermaid diagram in fullscreen mode with zoom/pan controls
 * @param {string} mermaidId - The ID of the mermaid element to expand
 */
export function expandMermaid(mermaidId) {
    const mermaidElement = document.getElementById(mermaidId);
    if (!mermaidElement) return;

    // Reset zoom state
    state.mermaidZoom = { scale: 1, panX: 0, panY: 0, isPanning: false, startX: 0, startY: 0 };

    // Clone the SVG content
    const svgContent = mermaidElement.innerHTML;

    // Determine appropriate background based on current Mermaid theme
    // Dark themes have light-colored diagram elements that need dark background for readability
    const bgColor = DARK_MERMAID_THEMES.has(state.mermaidTheme)
        ? FULLSCREEN_BG_DARK
        : FULLSCREEN_BG_LIGHT;

    // Create fullscreen overlay
    // Note: Using data attributes instead of inline onclick for consistency and future-proofing
    // (in case this content ever goes through sanitization)
    const overlay = document.createElement('div');
    overlay.className = 'mermaid-fullscreen-overlay';
    overlay.id = 'mermaid-fullscreen-overlay';
    // Apply dynamic background color via inline style to override CSS default
    overlay.style.background = bgColor;
    overlay.innerHTML = `
        <button class="mermaid-close-btn" data-action="close">✕ Close</button>
        <div class="mermaid-fullscreen-content" id="mermaid-pan-area">${svgContent}</div>
        <div class="mermaid-zoom-controls">
            <button class="mermaid-zoom-btn" data-action="zoom-in">+</button>
            <span class="mermaid-zoom-level" id="mermaid-zoom-level">100%</span>
            <button class="mermaid-zoom-btn" data-action="zoom-out">−</button>
            <button class="mermaid-zoom-btn" data-action="zoom-reset">Reset</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Attach event listeners for overlay controls
    overlay.querySelector('[data-action="close"]').addEventListener('click', closeMermaidFullscreen);
    overlay.querySelector('[data-action="zoom-in"]').addEventListener('click', mermaidZoomIn);
    overlay.querySelector('[data-action="zoom-out"]').addEventListener('click', mermaidZoomOut);
    overlay.querySelector('[data-action="zoom-reset"]').addEventListener('click', mermaidZoomReset);

    // Set up pan area
    const panArea = document.getElementById('mermaid-pan-area');
    const svg = panArea.querySelector('svg');

    if (svg) {
        // Make SVG fill the container initially
        svg.style.width = '100%';
        svg.style.height = '100%';
        updateMermaidTransform();
    }

    // Mouse wheel zoom
    panArea.addEventListener('wheel', handleMermaidWheel, { passive: false });

    // Pan with mouse drag
    panArea.addEventListener('mousedown', handleMermaidPanStart);
    document.addEventListener('mousemove', handleMermaidPanMove);
    document.addEventListener('mouseup', handleMermaidPanEnd);

    // Close on Escape key
    document.addEventListener('keydown', handleMermaidEscape);
}

/**
 * Update the transform (zoom and pan) of the Mermaid diagram in fullscreen mode
 */
function updateMermaidTransform() {
    const panArea = document.getElementById('mermaid-pan-area');
    if (!panArea) return;
    const svg = panArea.querySelector('svg');
    if (!svg) return;

    svg.style.transform = `translate(${state.mermaidZoom.panX}px, ${state.mermaidZoom.panY}px) scale(${state.mermaidZoom.scale})`;

    const zoomLevel = document.getElementById('mermaid-zoom-level');
    if (zoomLevel) {
        zoomLevel.textContent = Math.round(state.mermaidZoom.scale * 100) + '%';
    }
}

/**
 * Zoom in the Mermaid diagram (increase scale by 25%)
 */
function mermaidZoomIn() {
    state.mermaidZoom.scale = Math.min(state.mermaidZoom.scale * 1.25, 10);
    updateMermaidTransform();
}

/**
 * Zoom out the Mermaid diagram (decrease scale by 25%)
 */
function mermaidZoomOut() {
    state.mermaidZoom.scale = Math.max(state.mermaidZoom.scale / 1.25, 0.1);
    updateMermaidTransform();
}

/**
 * Reset zoom and pan to default values
 */
function mermaidZoomReset() {
    state.mermaidZoom.scale = 1;
    state.mermaidZoom.panX = 0;
    state.mermaidZoom.panY = 0;
    updateMermaidTransform();
}

/**
 * Handle mouse wheel zoom events
 * @param {WheelEvent} e - The wheel event
 */
function handleMermaidWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    state.mermaidZoom.scale = Math.min(Math.max(state.mermaidZoom.scale * delta, 0.1), 10);
    updateMermaidTransform();
}

/**
 * Start panning the diagram (mouse down)
 * @param {MouseEvent} e - The mouse event
 */
function handleMermaidPanStart(e) {
    if (e.target.closest('.mermaid-zoom-controls')) return;
    state.mermaidZoom.isPanning = true;
    state.mermaidZoom.startX = e.clientX - state.mermaidZoom.panX;
    state.mermaidZoom.startY = e.clientY - state.mermaidZoom.panY;
}

/**
 * Continue panning the diagram (mouse move)
 * @param {MouseEvent} e - The mouse event
 */
function handleMermaidPanMove(e) {
    if (!state.mermaidZoom.isPanning) return;
    state.mermaidZoom.panX = e.clientX - state.mermaidZoom.startX;
    state.mermaidZoom.panY = e.clientY - state.mermaidZoom.startY;
    updateMermaidTransform();
}

/**
 * End panning the diagram (mouse up)
 */
function handleMermaidPanEnd() {
    state.mermaidZoom.isPanning = false;
}

/**
 * Close the Mermaid fullscreen overlay
 */
export function closeMermaidFullscreen() {
    const overlay = document.getElementById('mermaid-fullscreen-overlay');
    if (overlay) {
        overlay.remove();
    }
    document.removeEventListener('keydown', handleMermaidEscape);
    document.removeEventListener('mousemove', handleMermaidPanMove);
    document.removeEventListener('mouseup', handleMermaidPanEnd);
}

/**
 * Handle Escape key to close fullscreen
 * @param {KeyboardEvent} e - The keyboard event
 */
function handleMermaidEscape(e) {
    if (e.key === 'Escape') {
        closeMermaidFullscreen();
    }
}

/**
 * Initialize the Mermaid fullscreen functionality
 * Exposes functions globally for onclick handlers in the overlay
 */
export function initMermaidFullscreen() {
    // Expose functions globally for onclick handlers in the dynamically created overlay
    globalThis.expandMermaid = expandMermaid;
    globalThis.closeMermaidFullscreen = closeMermaidFullscreen;
    globalThis.mermaidZoomIn = mermaidZoomIn;
    globalThis.mermaidZoomOut = mermaidZoomOut;
    globalThis.mermaidZoomReset = mermaidZoomReset;
}
