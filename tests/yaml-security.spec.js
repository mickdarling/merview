// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
    waitForPageReady,
    setCodeMirrorContent,
    renderMarkdownAndWait,
    WAIT_TIMES
} = require('./helpers/test-utils');

/**
 * Render markdown and return the YAML panel HTML (if present)
 * @param {import('@playwright/test').Page} page
 * @param {string} markdown
 * @returns {Promise<string|null>}
 */
async function renderAndGetYamlHtml(page, markdown) {
    await setCodeMirrorContent(page, markdown);
    await renderMarkdownAndWait(page, WAIT_TIMES.LONG);
    const panel = await page.$('.yaml-front-matter');
    if (!panel) return null;
    return panel.innerHTML();
}

/**
 * Check if YAML panel exists after rendering
 * @param {import('@playwright/test').Page} page
 * @param {string} markdown
 * @returns {Promise<boolean>}
 */
async function yamlPanelExists(page, markdown) {
    await setCodeMirrorContent(page, markdown);
    await renderMarkdownAndWait(page, WAIT_TIMES.LONG);
    const panel = await page.$('.yaml-front-matter');
    return panel !== null;
}

/**
 * Set up dialog listener to detect script execution
 * @param {import('@playwright/test').Page} page
 * @returns {{wasTriggered: () => boolean}}
 */
function setupDialogListener(page) {
    let triggered = false;
    page.on('dialog', async d => { triggered = true; await d.dismiss(); });
    return { wasTriggered: () => triggered };
}

test.describe('YAML Security Hardening', () => {
    test.beforeEach(async ({ page }) => {
        await waitForPageReady(page);
    });

    test.describe('Dangerous Pattern Rejection', () => {
        test('rejects YAML anchors (&anchor)', async ({ page }) => {
            // YAML anchor that could be used for billion laughs attack
            const yaml = `---
anchor: &bomb "BOOM"
title: Test
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            // The anchor line should be skipped, but title should render
            expect(html).not.toBeNull();
            expect(html).toContain('title');
            expect(html).not.toContain('anchor');
            expect(html).not.toContain('bomb');
        });

        test('rejects YAML aliases (*alias)', async ({ page }) => {
            // YAML alias reference
            const yaml = `---
ref: *bomb
title: Test
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            expect(html).toContain('title');
            expect(html).not.toContain('bomb');
        });

        test('rejects YAML custom tags (!tag)', async ({ page }) => {
            // YAML custom tag that could execute code
            const yaml = `---
dangerous: !ruby/object:Gem::Installer
title: Test
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            expect(html).toContain('title');
            expect(html).not.toContain('ruby');
            expect(html).not.toContain('Installer');
        });

        test('rejects YAML type tags (!!type)', async ({ page }) => {
            // YAML type tag
            const yaml = `---
binary: !!binary R0lGODlhAQABAIAAAAAAAP
title: Test
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            expect(html).toContain('title');
            expect(html).not.toContain('binary');
        });

        test('rejects billion laughs attack pattern', async ({ page }) => {
            // Classic billion laughs / YAML bomb structure
            const yaml = `---
a: &a ["lol","lol","lol"]
b: &b [*a,*a,*a]
c: &c [*b,*b,*b]
title: Safe
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            expect(html).toContain('title');
            expect(html).toContain('Safe');
            // All the bomb lines should be rejected
            expect(html).not.toContain('lol');
        });
    });

    test.describe('Legitimate Content Allowed', () => {
        test('allows ampersand in quoted strings', async ({ page }) => {
            const yaml = `---
author: "John & Jane Doe"
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            expect(html).toContain('John');
            expect(html).toContain('Jane');
        });

        test('allows asterisk in content (not at word boundary)', async ({ page }) => {
            const yaml = `---
rating: "5-star hotel"
note: "See footnote*"
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            expect(html).toContain('5-star');
            expect(html).toContain('footnote');
        });

        test('allows exclamation in quoted strings', async ({ page }) => {
            const yaml = `---
greeting: "Hello World!"
emphasis: "Important - Read this!"
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            expect(html).toContain('Hello');
            expect(html).toContain('Important');
        });

        test('allows math expressions', async ({ page }) => {
            const yaml = `---
formula: "a * b = c"
condition: "x > 0 && y < 10"
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            // Note: HTML escaping will convert & to &amp;
            expect(html).toContain('formula');
        });
    });

    test.describe('Size Limits', () => {
        test('truncates oversized values', async ({ page }) => {
            // Create a value exceeding MAX_VALUE_LENGTH (10000)
            const longValue = 'x'.repeat(15000);
            const yaml = `---
title: Test
long: "${longValue}"
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            expect(html).toContain('title');
            expect(html).toContain('[truncated]');
            // Should not contain the full 15000 chars
            expect(html.length).toBeLessThan(20000);
        });

        test('truncates oversized array items', async ({ page }) => {
            const longItem = 'y'.repeat(15000);
            const yaml = `---
title: Test
items:
  - short item
  - ${longItem}
  - another short
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            expect(html).toContain('short item');
            expect(html).toContain('[truncated]');
            expect(html).toContain('another short');
        });

        test('enforces max keys limit', async ({ page }) => {
            // Create YAML with more than MAX_KEYS (100) keys
            let yamlLines = ['---'];
            for (let i = 0; i < 110; i++) {
                yamlLines.push(`key${i}: value${i}`);
            }
            yamlLines.push('---', '# Content');
            const yaml = yamlLines.join('\n');

            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            // Should have first 100 keys
            expect(html).toContain('key0');
            expect(html).toContain('key99');
            // Should NOT have keys beyond limit
            expect(html).not.toContain('key100');
            expect(html).not.toContain('key109');
        });

        test('enforces max array items limit', async ({ page }) => {
            // Create YAML with more than MAX_ARRAY_ITEMS (500) items
            let yamlLines = ['---', 'title: Test', 'items:'];
            for (let i = 0; i < 510; i++) {
                yamlLines.push(`  - item${i}`);
            }
            yamlLines.push('---', '# Content');
            const yaml = yamlLines.join('\n');

            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            // Should have first 500 items
            expect(html).toContain('item0');
            expect(html).toContain('item499');
            // Should NOT have items beyond limit
            expect(html).not.toContain('item500');
            expect(html).not.toContain('item509');
        });
    });

    test.describe('XSS Prevention in YAML', () => {
        test('escapes script tags in values', async ({ page }) => {
            const listener = setupDialogListener(page);
            const yaml = `---
title: "<script>alert('XSS')</script>"
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            expect(html).not.toContain('<script>');
            await page.waitForTimeout(WAIT_TIMES.SHORT);
            expect(listener.wasTriggered()).toBe(false);
        });

        test('escapes event handlers in values', async ({ page }) => {
            const listener = setupDialogListener(page);
            const yaml = `---
image: "<img src=x onerror=alert(1)>"
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            // Content should be HTML-escaped (< becomes &lt;), not rendered as actual img tag
            expect(html).not.toContain('<img');
            expect(html).toContain('&lt;img');
            await page.waitForTimeout(WAIT_TIMES.LONG);
            // Most importantly: no script execution
            expect(listener.wasTriggered()).toBe(false);
        });

        test('escapes javascript URLs in values', async ({ page }) => {
            const yaml = `---
link: "<a href='javascript:alert(1)'>click</a>"
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            // Content should be HTML-escaped - no actual anchor tag rendered
            expect(html).not.toContain('<a href');
            expect(html).toContain('&lt;a');
        });

        test('escapes HTML entities in keys', async ({ page }) => {
            const yaml = `---
"<b>bold</b>": value
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            // Key should be escaped, not rendered as bold
            if (html) {
                expect(html).not.toContain('<b>bold</b>');
            }
        });

        test('escapes iframe injection', async ({ page }) => {
            const yaml = `---
embed: "<iframe src='https://evil.com'></iframe>"
---
# Content`;
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            expect(html).not.toContain('<iframe');
        });
    });

    test.describe('Edge Cases', () => {
        test('handles empty front matter gracefully', async ({ page }) => {
            const yaml = `---
---
# Content`;
            const exists = await yamlPanelExists(page, yaml);
            expect(exists).toBe(false);
        });

        test('handles front matter with only comments', async ({ page }) => {
            const yaml = `---
# This is a comment
# Another comment
---
# Content`;
            const exists = await yamlPanelExists(page, yaml);
            expect(exists).toBe(false);
        });

        test('handles deeply nested looking content safely', async ({ page }) => {
            const yaml = `---
level1:
  level2:
    level3: "deep value"
title: Test
---
# Content`;
            // Our simple parser doesn't support deep nesting, but shouldn't crash
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
        });

        test('ignores orphaned array items without preceding key', async ({ page }) => {
            const yaml = `---
- orphan1
- orphan2
title: Test
tags:
- valid1
- valid2
---
# Content`;
            // Orphaned array items (not preceded by a key) should be ignored
            const html = await renderAndGetYamlHtml(page, yaml);
            expect(html).not.toBeNull();
            // Should have the valid key and array
            expect(html).toContain('title');
            expect(html).toContain('Test');
            expect(html).toContain('tags');
            expect(html).toContain('valid1');
            expect(html).toContain('valid2');
            // Orphaned items should NOT appear
            expect(html).not.toContain('orphan1');
            expect(html).not.toContain('orphan2');
        });
    });
});
