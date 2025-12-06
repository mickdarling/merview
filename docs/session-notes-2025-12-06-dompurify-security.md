# Session Notes: DOMPurify XSS Security Implementation

**Date:** December 6, 2025
**Issue:** #127 - Add DOMPurify to sanitize rendered markdown HTML
**Branch:** `security/dompurify-xss-protection`
**Status:** Ready for implementation

## Problem Discovery

During discussion about expanding URL loading capabilities for public launch, we identified a critical security gap:

### The Vulnerability

In `js/renderer.js:129-130`:
```javascript
const html = marked.parse(markdown);
wrapper.innerHTML = html;
```

**marked.js does NOT sanitize HTML by default.** This allows XSS attacks:

```markdown
# Hello
<script>alert('XSS')</script>
<img src="x" onerror="alert('XSS')">
[Click me](javascript:alert('XSS'))
```

### Why This Matters

1. Merview supports loading markdown via `?url=` parameter
2. The domain allowlist (GitHub only) provides false security - gists are unmoderated
3. Anyone can create a malicious gist and share a Merview link
4. XSS executes in the Merview domain context

### What IS Currently Protected

- Mermaid diagrams: `securityLevel: 'strict'` blocks click handlers
- Code blocks: `escapeHtml()` sanitizes code content
- General HTML in markdown: **NOT PROTECTED**

## Solution: DOMPurify

[DOMPurify](https://github.com/cure53/DOMPurify) is the industry-standard HTML sanitizer.

### Implementation Plan

1. **Add DOMPurify from CDN** with SRI hash to `index.html`
2. **Modify `js/renderer.js`**:
   ```javascript
   const html = marked.parse(markdown);
   wrapper.innerHTML = DOMPurify.sanitize(html);
   ```
3. **Configure DOMPurify** to preserve safe markdown elements
4. **Add Playwright tests** for XSS payload blocking
5. **Update SECURITY.md** documentation

### DOMPurify CDN Info

```html
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.2.2/dist/purify.min.js"
        integrity="sha384-[HASH]"
        crossorigin="anonymous"></script>
```

Need to generate SRI hash for the specific version.

### Configuration Considerations

DOMPurify default config should work, but verify it allows:
- All standard HTML elements (h1-h6, p, a, img, table, etc.)
- Class attributes (needed for syntax highlighting)
- ID attributes (needed for anchor links)
- Safe link protocols (http, https, mailto)

And blocks:
- `<script>` tags
- Event handlers (onclick, onerror, etc.)
- `javascript:` URLs
- `data:` URLs (potentially dangerous)

## Test Cases to Add

Create `tests/xss-prevention.spec.js`:

```javascript
const XSS_PAYLOADS = [
  { name: 'script tag', payload: '<script>alert("XSS")</script>' },
  { name: 'img onerror', payload: '<img src="x" onerror="alert(\'XSS\')">' },
  { name: 'javascript URL', payload: '[click](javascript:alert("XSS"))' },
  { name: 'svg onload', payload: '<svg onload="alert(\'XSS\')">' },
  { name: 'iframe', payload: '<iframe src="javascript:alert(\'XSS\')"></iframe>' },
  { name: 'event handler', payload: '<div onclick="alert(\'XSS\')">click</div>' },
];

for (const { name, payload } of XSS_PAYLOADS) {
  test(`should block XSS via ${name}`, async ({ page }) => {
    // Set content with payload
    // Verify script doesn't execute
    // Verify dangerous attributes stripped
  });
}
```

## Future Considerations

Once DOMPurify is implemented:
1. **Expand URL allowlist** - Can safely load from any domain
2. **Or remove allowlist entirely** - Content is sanitized regardless of source
3. **Document in README** - Users should know their content is sanitized

## References

- [Snyk: Fixing marked XSS vulnerability](https://snyk.io/blog/marked-xss-vulnerability/)
- [marked.js Discussion: Sanitize and sanitizer](https://github.com/markedjs/marked/discussions/1232)
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify)
- [Markdown's XSS Vulnerability](https://github.com/showdownjs/showdown/wiki/Markdown's-XSS-Vulnerability-(and-how-to-mitigate-it))

## Next Session Checklist

- [ ] Get DOMPurify CDN URL and generate SRI hash
- [ ] Add script tag to index.html
- [ ] Modify renderer.js to use DOMPurify.sanitize()
- [ ] Test manually with XSS payloads
- [ ] Create xss-prevention.spec.js test file
- [ ] Run full test suite (324+ tests)
- [ ] Update SECURITY.md
- [ ] Create PR linking to issue #127
- [ ] Verify SonarCloud passes
- [ ] Merge and consider URL allowlist expansion
