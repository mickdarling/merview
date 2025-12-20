# Session Notes: December 20, 2025 - Mermaid File Support

## Session Overview
Saturday morning session focused on ecosystem integration and implementing .mermaid/.mmd file support.

## Issues Created

### Bug Report
- **#363** - Lazy-loaded Mermaid diagrams missing from PDF export
  - When HR page breaks enabled, diagrams below the fold don't render in PDF
  - Need to force-render all diagrams before print

### Ecosystem Submission Tracking
- **#364** - Submit Merview to Mermaid.js official integrations list (HIGH PRIORITY)
  - Blocked until #367 is complete
  - Requires PR to mermaid-js/mermaid repo
- **#365** - Submit Merview to AlternativeTo
- **#366** - Submit Merview to OpenSourceAlternative.to

### Feature Implementation
- **#367** - Add .mermaid/.mmd file extension support ✅ IMPLEMENTED
  - PR #369 created and ready for review
- **#368** - Add toggle to show/hide frontmatter in preview
  - Separated from #367 to keep scope focused

## Hacker News Post
- Posted to HN Friday night (Dec 19): https://news.ycombinator.com/item?id=42331757
- One comment - user added Merview to nocomplexity.com architecture playbook
- Listed at: https://nocomplexity.com/documents/arplaybook/software-architecture.html#mermaid

## Implementation: #367 - Mermaid File Support

### Problem Solved
Users copying Mermaid examples from mermaid.js.org (which don't have fences) and pasting into Merview would see plain text instead of rendered diagrams. Embarrassing for a "Mermaid viewer"!

### Detection Logic
```
1. Has ```mermaid fences? → Markdown mode
2. Strip frontmatter if present
3. Try mermaid.parse() → Success = pure mermaid, Error = markdown
```

Key insight: Use Mermaid's own parser as source of truth, not regex patterns. Prevents false positives like "pie is very tasty" rendering as a pie chart.

### Files Modified
| File | Changes |
|------|---------|
| `js/state.js` | Added `documentMode` property |
| `js/file-ops.js` | Validation, loading, saving with content transformation |
| `js/renderer.js` | `isPureMermaidContent()` and `renderPureMermaid()` functions |
| `js/utils.js` | Updated `isMarkdownUrl()` for new extensions |
| `js/documents.js` | Reset `documentMode` on new document |
| `tests/mermaid-file-support.spec.js` | 14 new tests |

### Key Features
- Accepts `.mermaid` and `.mmd` file extensions
- Accepts `text/vnd.mermaid` MIME type
- Auto-detects pure Mermaid content when pasted/typed
- Smart save: `.mermaid` saves without fences, `.md` wraps in fences
- Supports Mermaid's YAML frontmatter (config blocks)

### Test Results
- 14 new tests, all passing
- Full suite: 1189 passed, 9 failed (pre-existing PDF/HR issues)

## Mermaid Ecosystem Requirements
From https://mermaid.js.org/ecosystem/integrations-create.html:
- File extensions: `.mermaid` or `.mmd` ✅
- MIME type: `text/vnd.mermaid` ✅
- Mermaid files can have YAML frontmatter for config

## Related Issues (Pre-existing)
- #271 - TOML frontmatter support
- #272 - JSON frontmatter support
- #309 - Improve nested field rendering in YAML frontmatter

## Next Steps

### Immediate (Next Session)
1. **Review/merge PR #369** - Mermaid file support
2. **Create PR for #364** - Submit to Mermaid.js integrations list
   - Add entry to mermaid-js/mermaid repo: packages/mermaid/src/docs/ecosystem/integrations-community.md
   - Entry: `- [Merview](https://merview.com) ✅`
   - Goes in "Productivity Tools" section

### Short Term
3. Submit to AlternativeTo (#365)
4. Submit to OpenSourceAlternative.to (#366)
5. Fix lazy-load PDF bug (#363)

### Medium Term
6. Frontmatter display toggle (#368)
7. Fix failing PDF/HR tests (9 tests)

## Technical Notes

### Document Mode State
```javascript
state.documentMode = null | 'markdown' | 'mermaid'
```
- `null`: Auto-detect on each render
- `'markdown'`: Force markdown rendering (set by .md file load)
- `'mermaid'`: Force mermaid rendering (set by .mermaid/.mmd file load)

### Content Transformation on Save
- Saving as `.mermaid`/`.mmd`: Strip fences if present
- Saving as `.md` when documentMode='mermaid': Wrap in fences

## Session Stats
- Duration: ~2 hours
- Issues created: 6 (#363-#368)
- PR created: 1 (#369)
- Tests added: 14
- Lines changed: +482, -34
