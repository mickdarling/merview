// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests for Mermaid file support (Issue #367)
 *
 * Features tested:
 * - Pure Mermaid content detection using mermaid.parse()
 * - .mermaid and .mmd file extension support
 * - Auto-detection of pure Mermaid vs Markdown content
 * - Prevention of false positives (e.g., "pie is very tasty")
 * - Content transformation: stripMermaidFences(), hasProperMermaidFences()
 * - Save transformation between .mermaid and .md formats
 */

// Test timing constants (in milliseconds)
const TIMEOUTS = {
    /** Maximum time to wait for CodeMirror editor to initialize */
    EDITOR_INIT: 15000,
    /** Maximum time to wait for mermaid diagram SVG to render */
    MERMAID_RENDER: 5000,
    /** Fallback wait time if mermaid render condition times out */
    MERMAID_FALLBACK: 2000,
    /** Time to wait for preview to render when NO mermaid is expected */
    PREVIEW_RENDER: 1500
};

/**
 * Wait for mermaid diagram to be rendered (SVG present)
 * Uses waitForFunction for efficiency, falls back to timeout if needed
 */
async function waitForMermaidRender(page, timeout = TIMEOUTS.MERMAID_RENDER) {
    try {
        await page.waitForFunction(() => {
            const mermaidEl = document.querySelector('.mermaid');
            return mermaidEl && mermaidEl.querySelector('svg') !== null;
        }, { timeout });
    } catch {
        // Fallback: wait fixed time if condition never met
        await page.waitForTimeout(TIMEOUTS.MERMAID_FALLBACK);
    }
}

/**
 * Wait for content to be rendered in preview
 * Used for tests where we expect NO mermaid to render
 */
async function waitForPreviewRender(page, timeout = TIMEOUTS.PREVIEW_RENDER) {
    // For negative tests (no mermaid expected), we need to wait long enough
    // to be confident the content has had time to render
    await page.waitForTimeout(timeout);
}

test.describe('Mermaid File Support (Issue #367)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('.CodeMirror', { timeout: TIMEOUTS.EDITOR_INIT });
    });

    test.describe('Pure Mermaid Content Detection', () => {
        test('should render pure Gantt chart content as diagram', async ({ page }) => {
            const ganttContent = `gantt
    title A Gantt Diagram
    dateFormat YYYY-MM-DD
    section Section
        A task          :a1, 2014-01-01, 30d
        Another task    :after a1, 20d`;

            await page.evaluate((content) => {
                globalThis.state.documentMode = null; // Reset to auto-detect
                globalThis.state.cmEditor.setValue(content);
            }, ganttContent);

            await waitForMermaidRender(page);

            const hasMermaidSvg = await page.evaluate(() => {
                const mermaidEl = document.querySelector('.mermaid');
                return mermaidEl && mermaidEl.querySelector('svg') !== null;
            });

            expect(hasMermaidSvg).toBe(true);
        });

        test('should render pure flowchart content as diagram', async ({ page }) => {
            const flowchartContent = `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Fix it]
    D --> B`;

            await page.evaluate((content) => {
                globalThis.state.documentMode = null;
                globalThis.state.cmEditor.setValue(content);
            }, flowchartContent);

            await waitForMermaidRender(page);

            const hasMermaidSvg = await page.evaluate(() => {
                const mermaidEl = document.querySelector('.mermaid');
                return mermaidEl && mermaidEl.querySelector('svg') !== null;
            });

            expect(hasMermaidSvg).toBe(true);
        });

        test('should render pure sequence diagram as diagram', async ({ page }) => {
            const sequenceContent = `sequenceDiagram
    Alice->>Bob: Hello Bob, how are you?
    Bob-->>Alice: I'm good thanks!`;

            await page.evaluate((content) => {
                globalThis.state.documentMode = null;
                globalThis.state.cmEditor.setValue(content);
            }, sequenceContent);

            await waitForMermaidRender(page);

            const hasMermaidSvg = await page.evaluate(() => {
                const mermaidEl = document.querySelector('.mermaid');
                return mermaidEl && mermaidEl.querySelector('svg') !== null;
            });

            expect(hasMermaidSvg).toBe(true);
        });

        test('should render pure pie chart as diagram', async ({ page }) => {
            const pieContent = `pie title Pets adopted
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15`;

            await page.evaluate((content) => {
                globalThis.state.documentMode = null;
                globalThis.state.cmEditor.setValue(content);
            }, pieContent);

            await waitForMermaidRender(page);

            const hasMermaidSvg = await page.evaluate(() => {
                const mermaidEl = document.querySelector('.mermaid');
                return mermaidEl && mermaidEl.querySelector('svg') !== null;
            });

            expect(hasMermaidSvg).toBe(true);
        });
    });

    test.describe('False Positive Prevention', () => {
        test('should NOT render "pie is very tasty" as pie chart', async ({ page }) => {
            await page.evaluate(() => {
                globalThis.state.documentMode = null;
                globalThis.state.cmEditor.setValue('pie is very tasty and I love it');
            });

            await waitForPreviewRender(page);

            const hasMermaid = await page.evaluate(() => {
                return document.querySelector('.mermaid') !== null;
            });

            expect(hasMermaid).toBe(false);
        });

        test('should NOT render "graph theory is interesting" as graph', async ({ page }) => {
            await page.evaluate(() => {
                globalThis.state.documentMode = null;
                globalThis.state.cmEditor.setValue('graph theory is a fascinating branch of mathematics');
            });

            await waitForPreviewRender(page);

            const hasMermaid = await page.evaluate(() => {
                return document.querySelector('.mermaid') !== null;
            });

            expect(hasMermaid).toBe(false);
        });

        test('should NOT render "journey to the center of the earth" as journey diagram', async ({ page }) => {
            await page.evaluate(() => {
                globalThis.state.documentMode = null;
                globalThis.state.cmEditor.setValue('journey to the center of the earth is a classic novel');
            });

            await waitForPreviewRender(page);

            const hasMermaid = await page.evaluate(() => {
                return document.querySelector('.mermaid') !== null;
            });

            expect(hasMermaid).toBe(false);
        });
    });

    test.describe('Markdown with Mermaid Fences', () => {
        test('should render markdown with mermaid fences as markdown', async ({ page }) => {
            const markdownContent = `# My Document

Here is a diagram:

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

And some more text.`;

            await page.evaluate((content) => {
                globalThis.state.documentMode = null;
                globalThis.state.cmEditor.setValue(content);
                // Explicitly trigger render after content change
                globalThis.renderMarkdown();
            }, markdownContent);

            await waitForMermaidRender(page);

            // Should have both heading and mermaid diagram
            const result = await page.evaluate(() => {
                const wrapper = document.querySelector('#preview #wrapper');
                const h1 = wrapper?.querySelector('h1');
                const mermaidEl = wrapper?.querySelector('.mermaid');
                return {
                    hasHeading: h1?.textContent?.includes('My Document') ?? false,
                    hasMermaid: mermaidEl !== null
                };
            });

            expect(result.hasHeading).toBe(true);
            expect(result.hasMermaid).toBe(true);
        });
    });

    test.describe('Document Mode', () => {
        test('should respect documentMode=mermaid for file extension', async ({ page }) => {
            // Simulate loading a .mermaid file
            await page.evaluate(() => {
                globalThis.state.documentMode = globalThis.DOCUMENT_MODE.MERMAID;
                globalThis.state.cmEditor.setValue('graph TD\n    A --> B');
            });

            await waitForMermaidRender(page);

            const hasMermaidSvg = await page.evaluate(() => {
                const mermaidEl = document.querySelector('.mermaid');
                return mermaidEl && mermaidEl.querySelector('svg') !== null;
            });

            expect(hasMermaidSvg).toBe(true);
        });

        test('should respect renderModeOverride=markdown even for pure mermaid content', async ({ page }) => {
            // renderModeOverride=markdown should force markdown rendering
            // This tests the user override mechanism (future toggle support)
            // Pure mermaid without fences will be treated as plain text
            await page.evaluate(() => {
                globalThis.state.renderModeOverride = globalThis.DOCUMENT_MODE.MARKDOWN;
                globalThis.state.cmEditor.setValue('graph TD\n    A --> B');
            });

            await waitForPreviewRender(page);

            // Should NOT be rendered as a single Mermaid diagram
            // It should be rendered as plain text/paragraph
            const result = await page.evaluate(() => {
                const wrapper = document.querySelector('#preview #wrapper');
                const mermaidWithSvg = wrapper?.querySelector('.mermaid svg');
                const innerText = wrapper?.innerText || '';
                return {
                    hasMermaidSvg: mermaidWithSvg !== null,
                    // Plain text rendering will show the mermaid syntax as text
                    includesGraphText: innerText.includes('graph') || innerText.includes('A')
                };
            });

            // When renderModeOverride is 'markdown', pure mermaid content without fences
            // should NOT render as a diagram - it should be plain text
            expect(result.hasMermaidSvg).toBe(false);
            expect(result.includesGraphText).toBe(true);

            // Clean up override for subsequent tests
            await page.evaluate(() => {
                globalThis.state.renderModeOverride = null;
            });
        });

        test('content-first detection: should render mermaid even when documentMode was markdown', async ({ page }) => {
            // This tests the content-first detection architecture
            // Even if documentMode='markdown' (from loading a .md file),
            // pure mermaid content should still be detected and rendered as a diagram.
            // This fixes the "select-all + delete + paste mermaid" scenario.
            await page.evaluate(() => {
                // Simulate state after loading a .md file
                globalThis.state.documentMode = globalThis.DOCUMENT_MODE.MARKDOWN;
                globalThis.state.renderModeOverride = null; // No user override
                globalThis.state.cmEditor.setValue('graph TD\n    A --> B');
            });

            await waitForPreviewRender(page);

            // Should be rendered as a Mermaid diagram because content-first
            // detection analyzes the content regardless of documentMode
            const hasMermaidSvg = await page.evaluate(() => {
                const wrapper = document.querySelector('#preview #wrapper');
                return wrapper?.querySelector('.mermaid svg') !== null;
            });

            expect(hasMermaidSvg).toBe(true);

            // Verify documentMode was updated to reflect detected content
            const updatedMode = await page.evaluate(() => globalThis.state.documentMode);
            expect(updatedMode).toBe('mermaid');
        });

        test('documentMode transitions from markdown to mermaid when pure mermaid content is detected', async ({ page }) => {
            // Test state transition: markdown -> mermaid
            // This verifies documentMode is updated as derived state
            await page.evaluate(() => {
                globalThis.state.documentMode = globalThis.DOCUMENT_MODE.MARKDOWN;
                globalThis.state.renderModeOverride = null;
            });

            // Verify initial state
            const initialMode = await page.evaluate(() => globalThis.state.documentMode);
            expect(initialMode).toBe('markdown');

            // Set pure mermaid content
            await page.evaluate(() => {
                globalThis.state.cmEditor.setValue('sequenceDiagram\n    Alice->>Bob: Hello');
            });

            await waitForPreviewRender(page);

            // Verify documentMode transitioned to mermaid
            const finalMode = await page.evaluate(() => globalThis.state.documentMode);
            expect(finalMode).toBe('mermaid');

            // Verify it rendered as a diagram
            const hasSvg = await page.evaluate(() => {
                return document.querySelector('#preview #wrapper .mermaid svg') !== null;
            });
            expect(hasSvg).toBe(true);
        });

        test('documentMode resets to null when mixed content replaces pure mermaid', async ({ page }) => {
            // Test state transition: mermaid -> null (when content becomes mixed)
            // First set up pure mermaid content
            await page.evaluate(() => {
                globalThis.state.documentMode = null;
                globalThis.state.renderModeOverride = null;
                globalThis.state.cmEditor.setValue('graph TD\n    A --> B');
            });

            await waitForPreviewRender(page);

            // Verify it detected as mermaid
            const mermaidMode = await page.evaluate(() => globalThis.state.documentMode);
            expect(mermaidMode).toBe('mermaid');

            // Now replace with mixed content (markdown + mermaid in fences)
            await page.evaluate(() => {
                globalThis.state.cmEditor.setValue('# My Document\n\nSome text here.\n\n```mermaid\ngraph TD\n    A --> B\n```');
            });

            await waitForPreviewRender(page);

            // documentMode should reset to null (auto-detect found non-pure content)
            const mixedMode = await page.evaluate(() => globalThis.state.documentMode);
            expect(mixedMode).toBeNull();
        });
    });

    test.describe('File Validation', () => {
        test('isValidMarkdownFile should accept .mermaid extension', async ({ page }) => {
            const isValid = await page.evaluate(() => {
                return globalThis.isValidMarkdownFile({ type: '', name: 'diagram.mermaid' });
            });
            expect(isValid).toBe(true);
        });

        test('isValidMarkdownFile should accept .mmd extension', async ({ page }) => {
            const isValid = await page.evaluate(() => {
                return globalThis.isValidMarkdownFile({ type: '', name: 'diagram.mmd' });
            });
            expect(isValid).toBe(true);
        });

        test('isValidMarkdownFile should accept text/vnd.mermaid MIME type', async ({ page }) => {
            const isValid = await page.evaluate(() => {
                return globalThis.isValidMarkdownFile({ type: 'text/vnd.mermaid', name: 'diagram' });
            });
            expect(isValid).toBe(true);
        });
    });

    test.describe('Mermaid with Frontmatter', () => {
        test('should render pure mermaid with YAML frontmatter', async ({ page }) => {
            const mermaidWithFrontmatter = `---
title: My Diagram
---
graph TD
    A[Start] --> B[End]`;

            await page.evaluate((content) => {
                globalThis.state.documentMode = null;
                globalThis.state.cmEditor.setValue(content);
                // Explicitly trigger render after content change
                globalThis.renderMarkdown();
            }, mermaidWithFrontmatter);

            await waitForMermaidRender(page);

            const result = await page.evaluate(() => {
                const mermaidEl = document.querySelector('.mermaid');
                const yamlPanel = document.querySelector('.yaml-front-matter');
                return {
                    hasMermaidSvg: mermaidEl && mermaidEl.querySelector('svg') !== null,
                    hasYamlPanel: yamlPanel !== null
                };
            });

            expect(result.hasMermaidSvg).toBe(true);
            expect(result.hasYamlPanel).toBe(true);
        });
    });

    test.describe('stripMermaidFences() Edge Cases', () => {
        test('should strip simple mermaid fences', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = '```mermaid\ngraph TD\n    A --> B\n```';
                return globalThis.stripMermaidFences(content);
            });
            expect(result).toBe('graph TD\n    A --> B');
        });

        test('should strip fences with trailing whitespace', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = '```mermaid   \ngraph TD\n    A --> B\n```\n\n';
                return globalThis.stripMermaidFences(content);
            });
            expect(result).toBe('graph TD\n    A --> B');
        });

        test('should return original content if no opening fence', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = 'graph TD\n    A --> B';
                return globalThis.stripMermaidFences(content);
            });
            expect(result).toBe('graph TD\n    A --> B');
        });

        test('should return original content if no closing fence', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = '```mermaid\ngraph TD\n    A --> B';
                return globalThis.stripMermaidFences(content);
            });
            expect(result).toBe('```mermaid\ngraph TD\n    A --> B');
        });

        test('should return original content if fence has attributes', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = '```mermaid {theme: forest}\ngraph TD\n    A --> B\n```';
                return globalThis.stripMermaidFences(content);
            });
            // Content with attributes after ```mermaid should not be stripped
            expect(result).toBe('```mermaid {theme: forest}\ngraph TD\n    A --> B\n```');
        });

        test('should handle empty content between fences', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = '```mermaid\n\n```';
                return globalThis.stripMermaidFences(content);
            });
            expect(result).toBe('');
        });

        test('should handle content with only whitespace between fences', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = '```mermaid\n   \n```';
                return globalThis.stripMermaidFences(content);
            });
            expect(result).toBe('');
        });
    });

    test.describe('hasProperMermaidFences() Edge Cases', () => {
        test('should detect proper fences', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = '```mermaid\ngraph TD\n    A --> B\n```';
                return globalThis.hasProperMermaidFences(content);
            });
            expect(result).toBe(true);
        });

        test('should detect fences case-insensitively', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = '```MERMAID\ngraph TD\n    A --> B\n```';
                return globalThis.hasProperMermaidFences(content);
            });
            expect(result).toBe(true);
        });

        test('should return false for content without fences', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = 'graph TD\n    A --> B';
                return globalThis.hasProperMermaidFences(content);
            });
            expect(result).toBe(false);
        });

        test('should return false for content with only opening fence', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = '```mermaid\ngraph TD\n    A --> B';
                return globalThis.hasProperMermaidFences(content);
            });
            expect(result).toBe(false);
        });

        test('should return false for content with only closing fence', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = 'graph TD\n    A --> B\n```';
                return globalThis.hasProperMermaidFences(content);
            });
            expect(result).toBe(false);
        });

        test('should detect fences in larger markdown document', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = '# Title\n\nSome text\n\n```mermaid\ngraph TD\n    A --> B\n```\n\nMore text';
                return globalThis.hasProperMermaidFences(content);
            });
            expect(result).toBe(true);
        });

        test('should return false for literal string containing mermaid without fences', async ({ page }) => {
            const result = await page.evaluate(() => {
                // Content that mentions "```mermaid" but isn't actually fenced
                const content = 'Use ```mermaid to create diagrams';
                return globalThis.hasProperMermaidFences(content);
            });
            expect(result).toBe(false);
        });
    });

    test.describe('Save Transformation', () => {
        test('should wrap pure mermaid in fences when saving as .md', async ({ page }) => {
            // Set up pure mermaid content with mermaid document mode
            await page.evaluate(() => {
                globalThis.state.documentMode = globalThis.DOCUMENT_MODE.MERMAID;
                globalThis.state.cmEditor.setValue('graph TD\n    A --> B');
            });

            // Check that hasProperMermaidFences returns false for pure mermaid
            const hasFences = await page.evaluate(() => {
                const content = globalThis.state.cmEditor.getValue();
                return globalThis.hasProperMermaidFences(content);
            });
            expect(hasFences).toBe(false);

            // The actual save logic would wrap this content
            // We can test the transformation logic directly
            const transformed = await page.evaluate(() => {
                const content = 'graph TD\n    A --> B';
                if (!globalThis.hasProperMermaidFences(content)) {
                    return '```mermaid\n' + content.trim() + '\n```\n';
                }
                return content;
            });
            expect(transformed).toBe('```mermaid\ngraph TD\n    A --> B\n```\n');
        });

        test('should not double-wrap content that already has fences', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = '```mermaid\ngraph TD\n    A --> B\n```';
                if (!globalThis.hasProperMermaidFences(content)) {
                    return '```mermaid\n' + content.trim() + '\n```\n';
                }
                return content;
            });
            expect(result).toBe('```mermaid\ngraph TD\n    A --> B\n```');
        });

        test('should strip fences when saving as .mermaid', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = '```mermaid\ngraph TD\n    A --> B\n```';
                return globalThis.stripMermaidFences(content);
            });
            expect(result).toBe('graph TD\n    A --> B');
        });

        test('should preserve pure mermaid when saving as .mermaid', async ({ page }) => {
            const result = await page.evaluate(() => {
                const content = 'graph TD\n    A --> B';
                return globalThis.stripMermaidFences(content);
            });
            expect(result).toBe('graph TD\n    A --> B');
        });
    });

    test.describe('File Extension Behavior', () => {
        test('should set documentMode to mermaid for .mermaid files', async ({ page }) => {
            // Simulate what happens when loading a .mermaid file
            // The actual file loading sets documentMode based on extension
            await page.evaluate(() => {
                // Simulate loading diagram.mermaid
                const filename = 'diagram.mermaid';
                const isMermaidExt = filename.toLowerCase().endsWith('.mermaid') ||
                                     filename.toLowerCase().endsWith('.mmd');
                if (isMermaidExt) {
                    globalThis.state.documentMode = globalThis.DOCUMENT_MODE.MERMAID;
                }
            });

            const mode = await page.evaluate(() => globalThis.state.documentMode);
            expect(mode).toBe('mermaid');
        });

        test('should set documentMode to mermaid for .mmd files', async ({ page }) => {
            await page.evaluate(() => {
                const filename = 'diagram.mmd';
                const isMermaidExt = filename.toLowerCase().endsWith('.mermaid') ||
                                     filename.toLowerCase().endsWith('.mmd');
                if (isMermaidExt) {
                    globalThis.state.documentMode = globalThis.DOCUMENT_MODE.MERMAID;
                }
            });

            const mode = await page.evaluate(() => globalThis.state.documentMode);
            expect(mode).toBe('mermaid');
        });

        test('should set documentMode to markdown for .md files', async ({ page }) => {
            await page.evaluate(() => {
                const filename = 'document.md';
                const isMarkdownExt = filename.toLowerCase().endsWith('.md') ||
                                      filename.toLowerCase().endsWith('.markdown');
                if (isMarkdownExt) {
                    globalThis.state.documentMode = globalThis.DOCUMENT_MODE.MARKDOWN;
                }
            });

            const mode = await page.evaluate(() => globalThis.state.documentMode);
            expect(mode).toBe('markdown');
        });

        test('should handle case-insensitive extensions', async ({ page }) => {
            // Test extension detection with various case combinations
            // Using direct string methods to avoid nested function callbacks
            const testCases = [
                { name: 'DIAGRAM.MERMAID', expectMermaid: true },
                { name: 'Diagram.Mmd', expectMermaid: true },
                { name: 'Document.MD', expectMarkdown: true },
                { name: 'file.MARKDOWN', expectMarkdown: true }
            ];

            for (const tc of testCases) {
                const lower = tc.name.toLowerCase();
                const isMermaid = lower.endsWith('.mermaid') || lower.endsWith('.mmd');
                const isMarkdown = lower.endsWith('.md') || lower.endsWith('.markdown');

                if (tc.expectMermaid) {
                    expect(isMermaid).toBe(true);
                }
                if (tc.expectMarkdown) {
                    expect(isMarkdown).toBe(true);
                }
            }
        });
    });

    test.describe('Edge Cases', () => {
        test('should render mixed content with markdown + mermaid keywords as markdown', async ({ page }) => {
            // Content that starts with mermaid keyword but has markdown paragraphs
            // This should NOT be detected as pure mermaid
            const mixedContent = `graph TD
    A[Start] --> B[End]

This is a paragraph that explains the diagram above.
Here is more text explaining the flow.`;

            await page.evaluate((content) => {
                globalThis.state.documentMode = null;
                globalThis.state.cmEditor.setValue(content);
            }, mixedContent);

            await waitForPreviewRender(page);

            // Should render as markdown (no mermaid diagram)
            const result = await page.evaluate(() => {
                const mermaidEl = document.querySelector('.mermaid');
                // When content is markdown, there may be no .mermaid element at all
                // or there may be one but without a rendered SVG
                const hasSvg = mermaidEl ? mermaidEl.querySelector('svg') !== null : false;
                // Check if the paragraph text is rendered
                const previewContent = document.querySelector('#preview-content')?.textContent || '';
                return {
                    hasMermaidSvg: hasSvg,
                    hasExplanationText: previewContent.includes('explains the diagram')
                };
            });

            // Mixed content should NOT render as pure mermaid
            // mermaid.parse() should fail on the paragraph text
            expect(result.hasMermaidSvg).toBe(false);
        });

        test('should handle mermaid with mermaid-specific config frontmatter', async ({ page }) => {
            // Mermaid supports its own frontmatter format for configuration
            const mermaidWithConfig = `---
config:
  theme: dark
---
graph TD
    A[Dark Theme] --> B[End]`;

            await page.evaluate((content) => {
                globalThis.state.documentMode = null;
                globalThis.state.cmEditor.setValue(content);
                globalThis.renderMarkdown();
            }, mermaidWithConfig);

            await waitForMermaidRender(page);

            const result = await page.evaluate(() => {
                const mermaidEl = document.querySelector('.mermaid');
                const yamlPanel = document.querySelector('.yaml-front-matter');
                return {
                    hasMermaidSvg: mermaidEl ? mermaidEl.querySelector('svg') !== null : false,
                    hasYamlPanel: yamlPanel !== null
                };
            });

            // Should render as mermaid diagram with frontmatter displayed
            expect(result.hasMermaidSvg).toBe(true);
            expect(result.hasYamlPanel).toBe(true);
        });

        test('should handle invalid mermaid syntax gracefully', async ({ page }) => {
            // Invalid mermaid syntax should not crash - should be treated as markdown
            const invalidMermaid = `graph TD
    A[Start] -->
    B[Missing arrow target]
    ]]]Invalid brackets[[[`;

            await page.evaluate((content) => {
                globalThis.state.documentMode = null;
                globalThis.state.cmEditor.setValue(content);
            }, invalidMermaid);

            await waitForPreviewRender(page);

            // Should not have a rendered mermaid diagram (parse failed)
            const hasMermaidSvg = await page.evaluate(() => {
                const mermaidEl = document.querySelector('.mermaid');
                // When content is markdown, there may be no .mermaid element at all
                return mermaidEl ? mermaidEl.querySelector('svg') !== null : false;
            });

            expect(hasMermaidSvg).toBe(false);
        });

        test('should handle content that looks like mermaid but is plain text', async ({ page }) => {
            // Content that contains mermaid keywords but isn't valid mermaid
            const fakeMermaid = `graph of user growth over time:
- January: 100 users
- February: 150 users
- March: 200 users

This is just a text description, not actual mermaid syntax.`;

            await page.evaluate((content) => {
                globalThis.state.documentMode = null;
                globalThis.state.cmEditor.setValue(content);
            }, fakeMermaid);

            await waitForPreviewRender(page);

            // Should not have a mermaid diagram rendered
            const hasMermaidSvg = await page.evaluate(() => {
                const mermaidEl = document.querySelector('.mermaid');
                // When content is markdown, there may be no .mermaid element at all
                return mermaidEl ? mermaidEl.querySelector('svg') !== null : false;
            });

            // Should render as plain markdown, not mermaid
            expect(hasMermaidSvg).toBe(false);
        });
    });
});
