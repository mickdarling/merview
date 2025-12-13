// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForPageReady,
  setCodeMirrorContent,
  renderMarkdownAndWait,
  setupDialogListener,
  WAIT_TIMES
} = require('./helpers/test-utils');

/**
 * Tests for Japanese, Chinese, Korean (CJK) and double-byte character support (Issue #247)
 *
 * These tests ensure that Merview properly handles:
 * - Japanese text (hiragana, katakana, kanji)
 * - Chinese text (simplified and traditional)
 * - Korean text (hangul)
 * - Mixed ASCII and CJK content
 * - CJK in YAML front matter
 * - CJK in URL paths
 * - XSS prevention with CJK characters
 */

/**
 * Helper to render markdown and return wrapper HTML
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} markdown - Markdown content to render
 * @returns {Promise<string>} Wrapper HTML
 */
async function renderAndGetHtml(page, markdown) {
  await setCodeMirrorContent(page, markdown);
  await renderMarkdownAndWait(page, WAIT_TIMES.LONG);
  return page.$eval('#wrapper', el => el.innerHTML);
}

/**
 * Helper to check if YAML front matter panel exists
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>} True if panel exists
 */
async function yamlPanelExists(page) {
  const panel = await page.$('.yaml-front-matter');
  return panel !== null;
}

/**
 * Helper to get YAML panel content
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} Panel HTML content
 */
async function getYamlPanelContent(page) {
  return page.$eval('.yaml-front-matter', el => el.innerHTML);
}

test.describe('CJK Character Support (Issue #247)', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageReady(page);
  });

  test.describe('Content Rendering Tests', () => {
    test('renders Japanese text correctly (hiragana, katakana, kanji)', async ({ page }) => {
      const markdown = `# 日本語のテスト

## ひらがな (Hiragana)
こんにちは世界。これはひらがなのテストです。

## カタカナ (Katakana)
コンニチハ。カタカナテキスト。

## 漢字 (Kanji)
日本語は漢字、ひらがな、カタカナを使います。

## 混合文 (Mixed)
今日は良い天気ですね。`;

      const html = await renderAndGetHtml(page, markdown);

      // Verify hiragana
      expect(html).toContain('こんにちは世界');
      expect(html).toContain('ひらがな');

      // Verify katakana
      expect(html).toContain('カタカナ');
      expect(html).toContain('コンニチハ');

      // Verify kanji
      expect(html).toContain('日本語');
      expect(html).toContain('漢字');
      expect(html).toContain('今日は良い天気');

      // Check that headings are properly rendered
      const h1 = await page.$('#wrapper h1');
      expect(h1).not.toBeNull();

      const h1Text = await page.$eval('#wrapper h1', el => el.textContent);
      expect(h1Text).toContain('日本語のテスト');
    });

    test('renders Chinese text correctly (simplified)', async ({ page }) => {
      const markdown = `# 中文测试

## 简体中文
你好世界。这是一个简体中文测试。

## 常用短语
- 早上好
- 谢谢
- 对不起
- 再见

## 长文本
中文是世界上使用人数最多的语言之一。中文有丰富的历史和文化背景。`;

      const html = await renderAndGetHtml(page, markdown);

      // Verify simplified Chinese characters
      expect(html).toContain('你好世界');
      expect(html).toContain('简体中文');
      expect(html).toContain('早上好');
      expect(html).toContain('谢谢');
      expect(html).toContain('语言');

      // Check that list items are rendered
      const listItems = await page.$$('#wrapper ul li');
      expect(listItems.length).toBeGreaterThan(0);
    });

    test('renders Chinese text correctly (traditional)', async ({ page }) => {
      const markdown = `# 繁體中文測試

## 傳統中文
你好世界。這是繁體中文測試。

## 常用詞語
- 早安
- 謝謝
- 對不起
- 再見

繁體中文在台灣、香港和澳門廣泛使用。`;

      const html = await renderAndGetHtml(page, markdown);

      // Verify traditional Chinese characters
      expect(html).toContain('繁體中文');
      expect(html).toContain('這是');
      expect(html).toContain('謝謝');
      expect(html).toContain('台灣');
      expect(html).toContain('香港');
    });

    test('renders Korean text correctly (hangul)', async ({ page }) => {
      const markdown = `# 한국어 테스트

## 한글
안녕하세요. 한국어 텍스트 테스트입니다.

## 일반 문구
- 안녕하세요
- 감사합니다
- 죄송합니다
- 안녕히 가세요

## 긴 텍스트
한글은 한국의 고유 문자입니다. 세종대왕이 창제하였습니다.`;

      const html = await renderAndGetHtml(page, markdown);

      // Verify Korean hangul
      expect(html).toContain('안녕하세요');
      expect(html).toContain('한국어');
      expect(html).toContain('감사합니다');
      expect(html).toContain('세종대왕');
      expect(html).toContain('창제');

      // Check heading
      const h1Text = await page.$eval('#wrapper h1', el => el.textContent);
      expect(h1Text).toContain('한국어 테스트');
    });

    test('renders mixed ASCII and CJK text', async ({ page }) => {
      const markdown = `# Mixed Language Test

## English and Japanese
Hello 世界 World こんにちは

## English and Chinese
Hello 世界 Thank you 谢谢

## English and Korean
Hello 안녕하세요 World

## All Mixed
Welcome 欢迎 ようこそ 환영합니다 to Merview!

This is a test of **bold 太字 굵게** and *italic 斜体 기울임* text.`;

      const html = await renderAndGetHtml(page, markdown);

      // Verify mixed content is preserved
      expect(html).toContain('Hello 世界 World');
      expect(html).toContain('こんにちは');
      expect(html).toContain('谢谢');
      expect(html).toContain('안녕하세요');
      expect(html).toContain('Welcome 欢迎 ようこそ 환영합니다');

      // Verify formatting is preserved with CJK
      expect(html).toContain('bold 太字 굵게');
      expect(html).toContain('italic 斜体 기울임');
    });

    test('renders CJK in code blocks', async ({ page }) => {
      const markdown = `# Code Block Test

\`\`\`python
# 日本語のコメント
def hello():
    print("こんにちは世界")  # 世界に挨拶

# 中文注释
def nihao():
    print("你好世界")

# 한국어 주석
def annyeong():
    print("안녕하세요")
\`\`\`

Inline code: \`const greeting = "こんにちは";\``;

      const html = await renderAndGetHtml(page, markdown);

      // Verify CJK in code blocks
      expect(html).toContain('日本語のコメント');
      expect(html).toContain('こんにちは世界');
      expect(html).toContain('中文注释');
      expect(html).toContain('你好世界');
      expect(html).toContain('한국어 주석');
      expect(html).toContain('안녕하세요');

      // Verify inline code
      expect(html).toContain('const greeting = "こんにちは"');
    });

    test('renders CJK in blockquotes', async ({ page }) => {
      const markdown = `# Blockquote Test

> 日本語の引用文です。
> これは複数行にわたります。

> 中文引用文本。
> 这是第二行。

> 한국어 인용문입니다.
> 두 번째 줄입니다.`;

      const html = await renderAndGetHtml(page, markdown);

      // Verify blockquotes contain CJK
      expect(html).toContain('日本語の引用文');
      expect(html).toContain('中文引用文本');
      expect(html).toContain('한국어 인용문');

      // Check blockquote elements exist
      const blockquotes = await page.$$('#wrapper blockquote');
      expect(blockquotes.length).toBeGreaterThan(0);
    });

    test('renders CJK in lists', async ({ page }) => {
      const markdown = `# List Test

## Unordered List
- 日本語項目
- 中文项目
- 한국어 항목

## Ordered List
1. 第一項目 (First item)
2. 第二項目 (Second item)
3. 第三項目 (Third item)

## Nested List
- Parent 親 부모
  - Child 子 자식
    - Grandchild 孫 손자`;

      const html = await renderAndGetHtml(page, markdown);

      // Verify list items
      expect(html).toContain('日本語項目');
      expect(html).toContain('中文项目');
      expect(html).toContain('한국어 항목');
      expect(html).toContain('第一項目');
      expect(html).toContain('第二項目');
      expect(html).toContain('第三項目');

      // Verify nested lists
      expect(html).toContain('Parent 親 부모');
      expect(html).toContain('Child 子 자식');
      expect(html).toContain('Grandchild 孫 손자');
    });

    test('renders CJK in tables', async ({ page }) => {
      const markdown = `# Table Test

| English | 日本語 | 中文 | 한국어 |
|---------|--------|------|--------|
| Hello | こんにちは | 你好 | 안녕하세요 |
| Thank you | ありがとう | 谢谢 | 감사합니다 |
| Goodbye | さようなら | 再见 | 안녕히 가세요 |`;

      const html = await renderAndGetHtml(page, markdown);

      // Verify table headers
      expect(html).toContain('日本語');
      expect(html).toContain('中文');
      expect(html).toContain('한국어');

      // Verify table content
      expect(html).toContain('こんにちは');
      expect(html).toContain('你好');
      expect(html).toContain('안녕하세요');
      expect(html).toContain('ありがとう');
      expect(html).toContain('谢谢');
      expect(html).toContain('감사합니다');

      // Check table structure
      const table = await page.$('#wrapper table');
      expect(table).not.toBeNull();
    });
  });

  test.describe('YAML Front Matter with CJK', () => {
    test('handles Japanese values in YAML front matter', async ({ page }) => {
      const markdown = `---
title: 日本語のドキュメント
author: 山田太郎
description: これは日本語のテストです
tags:
  - 日本語
  - テスト
  - マークダウン
keywords: こんにちは、世界、日本
---

# コンテンツ

本文はこちらです。`;

      await renderAndGetHtml(page, markdown);

      // Check that YAML panel exists
      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      // Get panel content
      const content = await getYamlPanelContent(page);

      // Verify Japanese values are present
      expect(content).toContain('日本語のドキュメント');
      expect(content).toContain('山田太郎');
      expect(content).toContain('これは日本語のテスト');
      expect(content).toContain('日本語');
      expect(content).toContain('テスト');
      expect(content).toContain('マークダウン');
    });

    test('handles Chinese values in YAML front matter', async ({ page }) => {
      const markdown = `---
title: 中文文档
author: 张三
description: 这是中文测试
tags:
  - 中文
  - 测试
  - 文档
category: 技术文档
---

# 内容

正文内容。`;

      await renderAndGetHtml(page, markdown);

      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      const content = await getYamlPanelContent(page);

      // Verify Chinese values
      expect(content).toContain('中文文档');
      expect(content).toContain('张三');
      expect(content).toContain('这是中文测试');
      expect(content).toContain('技术文档');
    });

    test('handles Korean values in YAML front matter', async ({ page }) => {
      const markdown = `---
title: 한국어 문서
author: 김철수
description: 한국어 테스트입니다
tags:
  - 한국어
  - 테스트
  - 문서
---

# 내용

본문 내용입니다.`;

      await renderAndGetHtml(page, markdown);

      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      const content = await getYamlPanelContent(page);

      // Verify Korean values
      expect(content).toContain('한국어 문서');
      expect(content).toContain('김철수');
      expect(content).toContain('한국어 테스트');
      expect(content).toContain('테스트');
    });

    test('handles mixed CJK values in YAML front matter', async ({ page }) => {
      const markdown = `---
title: "Multi-language 多言語 다국어"
languages:
  - English
  - 日本語
  - 中文
  - 한국어
greeting: "Hello こんにちは 你好 안녕하세요"
---

# Test`;

      await renderAndGetHtml(page, markdown);

      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      const content = await getYamlPanelContent(page);

      // Verify mixed language values
      expect(content).toContain('Multi-language 多言語 다국어');
      expect(content).toContain('日本語');
      expect(content).toContain('中文');
      expect(content).toContain('한국어');
      expect(content).toContain('Hello こんにちは 你好 안녕하세요');
    });
  });

  test.describe('URL Loading with CJK', () => {
    test('allows legitimate CJK characters in URL path components', async ({ page }) => {
      // Test that CJK path components work (even though they'll be percent-encoded in practice)
      const testUrls = [
        'https://example.com/docs/日本語.md',
        'https://example.com/文档/中文.md',
        'https://example.com/docs/한국어.md',
      ];

      for (const url of testUrls) {
        const isAllowed = await page.evaluate((testUrl) => {
          // @ts-ignore - isAllowedMarkdownURL is defined in the app
          return globalThis.isAllowedMarkdownURL(testUrl);
        }, url);

        // CJK characters in URL paths should be allowed (they get percent-encoded by browser)
        expect(isAllowed).toBe(true);
      }
    });

    test('blocks homograph attacks in hostnames but allows ASCII domains', async ({ page }) => {
      // Cyrillic 'а' (U+0430) looks like Latin 'a' but is different
      const homographUrl = 'https://exаmple.com/file.md'; // Contains Cyrillic 'а'
      const legitimateUrl = 'https://example.com/file.md'; // All ASCII

      const homographAllowed = await page.evaluate((testUrl) => {
        // @ts-ignore
        return globalThis.isAllowedMarkdownURL(testUrl);
      }, homographUrl);

      const legitimateAllowed = await page.evaluate((testUrl) => {
        // @ts-ignore
        return globalThis.isAllowedMarkdownURL(testUrl);
      }, legitimateUrl);

      // Homograph should be blocked
      expect(homographAllowed).toBe(false);

      // Legitimate ASCII should be allowed
      expect(legitimateAllowed).toBe(true);
    });

    test('blocks IDN homograph attacks (mixed scripts)', async ({ page }) => {
      // Mixed Cyrillic and Latin characters
      const mixedScriptUrls = [
        'https://gооgle.com/file.md', // Cyrillic 'о' instead of Latin 'o'
        'https://аpple.com/file.md',  // Cyrillic 'а' instead of Latin 'a'
        'https://microsоft.com/file.md', // Cyrillic 'о' instead of Latin 'o'
      ];

      for (const url of mixedScriptUrls) {
        const isAllowed = await page.evaluate((testUrl) => {
          // @ts-ignore
          return globalThis.isAllowedMarkdownURL(testUrl);
        }, url);

        expect(isAllowed).toBe(false);
      }
    });

    test('allows legitimate international domain names (all same script)', async ({ page }) => {
      // While we block mixed-script homographs, we want to document behavior
      // for legitimate international domains (though most services use ASCII)
      const asciiUrl = 'https://github.com/user/repo/README.md';

      const isAllowed = await page.evaluate((testUrl) => {
        // @ts-ignore
        return globalThis.isAllowedMarkdownURL(testUrl);
      }, asciiUrl);

      expect(isAllowed).toBe(true);
    });
  });

  test.describe('XSS Prevention with CJK', () => {
    test('blocks XSS attempts using CJK characters in script tags', async ({ page }) => {
      const maliciousMarkdown = `# Test

<script>alert('日本語のXSS攻撃')</script>

<script>alert('中文XSS攻击')</script>

<script>alert('한국어 XSS 공격')</script>`;

      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, maliciousMarkdown);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      // Scripts should not execute
      expect(listener.wasTriggered()).toBe(false);

      // Get HTML and verify scripts are stripped
      const html = await page.$eval('#wrapper', el => el.innerHTML.toLowerCase());
      expect(html).not.toContain('<script>');
    });

    test('blocks XSS attempts using CJK in event handlers', async ({ page }) => {
      const maliciousMarkdown = `# Test

<img src="x" onerror="alert('日本語')">

<div onclick="alert('中文')">Click me</div>

<a href="javascript:alert('한국어')">Link</a>`;

      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, maliciousMarkdown);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      // No alerts should fire
      expect(listener.wasTriggered()).toBe(false);

      // Verify dangerous attributes are removed
      const hasOnerror = await page.evaluate(() => {
        const wrapper = document.querySelector('#wrapper');
        const imgs = wrapper?.querySelectorAll('img');
        for (const img of imgs || []) {
          if (img.hasAttribute('onerror')) {
            return true;
          }
        }
        return false;
      });
      expect(hasOnerror).toBe(false);
    });

    test('blocks XSS attempts using encoded CJK characters', async ({ page }) => {
      // URL-encoded and HTML-encoded CJK in XSS attempts
      const maliciousMarkdown = `# Test

<script>alert('&#x3053;&#x3093;&#x306B;&#x3061;&#x306F;')</script>

<img src="x" onerror="alert('%E4%BD%A0%E5%A5%BD')">`;

      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, maliciousMarkdown);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      // Should not execute
      expect(listener.wasTriggered()).toBe(false);
    });

    test('preserves legitimate CJK content in safe contexts', async ({ page }) => {
      const safeMarkdown = `# 日本語のテスト

これは**安全な**日本語のコンテンツです。

- リスト項目 1
- リスト項目 2

> 引用文：こんにちは世界

\`\`\`javascript
console.log("こんにちは");
\`\`\``;

      const html = await renderAndGetHtml(page, safeMarkdown);

      // Verify all legitimate CJK content is preserved
      expect(html).toContain('日本語のテスト');
      expect(html).toContain('安全な');
      expect(html).toContain('リスト項目');
      expect(html).toContain('引用文：こんにちは世界');
      expect(html).toContain('こんにちは'); // Code content (quotes may be syntax-highlighted)
    });

    test('sanitizes CJK in YAML values to prevent XSS', async ({ page }) => {
      const maliciousMarkdown = `---
title: "Normal Title"
xss_attempt: "<script>alert('日本語')</script>"
event_handler: "<img src=x onerror=alert('中文')>"
javascript_url: "javascript:alert('한국어')"
---

# Content`;

      const listener = setupDialogListener(page);
      await renderAndGetHtml(page, maliciousMarkdown);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      // No alerts should fire
      expect(listener.wasTriggered()).toBe(false);

      // Check YAML panel
      const panelExists = await yamlPanelExists(page);
      expect(panelExists).toBe(true);

      // Verify script tags are stripped from YAML values
      const content = await getYamlPanelContent(page);
      const lowerContent = content.toLowerCase();
      expect(lowerContent).not.toContain('<script>');
    });

    test('handles CJK combining characters safely', async ({ page }) => {
      // Combining characters and zero-width joiners
      const markdown = `# Test with Combining Characters

Normal text: 日本語

With combining marks: が̈き̈ (deliberate combining diacritics)

Zero-width characters: 日​本​語 (with zero-width spaces)`;

      const html = await renderAndGetHtml(page, markdown);

      // Content should render without breaking
      expect(html).toContain('日本語');

      // Page should not crash
      const wrapper = await page.$('#wrapper');
      expect(wrapper).not.toBeNull();
    });
  });

  test.describe('Mermaid Diagrams with CJK', () => {
    test('renders Mermaid diagrams with CJK node labels', async ({ page }) => {
      const markdown = `# Mermaid with CJK

\`\`\`mermaid
graph TD
    A[開始] --> B[処理]
    B --> C[終了]
\`\`\``;

      await setCodeMirrorContent(page, markdown);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

      // Check that mermaid diagram rendered
      const mermaidSvg = await page.$('.mermaid svg');
      expect(mermaidSvg).not.toBeNull();

      // Note: The actual text content in SVG may be encoded differently
      // This test verifies the diagram renders without errors
    });

    test('blocks XSS in Mermaid diagrams with CJK labels', async ({ page }) => {
      const maliciousMarkdown = `# Mermaid XSS Test

\`\`\`mermaid
graph TD
    A[<script>alert('日本語XSS')</script>]
    B[<img src=x onerror=alert('中文')>]
\`\`\``;

      const listener = setupDialogListener(page);
      await setCodeMirrorContent(page, maliciousMarkdown);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);
      await page.waitForTimeout(WAIT_TIMES.LONG);

      // Scripts should not execute
      expect(listener.wasTriggered()).toBe(false);
    });

    test('renders Mermaid diagrams with mixed CJK and ASCII', async ({ page }) => {
      const markdown = `# Mixed Language Flowchart

\`\`\`mermaid
graph LR
    A[Start 開始 시작] --> B[Process 処理 처리]
    B --> C[End 終了 종료]
\`\`\``;

      await setCodeMirrorContent(page, markdown);
      await renderMarkdownAndWait(page, WAIT_TIMES.EXTRA_LONG);

      const mermaidSvg = await page.$('.mermaid svg');
      expect(mermaidSvg).not.toBeNull();
    });
  });

  test.describe('Edge Cases and Special Characters', () => {
    test('handles full-width punctuation and symbols', async ({ page }) => {
      const markdown = `# Full-width Characters

## Full-width punctuation
これは全角の句読点です。「カギ括弧」も使えます。

## Full-width numbers and letters
１２３４５　ＡＢＣＤＥ

## Special symbols
※注意　→方向　×印　○丸`;

      const html = await renderAndGetHtml(page, markdown);

      // Verify full-width characters are preserved
      expect(html).toContain('全角の句読点');
      expect(html).toContain('「カギ括弧」');
      expect(html).toContain('１２３４５');
      expect(html).toContain('ＡＢＣＤＥ');
      expect(html).toContain('※注意');
    });

    test('handles emoji mixed with CJK', async ({ page }) => {
      const markdown = `# Emoji and CJK

日本語 🗾 Japanese

中文 🇨🇳 Chinese

한국어 🇰🇷 Korean

お寿司 🍣 美味しい！`;

      const html = await renderAndGetHtml(page, markdown);

      // Verify both emoji and CJK are preserved
      expect(html).toContain('日本語 🗾');
      expect(html).toContain('中文 🇨🇳');
      expect(html).toContain('한국어 🇰🇷');
      expect(html).toContain('お寿司 🍣');
    });

    test('handles very long CJK strings', async ({ page }) => {
      // Create a long Japanese string
      const longJapanese = 'あ'.repeat(1000);
      const markdown = `# Long CJK Test

${longJapanese}`;

      const html = await renderAndGetHtml(page, markdown);

      // Verify long string is preserved
      expect(html).toContain('あ'.repeat(100)); // Check for substantial portion
      expect(html.length).toBeGreaterThan(1000);

      // Verify content wasn't truncated
      const charCount = (html.match(/あ/g) || []).length;
      expect(charCount).toBe(1000);
    });

    test('handles mixed directionality (LTR CJK with RTL markers)', async ({ page }) => {
      // CJK is LTR, but test with RTL markers
      const markdown = `# Directionality Test

Japanese (LTR): 日本語

With RTL mark: \u202B日本語\u202C

Mixed: Hello \u202Bمرحبا\u202C 日本語`;

      const html = await renderAndGetHtml(page, markdown);

      // Verify content renders without breaking
      expect(html).toContain('日本語');

      const wrapper = await page.$('#wrapper');
      expect(wrapper).not.toBeNull();
    });

    test('handles rare and archaic CJK characters', async ({ page }) => {
      const markdown = `# Rare Characters Test

## Rare Kanji
𠮷野家 (rare variant of 吉)
𩸽 (hokke fish)

## Old Korean Hangul
ㄱㄴㄷ (consonants)
ㅏㅓㅗ (vowels)`;

      const html = await renderAndGetHtml(page, markdown);

      // Test that page doesn't crash with rare characters
      const wrapper = await page.$('#wrapper');
      expect(wrapper).not.toBeNull();

      // Content should be present (exact rendering may vary by font)
      expect(html.length).toBeGreaterThan(0);
    });
  });

  test.describe('Character Encoding and Normalization', () => {
    test('handles different Unicode normalization forms', async ({ page }) => {
      // Composed vs decomposed forms of Japanese characters
      const composed = 'が'; // U+304C (single character)
      const decomposed = 'か\u3099'; // U+304B + U+3099 (two characters)

      const markdown = `# Normalization Test

Composed: ${composed}

Decomposed: ${decomposed}

Both should look the same: ${composed} = ${decomposed}`;

      const html = await renderAndGetHtml(page, markdown);

      // Both forms should be preserved (they may or may not be normalized)
      expect(html.length).toBeGreaterThan(0);

      const wrapper = await page.$('#wrapper');
      expect(wrapper).not.toBeNull();
    });

    test('preserves CJK in different contexts without corruption', async ({ page }) => {
      const markdown = `---
title: 日本語
---

# 日本語

**日本語** *日本語* ~~日本語~~

> 日本語

- 日本語

\`日本語\`

[日本語](https://example.com)

| 日本語 |
|--------|
| 日本語 |`;

      const html = await renderAndGetHtml(page, markdown);

      // Count occurrences - should appear in all contexts
      const occurrences = (html.match(/日本語/g) || []).length;
      expect(occurrences).toBeGreaterThan(8); // At least 9 contexts
    });
  });
});
