// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Mick Darling

// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test suite for IDN (Internationalized Domain Names) support with homograph attack protection
 *
 * This test suite validates that:
 * 1. Pure ASCII domains are allowed
 * 2. Legitimate international domains (Japanese, Chinese, Korean, etc.) are allowed
 * 3. Homograph attacks using mixed-script lookalikes are blocked
 * 4. Both uppercase and lowercase homoglyphs are detected
 */
test.describe('IDN and Homograph Protection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test.describe('Allowed domains', () => {
        test('pure ASCII domains should be allowed', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                return {
                    github: isAllowedMarkdownURL('https://raw.githubusercontent.com/user/repo/main/file.md'),
                    example: isAllowedMarkdownURL('https://example.com/path/to/file.md'),
                    subdomain: isAllowedMarkdownURL('https://docs.example.com/guide.md')
                };
            });

            expect(result.github).toBe(true);
            expect(result.example).toBe(true);
            expect(result.subdomain).toBe(true);
        });

        test('pure Japanese domains should be allowed', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                return {
                    japanese: isAllowedMarkdownURL('https://例え.jp/document.md'),
                    hiragana: isAllowedMarkdownURL('https://ひらがな.com/file.md'),
                    katakana: isAllowedMarkdownURL('https://カタカナ.co.jp/doc.md')
                };
            });

            expect(result.japanese).toBe(true);
            expect(result.hiragana).toBe(true);
            expect(result.katakana).toBe(true);
        });

        test('pure Chinese domains should be allowed', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                return {
                    simplified: isAllowedMarkdownURL('https://中文.com/document.md'),
                    traditional: isAllowedMarkdownURL('https://繁體.tw/file.md')
                };
            });

            expect(result.simplified).toBe(true);
            expect(result.traditional).toBe(true);
        });

        test('pure Korean domains should be allowed', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                return {
                    hangul: isAllowedMarkdownURL('https://한글.kr/document.md'),
                    korean: isAllowedMarkdownURL('https://대한민국.com/file.md')
                };
            });

            expect(result.hangul).toBe(true);
            expect(result.korean).toBe(true);
        });

        test('pure Arabic domains should be allowed', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                return isAllowedMarkdownURL('https://العربية.com/document.md');
            });

            expect(result).toBe(true);
        });
    });

    test.describe('Cyrillic homograph attacks (lowercase)', () => {
        test('Cyrillic а (U+0430) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "rаw" with Cyrillic 'а' (U+0430) instead of Latin 'a'
                return isAllowedMarkdownURL('https://rаw.githubusercontent.com/user/repo/main/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic е (U+0435) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "еxample" with Cyrillic 'е' (U+0435) instead of Latin 'e'
                return isAllowedMarkdownURL('https://еxample.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic о (U+043E) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "gооgle" with Cyrillic 'о' (U+043E) instead of Latin 'o'
                return isAllowedMarkdownURL('https://gооgle.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic р (U+0440) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "раypal" with Cyrillic 'р' (U+0440) instead of Latin 'p'
                return isAllowedMarkdownURL('https://раypal.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic с (U+0441) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "miсrosoft" with Cyrillic 'с' (U+0441) instead of Latin 'c'
                return isAllowedMarkdownURL('https://miсrosoft.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic х (U+0445) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "eхample" with Cyrillic 'х' (U+0445) instead of Latin 'x'
                return isAllowedMarkdownURL('https://eхample.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic у (U+0443) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "уahoo" with Cyrillic 'у' (U+0443) instead of Latin 'y'
                return isAllowedMarkdownURL('https://уahoo.com/file.md');
            });

            expect(result).toBe(false);
        });
    });

    test.describe('Cyrillic homograph attacks (uppercase)', () => {
        test('Cyrillic А (U+0410) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "АBC" with Cyrillic 'А' (U+0410) instead of Latin 'A'
                return isAllowedMarkdownURL('https://АBC.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic В (U+0412) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "aВc" with Cyrillic 'В' (U+0412) instead of Latin 'B'
                return isAllowedMarkdownURL('https://aВc.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic Е (U+0415) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Еxample" with Cyrillic 'Е' (U+0415) instead of Latin 'E'
                return isAllowedMarkdownURL('https://Еxample.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic К (U+041A) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Кickstarter" with Cyrillic 'К' (U+041A) instead of Latin 'K'
                return isAllowedMarkdownURL('https://Кickstarter.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic М (U+041C) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Мicrosoft" with Cyrillic 'М' (U+041C) instead of Latin 'M'
                return isAllowedMarkdownURL('https://Мicrosoft.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic Н (U+041D) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "gitНub" with Cyrillic 'Н' (U+041D) instead of Latin 'H'
                return isAllowedMarkdownURL('https://gitНub.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic О (U+041E) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "gООgle" with Cyrillic 'О' (U+041E) instead of Latin 'O'
                return isAllowedMarkdownURL('https://gООgle.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic Р (U+0420) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Рaypal" with Cyrillic 'Р' (U+0420) instead of Latin 'P'
                return isAllowedMarkdownURL('https://Рaypal.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic Т (U+0422) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Тwitter" with Cyrillic 'Т' (U+0422) instead of Latin 'T'
                return isAllowedMarkdownURL('https://Тwitter.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic У (U+0423) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Уoutube" with Cyrillic 'У' (U+0423) instead of Latin 'Y'
                return isAllowedMarkdownURL('https://Уoutube.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Cyrillic Х (U+0425) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "boХ" with Cyrillic 'Х' (U+0425) instead of Latin 'X'
                return isAllowedMarkdownURL('https://boХ.com/file.md');
            });

            expect(result).toBe(false);
        });
    });

    test.describe('Greek homograph attacks (lowercase)', () => {
        test('Greek α (U+03B1) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "αpple" with Greek 'α' (U+03B1) instead of Latin 'a'
                return isAllowedMarkdownURL('https://αpple.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek ο (U+03BF) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "gοοgle" with Greek 'ο' (U+03BF) instead of Latin 'o'
                return isAllowedMarkdownURL('https://gοοgle.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek υ (U+03C5) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "hυperlink" with Greek 'υ' (U+03C5) instead of Latin 'u'
                return isAllowedMarkdownURL('https://hυperlink.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek ι (U+03B9) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "lιnkedin" with Greek 'ι' (U+03B9) instead of Latin 'i'
                return isAllowedMarkdownURL('https://lιnkedin.com/file.md');
            });

            expect(result).toBe(false);
        });
    });

    test.describe('Greek homograph attacks (uppercase)', () => {
        test('Greek Α (U+0391) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Αpple" with Greek 'Α' (U+0391) instead of Latin 'A'
                return isAllowedMarkdownURL('https://Αpple.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek Β (U+0392) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "aΒc" with Greek 'Β' (U+0392) instead of Latin 'B'
                return isAllowedMarkdownURL('https://aΒc.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek Ε (U+0395) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Εxample" with Greek 'Ε' (U+0395) instead of Latin 'E'
                return isAllowedMarkdownURL('https://Εxample.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek Η (U+0397) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Ηello" with Greek 'Η' (U+0397) instead of Latin 'H'
                return isAllowedMarkdownURL('https://Ηello.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek Ι (U+0399) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "lΙnkedin" with Greek 'Ι' (U+0399) instead of Latin 'I'
                return isAllowedMarkdownURL('https://lΙnkedin.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek Κ (U+039A) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Κickstarter" with Greek 'Κ' (U+039A) instead of Latin 'K'
                return isAllowedMarkdownURL('https://Κickstarter.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek Μ (U+039C) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Μicrosoft" with Greek 'Μ' (U+039C) instead of Latin 'M'
                return isAllowedMarkdownURL('https://Μicrosoft.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek Ν (U+039D) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Νetflix" with Greek 'Ν' (U+039D) instead of Latin 'N'
                return isAllowedMarkdownURL('https://Νetflix.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek Ο (U+039F) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "gΟΟgle" with Greek 'Ο' (U+039F) instead of Latin 'O'
                return isAllowedMarkdownURL('https://gΟΟgle.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek Ρ (U+03A1) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Ρaypal" with Greek 'Ρ' (U+03A1) instead of Latin 'P'
                return isAllowedMarkdownURL('https://Ρaypal.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek Τ (U+03A4) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Τwitter" with Greek 'Τ' (U+03A4) instead of Latin 'T'
                return isAllowedMarkdownURL('https://Τwitter.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek Υ (U+03A5) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "Υoutube" with Greek 'Υ' (U+03A5) instead of Latin 'Y'
                return isAllowedMarkdownURL('https://Υoutube.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Greek Χ (U+03A7) mixed with Latin should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "boΧ" with Greek 'Χ' (U+03A7) instead of Latin 'X'
                return isAllowedMarkdownURL('https://boΧ.com/file.md');
            });

            expect(result).toBe(false);
        });
    });

    test.describe('Real-world attack scenarios', () => {
        test('GitHub raw domain homograph attack should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "rаw.githubusercontent.com" with Cyrillic 'а' (U+0430) - classic attack
                return isAllowedMarkdownURL('https://rаw.githubusercontent.com/user/repo/main/malicious.md');
            });

            expect(result).toBe(false);
        });

        test('Multiple homoglyphs in same domain should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "gοοgle" with multiple Greek 'ο' (U+03BF)
                return isAllowedMarkdownURL('https://gοοgle.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Homoglyph in subdomain should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "аpi.example.com" with Cyrillic 'а' (U+0430) in subdomain
                return isAllowedMarkdownURL('https://аpi.example.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Mixed uppercase and lowercase homoglyphs should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // "GitНub" with Latin 'G' + 'i' + 't' + Cyrillic 'Н' (U+041D) + 'u' + 'b'
                return isAllowedMarkdownURL('https://GitНub.com/file.md');
            });

            expect(result).toBe(false);
        });
    });

    test.describe('Edge cases', () => {
        test('Very long URLs with homoglyphs should be blocked by length check first', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // URL longer than 2048 characters with homoglyph
                const longPath = 'a'.repeat(2100);
                return isAllowedMarkdownURL(`https://rаw.githubusercontent.com/${longPath}`);
            });

            expect(result).toBe(false);
        });

        test('URL with credentials and homoglyphs should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // URL with credentials (blocked separately) and homoglyph
                return isAllowedMarkdownURL('https://user:pass@rаw.githubusercontent.com/file.md');
            });

            expect(result).toBe(false);
        });

        test('Non-HTTPS URL with homoglyphs should be blocked', async ({ page }) => {
            const result = await page.evaluate(() => {
                const { isAllowedMarkdownURL } = window;
                // HTTP (not HTTPS) with homoglyph - should fail HTTPS check
                return isAllowedMarkdownURL('http://rаw.githubusercontent.com/file.md');
            });

            expect(result).toBe(false);
        });
    });
});
