# Session Notes - November 29, 2025 (Evening Session)

## Session Overview
Continuation of markdown-mermaid-renderer improvements. Focus on UI organization, mermaid diagram viewing, and attempted editor/preview sync highlighting.

## Successful Implementations

### 1. Separate Editor and Preview Theme Selectors
- **What**: Created independent syntax highlighting themes for the editor (CodeMirror) and preview (highlight.js)
- **Implementation**:
  - Created `styles/editor/` directory with customizable CSS files:
    - `material-darker.css` (default)
    - `github-dark.css`
    - `monokai.css`
    - `dracula.css`
    - `solarized-dark.css`
    - `solarized-light.css`
  - Added "Editor Theme" dropdown in editor panel header
  - Kept "Style" (document) and "Code" (preview syntax) dropdowns in preview panel header
- **Key change**: CodeMirror now uses `theme: 'custom'` and loads CSS dynamically from local files
- **Benefit**: Users can customize editor themes by editing local CSS files in `styles/editor/`

### 2. Reorganized Toolbar Dropdowns
- **What**: Moved style selectors from main toolbar to their respective panel headers
- **Layout**:
  - Editor panel header: "Editor" label + Theme dropdown
  - Preview panel header: "Preview" label + Style dropdown + Code dropdown
- **CSS**: Added `.panel-selector` and `.panel-selectors` classes for styling dropdowns in headers

### 3. Improved Code Block Readability in Editor
- **Problem**: Code block content in editor was gray and hard to read (styled as `.cm-comment`)
- **Solution**: Updated all editor theme CSS files to make `.cm-comment` use readable colors instead of grayed-out italic text
- **Added**: `.cm-s-custom .cm-comment.cm-m-markdown` selector for code block content with warm/visible colors

### 4. Mermaid Diagram Fullscreen View
- **What**: Added ability to view mermaid diagrams in fullscreen overlay with zoom/pan
- **Features**:
  - Hover over diagram shows expand button (⛶) in top-right corner
  - Double-click on diagram opens fullscreen view
  - Zoom controls: +, -, percentage display, Reset button
  - Mouse wheel zoom
  - Click and drag to pan
  - Close via: ✕ button, Escape key, or clicking outside diagram
- **CSS classes**: `.mermaid-fullscreen-overlay`, `.mermaid-zoom-controls`, `.mermaid-expand-btn`
- **Functions**: `expandMermaid()`, `closeMermaidFullscreen()`, `mermaidZoomIn/Out/Reset()`, pan handlers

### 5. Disabled Editor Drag-and-Drop
- **What**: Disabled accidental drag-and-drop of selected text in CodeMirror
- **Implementation**: Added `dragDrop: false` to CodeMirror initialization options

## Failed Implementations (Editor/Preview Sync Highlighting)

### Goal
When selecting text in one panel, highlight the corresponding text in the other panel to help users navigate between editor and preview.

### Approach 1: Direct Text Search with DOM Manipulation
- **Method**: Find selected text, use `range.surroundContents()` to wrap matches in `<mark>` elements
- **Problem**: Modifying the DOM with `surroundContents()` broke the preview - letters disappeared, content corrupted
- **Why it failed**: `surroundContents()` can't handle ranges that cross element boundaries and modifies the actual DOM structure

### Approach 2: Overlay Highlights
- **Method**: Create absolutely positioned `<div>` overlays on top of matched text using `range.getClientRects()`
- **Problem**: Position calculations were inaccurate, highlights didn't align with text
- **Why it failed**: Complex coordinate translation between scroll positions, element offsets, and viewport

### Approach 3: First-Occurrence Text Matching
- **Method**: Find first occurrence of selected text in other panel
- **Problem**: Always highlighted the first instance, not the one corresponding to selection position
- **Why it failed**: Documents often have repeated words/phrases; first-match is wrong when selecting later occurrences

### Approach 4: Position-Percentage Matching
- **Method**: Calculate vertical position percentage of selection, find all occurrences, pick closest by position
- **Implementation**: Normalized whitespace, built position maps, calculated percentages
- **Problem**: Position mapping between markdown source and rendered HTML is not linear - rendered output has different spacing, collapsed elements, etc.
- **Why it failed**: A word at 50% of the editor is not necessarily at 50% of the preview

### Approach 5: Element-Type Occurrence Counting
- **Method**: Count which occurrence of element type (e.g., 3rd `<p>`) the selection is in, find 3rd paragraph in editor
- **Problem**: Markdown structure doesn't map 1:1 to HTML - blank lines, nested elements, and rendering quirks cause count mismatches
- **Why it failed**: Element counts diverge between source and rendered output

### Approach 6: Invisible Marker Injection
- **Method**: Insert zero-width space marker at cursor, re-render to temp container, find marker's parent element, match in actual preview
- **Implementation**: Used `\u200B\u200B\u200B` as marker, rendered with `marked.parse()`, searched for marker
- **Problem**: Still relied on text matching to find corresponding element; worked "half-decently" but unreliable
- **Why it failed**: After finding marker location, still needed to match element content which could have duplicates

### Root Cause of All Failures
The fundamental problem is that **markdown parsing doesn't preserve source line numbers**. The `marked` library (and most markdown parsers) don't track which source lines produced which output elements. Without this source mapping, any sync solution is essentially guessing.

### Potential Future Solutions (Not Attempted)

1. **Source Map Generation**: Fork or extend `marked` to emit source line info as `data-source-line` attributes on rendered elements. This would provide definitive mapping.

2. **Custom Markdown Parser**: Use a parser that supports source maps (like `remark` with position info) instead of `marked`.

3. **Line-Number Sidebar**: Instead of highlighting, show line numbers in preview that correspond to editor lines (like some diff tools).

4. **Scroll Sync Only**: Sync scroll position percentage between panels without trying to highlight specific text.

5. **Click-to-Jump**: Single-click in preview scrolls editor to approximate location (using percentage), without highlighting.

## Technical Notes

### Docker Rebuild Command
```bash
docker stop markdown-renderer && docker rm markdown-renderer && docker build -t markdown-mermaid-renderer:latest /Users/mick/Developer/markdown-mermaid-renderer && docker run -d --name markdown-renderer -p 8081:80 markdown-mermaid-renderer:latest
```

### Files Modified This Session
- `index.html` - Main application (theme selectors, mermaid fullscreen, sync attempts)
- `styles/editor/*.css` - New editor theme files (6 files)

### Key CSS Selectors Added
- `.panel-selector`, `.panel-selectors` - Dropdown styling in panel headers
- `.mermaid-container`, `.mermaid-expand-btn` - Mermaid expand button
- `.mermaid-fullscreen-overlay`, `.mermaid-zoom-controls` - Fullscreen view
- `.cm-s-custom .cm-comment` - Improved code block visibility

## Session Duration
Started: ~6:40 PM
Multiple iterations on sync highlighting attempted and removed
