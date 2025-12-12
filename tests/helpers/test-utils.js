// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check

/**
 * Shared test utilities for Playwright tests
 *
 * This module provides common utilities to reduce code duplication across test files:
 * - Page setup and initialization
 * - Common wait patterns
 * - Assertion helpers
 * - CodeMirror access utilities
 */

/**
 * Standard timeout values for consistent wait times across tests
 */
const WAIT_TIMES = {
  SHORT: 100,         // UI responses, event handlers
  MEDIUM: 300,        // CSS transitions (lint panel = 300ms)
  LONG: 500,          // Content rendering, async operations
  EXTRA_LONG: 1000,   // Heavy async ops, mermaid rendering
  CONTENT_LOAD: 2000  // Full content loading with diagrams
};

/**
 * Standard timeout values for page initialization
 */
const INIT_TIMEOUTS = {
  CODEMIRROR: 15000,     // CodeMirror initialization
  FUNCTION_READY: 5000   // Global function availability
};

/**
 * Wait for the page to be fully ready with CodeMirror initialized
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} options - Configuration options
 * @param {string} [options.url='/'] - URL to navigate to
 * @param {number} [options.codeMirrorTimeout=15000] - Timeout for CodeMirror init
 * @returns {Promise<void>}
 */
async function waitForPageReady(page, options = {}) {
  const {
    url = '/',
    codeMirrorTimeout = INIT_TIMEOUTS.CODEMIRROR
  } = options;

  await page.goto(url);
  await page.waitForSelector('.CodeMirror', { timeout: codeMirrorTimeout });
}

/**
 * Wait for a global function to be available
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} functionName - Name of the global function to wait for
 * @param {number} [timeout=5000] - Maximum wait time
 * @returns {Promise<void>}
 */
async function waitForGlobalFunction(page, functionName, timeout = INIT_TIMEOUTS.FUNCTION_READY) {
  await page.waitForFunction(
    (fnName) => typeof globalThis[fnName] === 'function',
    functionName,
    { timeout }
  );
}

/**
 * Wait for multiple global functions to be available
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string[]} functionNames - Array of function names to wait for
 * @param {number} [timeout=5000] - Maximum wait time
 * @returns {Promise<void>}
 */
async function waitForGlobalFunctions(page, functionNames, timeout = INIT_TIMEOUTS.FUNCTION_READY) {
  await page.waitForFunction(
    (fnNames) => fnNames.every(name => typeof globalThis[name] === 'function'),
    functionNames,
    { timeout }
  );
}

/**
 * Wait for a DOM element to exist
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - CSS selector
 * @param {number} [timeout=5000] - Maximum wait time
 * @returns {Promise<void>}
 */
async function waitForElement(page, selector, timeout = INIT_TIMEOUTS.FUNCTION_READY) {
  await page.waitForSelector(selector, { timeout });
}

/**
 * Wait for an element to have a specific class
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - CSS selector
 * @param {string} className - Class to wait for
 * @param {number} [timeout=5000] - Maximum wait time
 * @returns {Promise<void>}
 */
async function waitForElementClass(page, selector, className, timeout = INIT_TIMEOUTS.FUNCTION_READY) {
  await page.waitForFunction(
    ({ sel, cls }) => {
      const el = document.querySelector(sel);
      return el?.classList.contains(cls);
    },
    { sel: selector, cls: className },
    { timeout }
  );
}

/**
 * Wait for an element to NOT have a specific class
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - CSS selector
 * @param {string} className - Class to wait for removal
 * @param {number} [timeout=5000] - Maximum wait time
 * @returns {Promise<void>}
 */
async function waitForElementClassRemoved(page, selector, className, timeout = INIT_TIMEOUTS.FUNCTION_READY) {
  await page.waitForFunction(
    ({ sel, cls }) => {
      const el = document.querySelector(sel);
      return el && !el.classList.contains(cls);
    },
    { sel: selector, cls: className },
    { timeout }
  );
}

/**
 * Get CodeMirror editor content
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string|null>} Editor content or null if not available
 */
async function getCodeMirrorContent(page) {
  return page.evaluate(() => {
    const cmElement = document.querySelector('.CodeMirror');
    const cmEditor = cmElement?.CodeMirror;
    return cmEditor ? cmEditor.getValue() : null;
  });
}

/**
 * Set CodeMirror editor content
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} content - Content to set
 * @returns {Promise<boolean>} True if content was set successfully
 */
async function setCodeMirrorContent(page, content) {
  return page.evaluate((text) => {
    const cmElement = document.querySelector('.CodeMirror');
    const cmEditor = cmElement?.CodeMirror;
    if (cmEditor) {
      cmEditor.setValue(text);
      return true;
    }
    return false;
  }, content);
}

/**
 * Clear CodeMirror editor content
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>} True if content was cleared successfully
 */
async function clearCodeMirrorContent(page) {
  return setCodeMirrorContent(page, '');
}

/**
 * Check if a global function exists
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} functionName - Name of the function to check
 * @returns {Promise<boolean>} True if function exists
 */
async function isGlobalFunctionAvailable(page, functionName) {
  return page.evaluate(
    (fnName) => typeof globalThis[fnName] === 'function',
    functionName
  );
}

/**
 * Check if a DOM element exists
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - CSS selector
 * @returns {Promise<boolean>} True if element exists
 */
async function elementExists(page, selector) {
  const element = await page.$(selector);
  return element !== null;
}

/**
 * Get an element's attribute value
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - CSS selector
 * @param {string} attribute - Attribute name
 * @returns {Promise<string|null>} Attribute value or null
 */
async function getElementAttribute(page, selector, attribute) {
  return page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
}

/**
 * Check if an element has a specific class
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - CSS selector
 * @param {string} className - Class name to check
 * @returns {Promise<boolean>} True if element has the class
 */
async function elementHasClass(page, selector, className) {
  return page.$eval(
    selector,
    (el, cls) => el.classList.contains(cls),
    className
  );
}

/**
 * Wrapper population timeout
 */
const WRAPPER_POPULATION_TIMEOUT_MS = 5000;

/**
 * Load sample content and wait for render
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} [waitTime=500] - Time to wait after loading
 * @returns {Promise<void>}
 */
async function loadSampleContent(page, waitTime = WAIT_TIMES.LONG) {
  await page.evaluate(() => globalThis.loadSample());
  // Use waitForFunction instead of arbitrary timeout where possible
  await page.waitForFunction(() => {
    const minLength = 0;
    const wrapper = document.getElementById('wrapper');
    return wrapper && wrapper.innerHTML.trim().length > minLength;
  }, { timeout: WRAPPER_POPULATION_TIMEOUT_MS }).catch(() => {
    // Fallback to timeout if wrapper doesn't populate quickly
  });
  if (waitTime > 0) {
    await page.waitForTimeout(waitTime);
  }
}

/**
 * Render markdown and wait for completion
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} [waitTime=500] - Time to wait after rendering
 * @returns {Promise<void>}
 */
async function renderMarkdownAndWait(page, waitTime = WAIT_TIMES.LONG) {
  await page.evaluate(() => {
    if (typeof globalThis.renderMarkdown === 'function') {
      globalThis.renderMarkdown();
    }
  });
  if (waitTime > 0) {
    await page.waitForTimeout(waitTime);
  }
}

/**
 * Default transition buffer time
 */
const DEFAULT_TRANSITION_BUFFER_MS = 50;

/**
 * Default status observation timeout
 */
const DEFAULT_STATUS_OBSERVATION_TIMEOUT_MS = 200;

/**
 * Click an element and wait for CSS transition
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - CSS selector of element to click
 * @param {number} [transitionTime=350] - CSS transition duration + buffer
 * @returns {Promise<void>}
 */
async function clickAndWaitForTransition(page, selector, transitionTime = WAIT_TIMES.MEDIUM + DEFAULT_TRANSITION_BUFFER_MS) {
  await page.click(selector);
  await page.waitForTimeout(transitionTime);
}

/**
 * Browser-side helper factory: Create a status observer for capturing status messages
 * Returns a string that can be evaluated in the browser context
 * @param {string} searchText - Text to search for in status messages
 * @param {number} [timeout=200] - Timeout for observation
 * @returns {string} Browser-executable function string
 */
function createStatusObserverScript(searchText, timeout = DEFAULT_STATUS_OBSERVATION_TIMEOUT_MS) {
  return `
    return new Promise(function(resolve) {
      let statusMessage = null;
      const statusElement = document.getElementById('status');
      const observer = new MutationObserver(function() {
        const text = statusElement.textContent;
        if (text && text.includes('${searchText}')) {
          statusMessage = text;
        }
      });
      observer.observe(statusElement, { childList: true, subtree: true, characterData: true });
      setTimeout(function() {
        observer.disconnect();
        resolve(statusMessage);
      }, ${timeout});
    });
  `;
}

module.exports = {
  // Constants
  WAIT_TIMES,
  INIT_TIMEOUTS,

  // Page setup
  waitForPageReady,
  waitForGlobalFunction,
  waitForGlobalFunctions,
  waitForElement,
  waitForElementClass,
  waitForElementClassRemoved,

  // CodeMirror utilities
  getCodeMirrorContent,
  setCodeMirrorContent,
  clearCodeMirrorContent,

  // Element checks
  isGlobalFunctionAvailable,
  elementExists,
  getElementAttribute,
  elementHasClass,

  // Content helpers
  loadSampleContent,
  renderMarkdownAndWait,
  clickAndWaitForTransition,

  // Browser-side helpers
  createStatusObserverScript,

  // Security testing helpers
  setupDialogListener
};

/**
 * Set up dialog listener to detect script execution (for XSS testing)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {{wasTriggered: () => boolean}} Object with trigger check function
 */
function setupDialogListener(page) {
  let triggered = false;
  page.on('dialog', async d => { triggered = true; await d.dismiss(); });
  return { wasTriggered: () => triggered };
}
