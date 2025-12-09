# Session Notes: Document Selector Redesign

**Date:** 2024-12-09
**Related Issues:** #177 (Open menu), #139 (Document name indicator)

## Summary

Redesigned the Open menu functionality to use a Document Selector that follows the same pattern as the theme selectors (Style, Syntax, Editor, Mermaid). This provides a more consistent UI and shows the current document name.

## What Was Implemented

### 1. Document Selector (Completed)
- **Location:** Editor panel header, left side next to "Editor" label
- **Pattern:** Standard `<select>` element with `<optgroup>` sections
- **Sections:**
  - "Current" optgroup: Shows current document name (e.g., "Welcome.md", "Untitled")
  - "Import" optgroup: Load from file..., Load from URL..., New document

### 2. Document Name Tracking (Completed)
- Sample document now named "Welcome.md" instead of showing "Untitled"
- Loading from file uses the file's actual name
- Loading from URL extracts filename from URL path
- New document shows "Untitled"
- Selector updates automatically when document changes

### 3. GitHub URL Normalization (Completed)
- Added `normalizeGitHubUrl()` in `js/security.js`
- Converts `github.com/user/repo/blob/branch/path` to `raw.githubusercontent.com` URLs
- Combined with existing gist URL normalization in `normalizeGitHubContentUrl()`

### 4. UI Layout Change
- Document selector positioned on LEFT side (what the thing is)
- Theme selector positioned on RIGHT side (configuration)
- Added `.panel-title-group` CSS class for grouping

## Files Modified

- `index.html` - Added document selector to Editor panel, new CSS for layout
- `js/documents.js` - NEW: Document management module
- `js/file-ops.js` - Added `updateDocumentSelector()` calls after loading content
- `js/security.js` - Added `normalizeGitHubUrl()` and `normalizeGitHubContentUrl()`
- `js/main.js` - Updated imports, exposed new global functions
- `js/components/url-modal.js` - Uses new URL normalization
- `js/themes.js` - Uses new URL normalization
- `tests/open-functionality.spec.js` - Updated for new selector pattern
- `tests/save-functionality.spec.js` - Updated for Welcome.md default
- `tests/share-to-gist.spec.js` - Updated for Welcome.md default
- `tests/source-link.spec.js` - Updated selector reference

## Test Status

**All 591 tests passing**

## Known Limitations / Future Work

### Document History (Not Implemented)
The current implementation does NOT maintain a history of previously opened documents. The selector only shows:
- Current document name
- Import options

**Future enhancement idea:** Add a "Recent" optgroup that tracks recently opened documents in localStorage. This would require:
1. Storing document metadata (name, source URL/file, timestamp) in localStorage
2. Adding a "Recent" optgroup between "Current" and "Import"
3. Handling document switching when selecting from history
4. Limiting history size (e.g., last 10 documents)

### Browser Caching
Users may need to hard refresh (Cmd+Shift+R) to see changes due to browser caching of JavaScript files. The fix works correctly in incognito mode.

## How to Test

1. Start local server: `npx http-server -p 8083`
2. Open http://localhost:8083 (use incognito to avoid cache)
3. Verify:
   - Document selector shows "Welcome.md" on fresh load
   - "New document" changes to "Untitled"
   - "Load Sample" changes back to "Welcome.md"
   - "Load from file..." opens file picker
   - "Load from URL..." opens URL modal
   - Loading a file updates selector with filename

## Architecture Notes

### Circular Dependency Avoidance
`file-ops.js` cannot directly import from `documents.js` due to circular dependency. Solution: Use `globalThis.updateDocumentSelector()` which is exposed by `main.js` after initialization.

### Module Structure
```
main.js
├── imports documents.js (exports updateDocumentSelector)
├── imports file-ops.js (exports loadSample, loadMarkdownFile, etc.)
└── exposeGlobalFunctions() makes updateDocumentSelector available globally
```

## PR Status

Work is in progress on the current branch. Tests are passing. Ready for final review and merge after addressing any user feedback.
