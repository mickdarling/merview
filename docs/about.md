# About Merview

[← Back to Welcome](/?sample)

---

## What is Merview?

**Merview** is a client-side Markdown editor and previewer with first-class support for [Mermaid](https://mermaid.js.org/) diagrams. It's designed for developers, technical writers, and anyone who needs to create beautiful documentation with embedded diagrams.

```mermaid
graph LR
    A[Write Markdown] --> B[Add Mermaid Diagrams]
    B --> C[Preview in Real-Time]
    C --> D[Export to PDF]
```

## Key Features

### Privacy-First Design

Everything runs in your browser. Your documents never leave your machine unless you explicitly share them.

- **No server-side processing** - all rendering happens locally
- **No tracking or analytics** - we don't know what you write
- **No account required** - just open and start writing
- **Auto-save to localStorage** - your current work persists across browser sessions (note: loading a URL creates a new working copy; edits don't modify the original source)

### Mermaid Diagram Support

Full support for Mermaid.js diagrams including:

| Diagram Type | Description |
|--------------|-------------|
| Flowcharts | Process flows and decision trees |
| Sequence Diagrams | Interaction between components |
| Class Diagrams | Object-oriented design |
| State Diagrams | State machines and transitions |
| Entity Relationship | Database design |
| Gantt Charts | Project timelines |
| Pie Charts | Data visualization |
| Git Graphs | Branch and commit visualization |
| Mindmaps | Hierarchical brainstorming |
| Timeline | Chronological events |

### Professional Themes

Choose from **6 built-in styles** plus access to **40+ external themes** via the MarkedCustomStyles repository:

- **Clean** - Minimal and modern (default)
- **Academic** - Perfect for papers and reports
- **GitHub** - Familiar GitHub-flavored styling
- **Dark Mode** - Easy on the eyes
- **And many more via external styles...**

[View Theme Guide →](/?url=docs/themes.md)

### Code Syntax Highlighting

Beautiful syntax highlighting for **190+ programming languages** powered by highlight.js:

```javascript
// JavaScript example
const greet = (name) => `Hello, ${name}!`;
console.log(greet('World'));
```

```python
# Python example
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
```

### YAML Front Matter

Display document metadata elegantly with YAML front matter support:

```yaml
---
title: My Document
author: Your Name
date: 2025-12-13
tags:
  - documentation
  - tutorial
---
```

Metadata appears as a collapsible panel at the top of the preview.

### Code Validation

Built-in code linting for common languages:

| Language | Validation |
|----------|------------|
| JSON | Syntax parsing |
| HTML | Tag balance, DOCTYPE |
| CSS | Brace matching |

Toggle the lint panel with the **Lint** button to see issues.

### International Language Support

Full Unicode support for global content:

- **CJK Characters** - Chinese, Japanese, Korean text
- **RTL Languages** - Arabic, Hebrew with proper direction
- **Cyrillic, Greek, Thai** - All Unicode scripts
- **International URLs** - IDN domains supported

### Load From Any URL

Load markdown from any public HTTPS source:

- **GitHub** - Raw files and Gists
- **CDNs** - jsdelivr, unpkg, cdnjs
- **Any HTTPS** - Your own server with CORS headers

Use `?url=` parameter or the Open URL dialog.

### Export Options

- **Save as PDF** - Export using your browser's print dialog (Cmd/Ctrl+P)

**Tips for better PDF exports:**
- Use the browser's print preview to adjust settings
- Toggle **HR as Page Break** for manual pagination control
- Disable headers/footers in print settings for cleaner output
- Content will automatically paginate across multiple pages

- **Save** - Download your document as a `.md` file

## How It Works

```mermaid
sequenceDiagram
    participant User
    participant Editor
    participant Renderer
    participant Preview

    User->>Editor: Type Markdown
    Editor->>Renderer: Parse Content
    Renderer->>Renderer: Highlight Code
    Renderer->>Renderer: Render Mermaid
    Renderer->>Preview: Update Display
    Preview-->>User: See Results Instantly
```

1. **Write** in the left pane using standard Markdown syntax
2. **Preview** updates in real-time in the right pane
3. **Style** your document using the theme selectors
4. **Export** when you're ready to share

## Technology

Merview is built with these open source libraries:

- **[marked](https://marked.js.org/)** - Fast Markdown parsing (MIT)
- **[highlight.js](https://highlightjs.org/)** - Syntax highlighting (BSD-3)
- **[Mermaid](https://mermaid.js.org/)** - Diagram rendering (MIT)
- **[CodeMirror](https://codemirror.net/)** - Editor component (MIT)
- **[DOMPurify](https://github.com/cure53/DOMPurify)** - XSS protection (Apache-2.0/MPL-2.0)

## Open Source

Merview is open source under the **AGPL-3.0 license**.

- **Source Code**: [github.com/mickdarling/merview](https://github.com/mickdarling/merview)
- **Report Issues**: [GitHub Issues](https://github.com/mickdarling/merview/issues)
- **Contribute**: [Contributing Guide](/?url=docs/contributing.md)

## Background

Merview was created by [Mick Darling](https://github.com/mickdarling) as a tool to help build [DollhouseMCP](https://github.com/mickdarling/DollhouseMCP), an MCP server for managing AI personas, skills, and templates. Writing documentation with embedded Mermaid diagrams needed a better workflow, and Merview was born.

It turned out to be a useful tool in its own right, so it's now available as a standalone project. It's maintained because it's genuinely useful—both for DollhouseMCP development and as a general-purpose Markdown+Mermaid editor.

---

## Feature Demos

Try these interactive demos to explore Merview's capabilities:

- [Code Validation](/?url=docs/demos/code-validation.md) - JSON, HTML, CSS linting
- [International Text](/?url=docs/demos/international-text.md) - CJK, RTL, Unicode support
- [YAML Front Matter](/?url=docs/demos/yaml-front-matter.md) - Document metadata
- [Error Handling](/?url=docs/demos/error-handling.md) - CORS, network, validation
- [Mermaid Diagrams](/?url=docs/demos/mermaid-diagrams.md) - All diagram types, edge cases
- [Mermaid Errors](/?url=docs/demos/mermaid-errors.md) - Syntax error examples

[View All Demos →](/?url=docs/demos/index.md)

---

## Navigation

- [← Back to Welcome](/?sample)
- [Developer Kit](/?url=docs/developer-kit.md)
- [Theme Guide](/?url=docs/themes.md)
- [Security](/?url=docs/security.md)
- [Contributing](/?url=docs/contributing.md)
- [Support the Project](/?url=docs/sponsor.md)
