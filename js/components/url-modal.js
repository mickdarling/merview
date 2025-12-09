/**
 * URL Input Modal Component
 *
 * Provides a reusable, accessible modal for URL input that replaces browser prompt().
 * Features:
 * - Dynamic title based on context
 * - URL validation against allowed domains
 * - Keyboard accessibility (Escape to close, Tab for focus trap)
 * - ARIA attributes for screen readers
 * - Returns focus to trigger element on close
 */

import { ALLOWED_CSS_DOMAINS } from '../config.js';
import { isAllowedCSSURL, normalizeGistUrl } from '../security.js';

// Modal state
let currentResolve = null;
let triggerElement = null;
let currentAllowedDomains = ALLOWED_CSS_DOMAINS;

// Delay for focusing input after modal opens (allows animation/rendering)
const MODAL_FOCUS_DELAY_MS = 100;

/**
 * Show the URL input modal
 * @param {Object} options - Modal configuration
 * @param {string} options.title - Modal title (e.g., "Load Style from URL")
 * @param {string} options.placeholder - Input placeholder text
 * @param {Array<string>} [options.allowedDomains] - List of allowed domains (defaults to ALLOWED_CSS_DOMAINS)
 * @returns {Promise<string|null>} Resolves with URL or null if cancelled
 */
export function showURLModal({ title, placeholder, allowedDomains = ALLOWED_CSS_DOMAINS }) {
    return new Promise((resolve) => {
        const modal = document.getElementById('urlModal');
        if (!modal) {
            console.error('URL modal not found in DOM');
            resolve(null);
            return;
        }

        // Handle race condition: if modal is already open, resolve previous promise first
        if (modal.open && currentResolve) {
            const prevResolve = currentResolve;
            currentResolve = null;
            prevResolve(null);
        }

        // Store the element that triggered the modal for focus restoration
        triggerElement = document.activeElement;

        // Store resolve and allowed domains for later use
        currentResolve = resolve;
        currentAllowedDomains = allowedDomains;

        // Update modal content
        const modalTitle = document.getElementById('urlModalTitle');
        const urlInput = document.getElementById('urlInput');
        const domainList = document.getElementById('urlModalDomains');
        const errorDiv = document.getElementById('urlModalError');

        if (modalTitle) {
            modalTitle.textContent = title;
        }

        if (urlInput) {
            urlInput.value = '';
            urlInput.placeholder = placeholder || 'https://example.com/file.css';
        }

        // Clear any previous error
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.style.display = 'none';
        }

        // Populate domain list safely (XSS defense in depth)
        if (domainList && allowedDomains) {
            domainList.innerHTML = '';
            allowedDomains.forEach(domain => {
                const li = document.createElement('li');
                li.textContent = domain;
                domainList.appendChild(li);
            });
        }

        // Show modal
        modal.showModal();

        // Focus input after a short delay to ensure modal is visible
        setTimeout(() => {
            if (urlInput) {
                urlInput.focus();
                urlInput.select();
            }
        }, MODAL_FOCUS_DELAY_MS);
    });
}

/**
 * Show an error message in the modal
 * @param {string} message - Error message to display
 */
function showModalError(message) {
    const errorDiv = document.getElementById('urlModalError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

/**
 * Clear the error message in the modal
 */
function clearModalError() {
    const errorDiv = document.getElementById('urlModalError');
    if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
    }
}

/**
 * Hide the URL input modal
 */
export function hideURLModal() {
    const modal = document.getElementById('urlModal');
    if (modal?.open) {
        modal.close();
    }

    // Restore focus to trigger element
    triggerElement?.focus?.();
    triggerElement = null;
}

/**
 * Initialize URL modal event handlers
 * Should be called once during app initialization
 */
export function initURLModalHandlers() {
    const modal = document.getElementById('urlModal');
    if (!modal) {
        console.warn('URL modal not found in DOM');
        return;
    }

    const urlInput = document.getElementById('urlInput');
    const loadBtn = document.getElementById('urlModalLoad');
    const cancelBtn = document.getElementById('urlModalCancel');

    // Handle Load button click
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            if (urlInput && currentResolve) {
                const url = urlInput.value.trim();

                // Validate empty URL
                if (!url) {
                    showModalError('Please enter a URL');
                    urlInput.focus();
                    return;
                }

                // Normalize gist URLs and validate against allowed domains
                const normalizedUrl = normalizeGistUrl(url);
                if (!isAllowedCSSURL(normalizedUrl)) {
                    showModalError(`URL not allowed. Use: ${currentAllowedDomains.join(', ')}`);
                    urlInput.focus();
                    return;
                }

                // Clear error, resolve and close
                clearModalError();
                const resolve = currentResolve;
                currentResolve = null;
                hideURLModal();
                resolve(url);
            }
        });
    }

    // Handle Cancel button click
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (currentResolve) {
                const resolve = currentResolve;
                currentResolve = null;
                hideURLModal();
                resolve(null);
            }
        });
    }

    // Handle Enter key in input
    if (urlInput) {
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (loadBtn) {
                    loadBtn.click();
                }
            }
        });
    }

    // Handle close event (Escape key, backdrop click, or .close() call)
    // Note: This single handler covers all closure methods, no need for separate backdrop handler
    modal.addEventListener('close', () => {
        clearModalError();
        if (currentResolve) {
            const resolve = currentResolve;
            currentResolve = null;
            resolve(null);
        }
        // Restore focus to trigger element
        triggerElement?.focus?.();
        triggerElement = null;
    });

    // Focus trap within modal (comprehensive selector for accessibility)
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            const focusableElements = modal.querySelectorAll(
                'input:not([disabled]), button:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    });
}
