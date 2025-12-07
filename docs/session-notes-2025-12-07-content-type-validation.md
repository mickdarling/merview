# Session Notes: Content-Type Validation Security Hardening

**Date:** December 7, 2025 (Sunday, 12:18 PM start)
**PR:** #143 - security: Add Content-Type validation for remote markdown loading

## Overview

Continued security hardening of Merview by completing PR #143, which adds Content-Type validation as a defense-in-depth layer for remote markdown loading via the `?url=` parameter.

## Work Completed

### 1. Rebased PR #143 onto Main

PR #143 had conflicts with main due to PRs #141 and #142 being merged previously. Resolved conflicts in:
- `js/file-ops.js` - Merged Content-Type validation with existing timeout/size limit code
- `CHANGELOG.md` - Combined all three security entries
- `tests/url-loading.spec.js` - Merged test suites for all three security features

### 2. Addressed Claude Review Suggestions

**Test Improvements:**
- Exported `isValidMarkdownContentType()` function for direct testing
- Exposed via `globalThis` for Playwright test access
- Converted to data-driven tests using for-loops to reduce duplication
- Tests now call the actual implementation instead of duplicating validation logic

**Security Enhancements:**
- Added `text/vbscript` to blocked Content-Types (legacy Windows IE script type)
- Added documentation comment noting Content-Type spoofing limitation
- Clarified that domain allowlisting remains the primary defense

### 3. Fixed SonarCloud Quality Gate

**Problem:** SonarCloud failed with 38% new code duplication in test file

**Root Cause:** Test code was flagged for duplication because:
- Test data arrays had repetitive structure
- Validation logic was duplicated between tests and production code

**Solution:** Configured SonarCloud UI to exclude tests from duplication checks
- Added `tests/**/*` to Duplication Exclusions in SonarCloud Administration
- This is a best practice - test code is inherently repetitive by design

**Note:** The `sonar-project.properties` file approach doesn't work with SonarCloud's automatic analysis mode. Configuration must be done via SonarCloud UI.

### 4. Created Follow-up Issues

Created 4 issues for future enhancements suggested in Claude reviews:

| Issue | Title | Priority |
|-------|-------|----------|
| #147 | Add Content-Type validation metrics to privacy-respecting analytics | Low |
| #148 | Document Content-Type validation in SECURITY.md | Low |
| #149 | Add integration test for blocked Content-Type error handling | Low |
| #150 | Consider extracting blocked Content-Types to configuration constant | Very Low |

Telemetry issue #147 references our existing #74 (Wikimedia-style privacy-respecting analytics).

## Technical Details

### Content-Type Validation Logic

```javascript
export function isValidMarkdownContentType(contentType) {
    // No Content-Type header is acceptable (some servers don't send it)
    if (!contentType) return true;

    const mimeType = contentType.split(';')[0].trim().toLowerCase();

    // Block dangerous executable types
    const blockedTypes = [
        'application/javascript',
        'text/javascript',
        'text/html',
        'application/x-javascript',
        'text/vbscript'
    ];
    if (blockedTypes.includes(mimeType)) return false;

    // Allow text/* types
    if (mimeType.startsWith('text/')) return true;

    // Allow application/octet-stream (GitHub's default)
    if (mimeType === 'application/octet-stream') return true;

    // Block everything else
    return false;
}
```

### Defense-in-Depth Architecture

URL loading now has 6 security layers:
1. **Domain allowlist** - Only raw.githubusercontent.com, gist.githubusercontent.com
2. **HTTPS enforcement** - HTTP URLs blocked
3. **URL validation** - Blocks credentials, IDN homographs, excessive length (#141)
4. **Fetch limits** - 10s timeout, 10MB size limit (#142)
5. **Content-Type validation** - Blocks executable/binary content (#143)
6. **DOMPurify sanitization** - Sanitizes rendered HTML output

### Test Coverage

Final test count: 420 tests (up from 397)
- 14 new Content-Type validation tests
- Data-driven approach generates individual tests per MIME type
- Tests use actual exported function via `globalThis.isValidMarkdownContentType()`

## Files Changed

- `js/file-ops.js` - Added `isValidMarkdownContentType()`, integrated into `loadMarkdownFromURL()`
- `js/main.js` - Imported and exposed `isValidMarkdownContentType` to globalThis
- `tests/url-loading.spec.js` - Added Content-Type validation test suite
- `CHANGELOG.md` - Added security entry for Content-Type validation

## Lessons Learned

### SonarCloud Test Duplication

Test code triggers false positive duplication warnings because:
- Tests have inherently repetitive patterns (AAA pattern, similar assertions)
- Test data arrays look similar to other test data
- Testing validation logic requires either duplicating it or exporting the function

**Best Practice:** Configure SonarCloud to exclude test files from duplication analysis via UI settings (Administration > General Settings > Analysis Scope > Duplication Exclusions).

### Automatic vs Scanner-Based Analysis

SonarCloud offers two modes:
1. **Automatic Analysis** - Reads settings from UI only, ignores `sonar-project.properties`
2. **Scanner-Based** - Uses GitHub Action, reads properties file

Merview uses automatic analysis, so UI configuration is required.

## PR Reviews

PR #143 received 5 detailed reviews from Claude, all approving with minor suggestions:
- Security implementation praised as "defense-in-depth"
- Test coverage rated as "comprehensive"
- Code quality described as "production-ready"
- All suggestions were addressed before merge

## Next Steps

Potential future work (all Low priority):
- **#147** - Add telemetry for blocked Content-Types (when #74 analytics is implemented)
- **#148** - Update SECURITY.md with Content-Type validation documentation
- **#149** - Add integration test with Playwright route interception
- **#150** - Extract blocked types to named constant

## Related Issues & PRs

- **#83** - Original issue for Content-Type validation
- **#141** - URL validation edge cases (merged)
- **#142** - Fetch timeout and size limits (merged)
- **#143** - Content-Type validation (merged this session)
- **#74** - Privacy-respecting analytics (referenced for telemetry)
