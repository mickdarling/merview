# Session Notes: Fixing Syntax Highlighting Theme Backgrounds
**Date:** November 27, 2025
**Repository:** markdown-mermaid-renderer
**Focus:** Fix code block background colors not respecting syntax highlighting themes

## Problem Statement

The markdown + mermaid renderer had a critical CSS issue where code block backgrounds were not respecting the selected syntax highlighting theme. Specifically:
- Dark themes (GitHub Dark, Dracula, Monokai, VS Code Dark+) would show light/white backgrounds instead of their proper dark backgrounds
- Only GitHub Light theme worked correctly
- Switching between themes had no effect on code block backgrounds

The user reported: "the code block background color is light all the time regardless of what syntax highlighting I am using."

## Initial State

- Docker container running on port 8080 (conflicting with another service)
- CSS styles/ directory missing from Docker image
- Hardcoded `github-dark.min.css` link in HTML preventing theme switching
- Complex JavaScript attempting to read and re-apply syntax theme colors
- Document styles overriding syntax highlighting theme styles

## Debugging Process

### Phase 1: Initial Investigation
We activated three dollhouse memories:
- `markdown-renderer-security-fixes`
- `markdown-mermaid-renderer-session`
- `markdown-mermaid-renderer-improvements`

Initial attempts to fix by modifying `applySyntaxOverride()` function with CSS `revert` keyword failed.

### Phase 2: Playwright-Driven Debugging
The breakthrough came when we used Playwright MCP server to actually inspect the browser state in real-time:

```python
# Key diagnostic script
page.evaluate("""() => {
    const code = document.querySelector('pre code.hljs');
    const computed = window.getComputedStyle(code);
    return {
        backgroundColor: computed.backgroundColor,
        matchingRules: [...] // All CSS rules affecting this element
    };
}""")
```

**Critical discoveries:**
1. Computed background was `rgba(0, 0, 0, 0)` (transparent!) despite syntax theme having `rgb(13, 17, 23)`
2. Found the cascade conflict: `#wrapper pre { background: transparent !important; }` was overriding everything
3. Console logs showed `📊 All .hljs rules found: []` - function was running before stylesheets were parsed
4. When switching themes, still reading from `github-dark.min.css` - old stylesheet wasn't being removed

### Phase 3: Root Cause Analysis

Three critical CSS cascade issues identified:

**Issue 1: Document Style Specificity**
```css
/* Clean.css line 85 - PROBLEM */
#wrapper code {
    background-color: rgba(27, 31, 35, 0.05);  /* Light gray! */
}
```
- Specificity: `#wrapper code` = (1,0,1) - 1 ID + 1 element
- Beats: `.hljs` = (0,1,0) - just 1 class
- Result: Document style wins, overrides syntax theme

**Issue 2: Hardcoded Stylesheet**
```html
<!-- Line 26-28 - PROBLEM -->
<link rel="stylesheet" href=".../github-dark.min.css" ... >
```
- No `id` attribute, so JavaScript couldn't remove it
- When switching themes, new theme loaded but old one stayed
- Result: Always reading from github-dark.min.css regardless of selected theme

**Issue 3: CSS Cascade Order & Timing**
- `applySyntaxOverride()` called before CSSOM ready
- Using `revert` keyword reverted to wrong cascade level (transparent parent)
- Complex color-reading logic had timing race conditions

## Solutions Implemented

### Fix 1: Update All Document CSS Files (6 files)
Changed selector to exclude code blocks from document styling:

```css
/* BEFORE */
#wrapper code {
    background-color: rgba(27, 31, 35, 0.05);
}

/* AFTER */
#wrapper code:not(.hljs) {  /* Only inline code! */
    background-color: rgba(27, 31, 35, 0.05);
}
```

Files updated:
- `styles/clean.css`
- `styles/academic.css`
- `styles/dark.css`
- `styles/github.css`
- `styles/monospace.css`
- `styles/newspaper.css`

### Fix 2: Remove Hardcoded Theme Link
```html
<!-- BEFORE -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" ...>

<!-- AFTER -->
<!-- Theme loaded dynamically by JavaScript -->
```

This allows `loadSyntaxTheme()` to properly remove old themes and load new ones.

### Fix 3: Simplify Override Logic
Removed complex color-reading JavaScript:

```javascript
// BEFORE (50+ lines of complex CSSOM reading)
function applySyntaxOverride() {
    // Read .hljs background from stylesheets
    // Try to apply it with !important
    // Handle timing issues
    // ... 50+ lines of complexity
}

// AFTER (12 lines - structure only)
function applySyntaxOverride() {
    syntaxOverride.textContent = `
        #wrapper pre { padding: 0; margin: 1em 0; }
        #wrapper pre code.hljs {
            display: block;
            padding: 1em;
            overflow-x: auto;
            border-radius: 4px;
        }
    `;
}
```

**Key insight:** Just let the natural CSS cascade work! The `.hljs` rules from syntax theme stylesheets apply correctly when nothing interferes.

### Fix 4: Docker Configuration
- Added `styles/` directory to Dockerfile: `COPY --chmod=755 styles/ ./styles/`
- Changed port 8080→8081 in docker-compose.yml (port conflict)

## CSS Cascade Explanation

The fundamental CSS principle: **Last rule wins when specificity is equal.**

Before fix:
1. External CSS: `.hljs { background: #0d1117; }` (specificity: 0,1,0)
2. Document CSS: `#wrapper code { background: rgba(...); }` (specificity: 1,0,1) ← **WINS**

After fix:
1. External CSS: `.hljs { background: #0d1117; }` (specificity: 0,1,0) ← **WINS**
2. Document CSS: `#wrapper code:not(.hljs) { ... }` (doesn't match code blocks!)

## Key Learnings

### 1. Use Playwright for Real Browser Inspection
Instead of guessing, we used Playwright to:
- Monitor console logs during theme switching
- Inspect actual computed styles
- See which CSS rules were matching elements
- Watch the cascade in real-time

```python
# Watch theme switching in real-time
console_logs = []
page.on('console', lambda msg: console_logs.append(msg.text))
page.select_option('#syntaxThemeSelector', 'Dracula')
# See exactly what JavaScript logs
```

### 2. CSS Specificity Always Matters
- ID selectors (1,0,0) beat class selectors (0,1,0)
- `:not()` pseudo-class doesn't add specificity, only its argument does
- `!important` can cause more problems than it solves

### 3. Simplicity Wins
The complex solution (reading .hljs colors via JavaScript and re-applying) failed due to:
- CSSOM timing issues
- Cross-origin stylesheet restrictions (CORS)
- Browser caching
- Race conditions

The simple solution (just don't interfere with the cascade) works perfectly.

### 4. Browser Caching is Real
After all fixes, user still saw light backgrounds until hard refresh:
- Mac: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`
- DevTools: "Empty Cache and Hard Reload"

## Testing Performed

Playwright automated testing across multiple themes:
```python
# Test GitHub Light
page.select_option('#syntaxThemeSelector', 'GitHub Light')
page.wait_for_timeout(2000)

# Test Dracula
page.select_option('#syntaxThemeSelector', 'Dracula')

# Verify computed background
bg = page.evaluate("""() => {
    const code = document.querySelector('pre code.hljs');
    return window.getComputedStyle(code).backgroundColor;
}""")
```

Results: All themes now display correct backgrounds.

## Files Modified

```
Dockerfile                 - Added styles/ directory
docker-compose.yml         - Changed port 8080→8081
index.html                 - Removed hardcoded theme, simplified override
styles/academic.css        - Added :not(.hljs) to code selector
styles/clean.css           - Added :not(.hljs) to code selector
styles/dark.css            - Added :not(.hljs) to code selector
styles/github.css          - Added :not(.hljs) to code selector
styles/monospace.css       - Added :not(.hljs) to code selector
styles/newspaper.css       - Added :not(.hljs) to code selector
```

## Commit

```bash
git add -A
git commit -m "Fix syntax highlighting theme background colors"
```

Commit hash: `883f0d7`

## Outcome

✅ All syntax highlighting themes now work correctly:
- **Dark themes:** GitHub Dark, Dracula, Monokai, VS Code Dark+, Nord, Tokyo Night Dark, etc.
- **Light themes:** GitHub Light, Atom One Light, Tokyo Night Light, Solarized Light, etc.

Code blocks properly display theme-appropriate backgrounds that change when switching themes.

## Tools & Techniques Used

1. **Playwright MCP Server** - Real browser automation and inspection
2. **Browser DevTools** - CSS cascade inspection
3. **Git** - Version control for safe experimentation
4. **Docker** - Containerized deployment
5. **DollhouseMCP Memories** - Context from previous sessions
6. **Code Review Companion & CSS Specialist Personas** - Expert guidance

## Architectural Insights

The markdown renderer architecture now follows proper separation of concerns:
- **Document styles** (`styles/*.css`) - Layout, typography, spacing for content
- **Syntax themes** (external CDN) - Code block colors and highlighting
- **Structure override** (`syntax-override` style element) - Minimal layout for code blocks
- **No interference** - Each layer respects the others

## References

- Highlight.js themes: https://highlightjs.org/static/demo/
- CSS Specificity: https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity
- Playwright documentation: https://playwright.dev/
- CSS Cascade: https://developer.mozilla.org/en-US/docs/Web/CSS/Cascade

---

**Session Duration:** ~3 hours
**Lines of Code Changed:** 51 insertions, 53 deletions (9 files)
**Debugging Method:** Playwright-driven inspection + systematic simplification
**Final Status:** ✅ Fully resolved - all themes working correctly
