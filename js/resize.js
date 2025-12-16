/**
 * resize.js
 * Panel resize functionality for editor/preview split view
 * Allows users to drag the resize handle to adjust panel widths
 */

import { getElements } from './dom.js';

// Track resize state (module-local)
// Note: This is intentionally NOT in state.js because:
// - It's only used within this module (startResize, handleResize, stopResize)
// - No other modules need to read or write this value
// - Keeping it local reduces coupling and makes the code easier to reason about
let isResizing = false;

// Initialization guard to prevent duplicate event listeners
let initialized = false;

/**
 * Start resizing - called on mousedown or touchstart on resize handle
 */
function startResize(e) {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
}

/**
 * Handle resize - called on mousemove or touchmove when resizing
 */
function handleResize(e) {
    if (!isResizing) return;

    const elements = getElements();
    const container = elements.container;
    const editorPanel = elements.editorPanel;
    const previewPanel = elements.previewPanel;

    if (!container || !editorPanel || !previewPanel) return;

    // Get container bounds
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;

    // Get X position from either mouse or touch event
    // Defensive check for touches array length handles edge cases like multi-touch interference
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const mouseX = clientX - containerRect.left;

    // Calculate percentage width for editor panel
    const editorPercentage = (mouseX / containerWidth) * 100;

    // Minimum panel width in pixels
    const minWidth = 200;
    const minPercentage = (minWidth / containerWidth) * 100;
    const maxPercentage = 100 - minPercentage;

    // Clamp the percentage to ensure both panels meet minimum width
    const clampedPercentage = Math.max(minPercentage, Math.min(maxPercentage, editorPercentage));

    // Apply flex-basis to both panels
    editorPanel.style.flexBasis = `${clampedPercentage}%`;
    previewPanel.style.flexBasis = `${100 - clampedPercentage}%`;

    // Prevent scrolling on touch devices
    if (e.touches) {
        e.preventDefault();
    }
}

/**
 * Stop resizing - called on mouseup or touchend
 */
function stopResize() {
    if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
}

/**
 * Initialize resize handle functionality
 * Sets up event listeners for panel resizing (mouse and touch)
 */
export function initResizeHandle() {
    // Prevent duplicate listeners if called multiple times
    if (initialized) return;
    initialized = true;

    const elements = getElements();
    const resizeHandle = elements.resizeHandle;

    if (!resizeHandle) {
        console.warn('Resize handle element not found');
        return;
    }

    // Mouse events for resize handle
    resizeHandle.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);

    // Touch events for resize handle
    // Use { passive: false } to allow preventDefault() for preventing page scroll
    resizeHandle.addEventListener('touchstart', startResize, { passive: false });
    document.addEventListener('touchmove', handleResize, { passive: false });
    document.addEventListener('touchend', stopResize);
    document.addEventListener('touchcancel', stopResize);
}
