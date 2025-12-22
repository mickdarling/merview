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
  CONTENT_LOAD: 2000, // Full content loading with diagrams
  // Derived timeouts for specific features
  MERMAID_LAZY_LOAD: 10000, // Mermaid diagrams use IntersectionObserver lazy loading
  VALIDATION_DEBOUNCE: 1000 // Code validation uses 500ms debounce + 500ms margin
};

/**
 * Mermaid diagram test constants
 * Used in mermaid-diagrams-demo.spec.js for consistent assertions
 */
const MERMAID_TEST_CONSTANTS = {
  // Total diagrams in test page (all valid diagrams, malformed moved to mermaid-errors.md)
  EXPECTED_DIAGRAM_COUNT: 37,
  // Minimum successfully rendered diagrams for tests to pass
  // Tolerance accounts for:
  // - Version differences in newer Mermaid features (block diagrams, etc.)
  // - Potential race conditions in async rendering
  // ~19% tolerance (37 → 30) is intentionally generous for CI stability
  MIN_RENDERED_DIAGRAMS: 30,
  // Max time to wait for all diagrams to render (generous for slow CI)
  RENDER_TIMEOUT: 15000,
  // Time to wait for Mermaid click handlers to attach after render
  CLICK_HANDLER_WAIT: 1000
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
  await page.evaluate(() => globalThis.loadWelcomePage());
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
 * Awaits the async renderMarkdown function, then waits for any pending state to clear
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} [timeout=5000] - Maximum time to wait for render completion (legacy values < 3000 are converted to 5000)
 * @param {boolean} [allowEmptyWrapper=true] - Whether to allow empty wrapper after rendering.
 *   Defaults to true for backward compatibility and because XSS tests legitimately produce
 *   empty wrappers when DOMPurify strips all malicious content. Pass false for stricter
 *   validation in tests where rendered content is always expected.
 * @returns {Promise<void>}
 */
async function renderMarkdownAndWait(page, timeout = 5000, allowEmptyWrapper = true) {
  // Backwards compatibility: old calls passed WAIT_TIMES.LONG (500ms) as a "wait time"
  const effectiveTimeout = timeout < 3000 ? 5000 : timeout;

  // Await the async renderMarkdown function
  await page.evaluate(async () => {
    if (typeof globalThis.renderMarkdown === 'function') {
      await globalThis.renderMarkdown();
    }
  });

  // Wait for wrapper to exist and optionally have content
  // allowEmptyWrapper=true: XSS tests where malicious content is fully sanitized
  // allowEmptyWrapper=false: Normal rendering tests where content should appear
  await page.waitForFunction((allowEmpty) => {
    const wrapper = document.getElementById('wrapper');
    if (wrapper === null) return false;
    // If empty wrapper is allowed, just check existence; otherwise require children
    return allowEmpty || wrapper.children.length > 0;
  }, allowEmptyWrapper, { timeout: effectiveTimeout });
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

/**
 * Get all tokens for a specific line from CodeMirror editor
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} line - Line number (0-indexed)
 * @returns {Promise<Array<{type: string, string: string, start: number, end: number}>>} Array of tokens
 */
async function getLineTokens(page, line) {
  return page.evaluate((lineNum) => {
    const cmElement = document.querySelector('.CodeMirror');
    const cm = cmElement?.CodeMirror;
    if (!cm) {
      throw new Error('CodeMirror instance not found');
    }
    const lineContent = cm.getLine(lineNum);
    if (lineContent === undefined) {
      return [];
    }
    const tokens = [];
    let pos = 0;
    while (pos < lineContent.length) {
      const token = cm.getTokenAt({ line: lineNum, ch: pos + 1 });
      tokens.push({
        type: token.type || '',
        string: token.string,
        start: token.start,
        end: token.end
      });
      pos = token.end;
    }
    return tokens;
  }, line);
}

/**
 * Check if a line has a specific token type
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} line - Line number (0-indexed)
 * @param {string} tokenType - Token type to check for (can be partial match)
 * @returns {Promise<boolean>} True if line contains the token type
 */
async function lineHasTokenType(page, line, tokenType) {
  const tokens = await getLineTokens(page, line);
  return tokens.some(token => token.type?.includes(tokenType));
}

/**
 * Set CodeMirror content and wait for it to be processed
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} content - Content to set
 * @returns {Promise<void>}
 */
async function setContentAndWait(page, content) {
  await setCodeMirrorContent(page, content);
  await page.waitForTimeout(WAIT_TIMES.SHORT);
}

/**
 * Check if a specific line has syntax highlighting
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} line - Line number (0-indexed)
 * @returns {Promise<boolean>} True if the line has highlighted tokens
 */
async function lineHasSyntaxHighlighting(page, line) {
  return page.evaluate((lineNum) => {
    const cmElement = document.querySelector('.CodeMirror');
    const cm = cmElement?.CodeMirror;
    if (!cm) {
      throw new Error('CodeMirror instance not found');
    }

    const lineContent = cm.getLine(lineNum);
    if (!lineContent) {
      return false;
    }

    // Check if any token in this line has a type (which means it's highlighted)
    let pos = 0;
    while (pos < lineContent.length) {
      const token = cm.getTokenAt({ line: lineNum, ch: pos + 1 });
      if (token.type) {
        return true;
      }
      pos = token.end;
    }

    return false;
  }, line);
}

/**
 * Find the line number containing specific text
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} searchText - Text to search for in line content
 * @returns {Promise<number>} Line number (0-indexed) or -1 if not found
 */
async function findLineWithText(page, searchText) {
  return page.evaluate((text) => {
    const cmElement = document.querySelector('.CodeMirror');
    const cm = cmElement?.CodeMirror;
    if (!cm) {
      throw new Error('CodeMirror instance not found');
    }

    const lineCount = cm.lineCount();
    for (let i = 0; i < lineCount; i++) {
      const lineContent = cm.getLine(i);
      if (lineContent?.includes(text)) {
        return i;
      }
    }
    return -1;
  }, searchText);
}

/**
 * Find the nth occurrence of a line with exact text match
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} searchText - Exact text to match
 * @param {number} occurrence - Which occurrence to find (1 = first, 2 = second, etc.)
 * @returns {Promise<number>} Line number (0-indexed) or -1 if not found
 */
async function findNthLineWithText(page, searchText, occurrence = 1) {
  return page.evaluate(({ text, n }) => {
    const cmElement = document.querySelector('.CodeMirror');
    const cm = cmElement?.CodeMirror;
    if (!cm) throw new Error('CodeMirror instance not found');
    const lineCount = cm.lineCount();
    let foundCount = 0;
    for (let i = 0; i < lineCount; i++) {
      const lineContent = cm.getLine(i);
      if (lineContent === text) {
        foundCount++;
        if (foundCount === n) return i;
      }
    }
    return -1;
  }, { text: searchText, n: occurrence });
}

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

/**
 * Wait for Mermaid diagrams to render with actual content
 * Verifies SVGs exist AND have rendered content (not just empty shells)
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {number} [minCount] - Minimum number of diagrams to wait for
 * @param {number} [timeout] - Maximum wait time in milliseconds
 * @returns {Promise<void>}
 */
async function waitForMermaidDiagrams(page, minCount = MERMAID_TEST_CONSTANTS.MIN_RENDERED_DIAGRAMS, timeout = MERMAID_TEST_CONSTANTS.RENDER_TIMEOUT) {
  await page.waitForFunction(
    (min) => {
      const svgs = document.querySelectorAll('.mermaid svg');
      if (svgs.length < min) return false;
      // Verify SVGs have actual content (not empty)
      let renderedCount = 0;
      for (const svg of svgs) {
        // An SVG with content will have child elements (g, path, text, etc.)
        if (svg.children.length > 0) {
          renderedCount++;
        }
      }
      return renderedCount >= min;
    },
    minCount,
    { timeout }
  );
}

/**
 * Known acceptable console errors for Mermaid rendering
 * These patterns are SPECIFIC to avoid masking critical errors like "Mermaid failed to initialize"
 */
const MERMAID_ACCEPTABLE_ERRORS = {
  // Resource loading errors (favicon, fonts, etc.)
  isResourceError: (err) => err.includes('net::ERR') || err.includes('Failed to load resource'),
  // 404 errors for non-critical resources only
  isMissingResource: (err) => err.includes('404') && (err.includes('favicon') || err.includes('.woff') || err.includes('.ttf')),
  // Mermaid deprecation warnings (not errors)
  isDeprecationWarning: (err) => err.includes('deprecated'),
  // Specific Mermaid render errors from our code (not initialization failures)
  isMermaidRenderError: (err) => err.includes('Mermaid render error:'),
  // Parsing errors from intentionally malformed test diagrams
  isParseError: (err) => err.includes('Parse error in') || err.includes('Syntax error in text'),
  // UnknownDiagramError from invalid diagram types in test page
  isUnknownDiagramError: (err) => err.includes('UnknownDiagramError')
};

/**
 * Filter console errors to find critical issues
 * Uses whitelist approach - only allows known acceptable errors
 * IMPORTANT: Patterns are specific to avoid masking critical failures
 *
 * @param {string[]} errors - Array of console error messages
 * @returns {string[]} Array of critical errors (not in acceptable list)
 */
function filterCriticalErrors(errors) {
  return errors.filter(err => {
    // Check against specific acceptable error patterns
    const isAcceptable =
      MERMAID_ACCEPTABLE_ERRORS.isResourceError(err) ||
      MERMAID_ACCEPTABLE_ERRORS.isMissingResource(err) ||
      MERMAID_ACCEPTABLE_ERRORS.isDeprecationWarning(err) ||
      MERMAID_ACCEPTABLE_ERRORS.isMermaidRenderError(err) ||
      MERMAID_ACCEPTABLE_ERRORS.isParseError(err) ||
      MERMAID_ACCEPTABLE_ERRORS.isUnknownDiagramError(err);

    return !isAcceptable;
  });
}

module.exports = {
  // Constants
  WAIT_TIMES,
  INIT_TIMEOUTS,
  MERMAID_TEST_CONSTANTS,

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
  getLineTokens,
  lineHasTokenType,
  setContentAndWait,
  lineHasSyntaxHighlighting,
  findLineWithText,
  findNthLineWithText,

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
  setupDialogListener,

  // Mermaid testing helpers
  waitForMermaidDiagrams,
  filterCriticalErrors,
  MERMAID_ACCEPTABLE_ERRORS
};
