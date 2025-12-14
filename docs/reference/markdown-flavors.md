# Markdown Flavors Reference

A comprehensive comparison of markdown flavors and their capabilities.

## Quick Comparison Table

| Feature | CommonMark | GFM (GitHub) | MultiMarkdown | Kramdown | Obsidian |
|---------|:----------:|:------------:|:-------------:|:--------:|:--------:|
| **Basic syntax** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Tables** | ❌ | ✅ | ✅ (+ colspan) | ✅ (+ colspan) | ✅ |
| **Fenced code blocks** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Task lists** `- [ ]` | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Strikethrough** `~~text~~` | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Autolinks** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Footnotes** `[^1]` | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Wiki links** `[[page]]` | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Callouts** `> [!note]` | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Definition lists** | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Abbreviations** | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Math (LaTeX)** `$x^2$` | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Table of Contents** | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Metadata (YAML)** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Citations** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Custom attributes** `{:.class}` | ❌ | ❌ | ✅ | ✅ | ❌ |
| **File transclusion** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Smart quotes** | ❌ | ❌ | ✅ | ✅ | ❌ |

---

## Flavor Details

### CommonMark

**Purpose:** The strict, unambiguous standard specification.

**Philosophy:** Define exactly what markdown *is* so all parsers produce identical output.

**Key characteristics:**
- Baseline spec everyone agrees on
- No extensions, just the basics
- Maximum portability across tools
- Spec: https://commonmark.org/

**Best for:** Maximum compatibility, simple documents.

---

### GFM (GitHub Flavored Markdown)

**Purpose:** Developer-focused markdown for code collaboration.

**Philosophy:** Extend CommonMark with features developers need daily.

**Unique features:**
- **Tables** - Pipe-based tables
- **Task lists** - `- [ ]` and `- [x]` checkboxes
- **Strikethrough** - `~~deleted text~~`
- **Autolinks** - URLs automatically become links
- **Syntax highlighting** - Language-specific code blocks
- **@mentions** - Link to GitHub users
- **#references** - Link to issues/PRs

**Syntax examples:**
```markdown
| Header | Header |
|--------|--------|
| Cell   | Cell   |

- [x] Completed task
- [ ] Pending task

~~strikethrough~~
```

**Best for:** README files, GitHub issues/PRs, developer documentation.

---

### MultiMarkdown

**Purpose:** Academic writing, publishing, and complex documents.

**Philosophy:** Add features needed for serious document production.

**Unique features:**
- **Footnotes** - `[^1]` references with definitions
- **Citations** - Academic citation support
- **Definition lists** - Term/definition pairs
- **Table captions** - Titles for tables
- **Colspan/rowspan** - Complex table layouts
- **Cross-references** - Internal document links
- **Metadata** - Document properties
- **Math** - LaTeX equation support
- **File transclusion** - Include other files
- **Smart typography** - Curly quotes, em-dashes

**Syntax examples:**
```markdown
Term
:   Definition of the term

[^1]: This is a footnote definition.

{{other-file.md}}

<!--#include file="chapter1.md" -->
```

**Best for:** Academic papers, books, technical documentation, publishing.

---

### Kramdown

**Purpose:** Ruby/Jekyll ecosystem markdown with fine-grained control.

**Philosophy:** Give authors precise control over HTML output.

**Unique features:**
- **Inline attributes** - Add classes/IDs to any element
- **Block attributes** - Style blocks precisely
- **Definition lists** - Like MultiMarkdown
- **Footnotes** - Like MultiMarkdown
- **Math** - LaTeX support
- **Table of contents** - Auto-generated
- **Abbreviations** - Define abbreviations once

**Syntax examples:**
```markdown
This is a paragraph.
{: .custom-class #custom-id}

# Header {#custom-anchor}

*[HTML]: Hyper Text Markup Language

{:toc}
```

**Best for:** Jekyll sites, GitHub Pages, Ruby projects.

---

### Obsidian

**Purpose:** Personal knowledge management and note-taking.

**Philosophy:** Connect ideas through linked notes (zettelkasten method).

**Unique features:**
- **Wiki links** - `[[page]]` and `[[page|display text]]`
- **Embeds** - `![[file]]` transcludes content
- **Block references** - `[[page#^block-id]]`
- **Callouts** - Styled admonition blocks
- **Tags** - `#tag` for organization
- **Backlinks** - See what links to current note
- **Graph view** - Visualize note connections
- **Frontmatter** - YAML metadata

**Syntax examples:**
```markdown
[[Another Note]]
[[Note|Custom Display Text]]

![[embedded-note]]
![[note#section]]

> [!note]
> This is a note callout

> [!warning]
> This is a warning callout

> [!tip] Custom Title
> Tips are helpful!

#tag #another-tag
```

**Callout types:** note, abstract, info, tip, success, question, warning, failure, danger, bug, example, quote

**Best for:** Personal notes, knowledge bases, zettelkasten, PKM.

---

## Merview Current Support

Merview uses **marked.js** (GFM-compatible) plus custom extensions:

### Currently Supported
- ✅ All CommonMark basics
- ✅ GFM tables
- ✅ Task lists
- ✅ Strikethrough
- ✅ Fenced code blocks with syntax highlighting
- ✅ Autolinks
- ✅ **Mermaid diagrams** (custom)
- ✅ **YAML front matter** (custom)

### Not Yet Supported (Future Opportunities)
- ❌ Footnotes
- ❌ Wiki links `[[page]]`
- ❌ Callouts `> [!note]`
- ❌ Math/LaTeX `$x^2$`
- ❌ Definition lists
- ❌ File transclusion
- ❌ Custom attributes `{:.class}`
- ❌ Citations

See [Issue #306](https://github.com/mickdarling/merview/issues/306) for planned enhancements.

---

## Conversion Considerations

When converting between flavors, watch for:

| From → To | Potential Issues |
|-----------|------------------|
| Obsidian → GFM | Wiki links won't work, callouts become blockquotes |
| MultiMarkdown → GFM | Footnotes lost, definition lists break |
| Kramdown → CommonMark | Attributes stripped, abbreviations lost |
| GFM → CommonMark | Tables and task lists won't render |

**Safe conversions:**
- CommonMark → anything (it's the subset)
- GFM → MultiMarkdown/Kramdown (supersets)

---

## Resources

- **CommonMark Spec:** https://commonmark.org/
- **GFM Spec:** https://github.github.com/gfm/
- **MultiMarkdown:** https://fletcherpenney.net/multimarkdown/
- **Kramdown:** https://kramdown.gettalong.org/
- **Obsidian Help:** https://help.obsidian.md/
- **Apex (unified processor):** https://github.com/ttscoff/apex

---

*Last updated: December 2025*
