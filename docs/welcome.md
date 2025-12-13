# Welcome to Merview

A client-side Markdown editor with first-class Mermaid diagram support.

```mermaid
graph LR
    subgraph Merview Documentation
        A[Welcome<br/>You Are Here]
        B[About]
        C[Developer Kit]
        D[Themes]
        E[Security]
        F[Demos]
        G[Contributing]
        H[Sponsor]
    end

    A --- B
    A --- C
    A --- D
    A --- E
    A --- F
    A --- G
    A --- H

    click B "/?url=docs/about.md" "About Merview"
    click C "/?url=docs/developer-kit.md" "Developer Kit"
    click D "/?url=docs/themes.md" "Theme Guide"
    click E "/?url=docs/security.md" "Security"
    click F "/?url=docs/demos/index.md" "Feature Demos"
    click G "/?url=docs/contributing.md" "Contributing"
    click H "/?url=docs/sponsor.md" "Support the Project"
```

---

## Quick Links

- [About Merview](/?url=docs/about.md) - Features, technology, and how it works
- [Developer Kit](/?url=docs/developer-kit.md) - Integration guide and URL patterns
- [Theme Guide](/?url=docs/themes.md) - 37 document styles and customization
- [Security](/?url=docs/security.md) - Privacy-first design and protections
- [Feature Demos](/?url=docs/demos/index.md) - Interactive examples
- [Contributing](/?url=docs/contributing.md) - How to help improve Merview
- [Support the Project](/?url=docs/sponsor.md) - Sponsor development

---

## Getting Started

### 1. Load a Document

- **Drag & drop** any `.md` file onto the editor
- **Menu → Open** to load from file
- **Menu → Open URL** to load from a URL
- Or just **start typing** in the editor

### 2. Write Markdown

Type in the left pane. The preview updates in real-time on the right.

### 3. Add Mermaid Diagrams

Use fenced code blocks with `mermaid` as the language:

```mermaid
sequenceDiagram
    You->>Merview: Write Markdown
    Merview->>You: See it rendered instantly
```

### 4. Choose Your Style

Use the **Style** dropdown to pick from 37 professional themes.

### 5. Export

Click **Print/PDF** to save your document.

---

## Feature Showcase

### Code Syntax Highlighting

190+ languages supported with beautiful themes:

```javascript
// JavaScript with syntax highlighting
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

### Tables

| Feature | Status |
|---------|--------|
| Markdown Rendering | ✅ |
| Mermaid Diagrams | ✅ |
| Syntax Highlighting | ✅ |
| PDF Export | ✅ |
| 37 Themes | ✅ |
| YAML Front Matter | ✅ |
| Code Validation | ✅ |
| Load from URL | ✅ |
| International Text | ✅ |

### Flowcharts

```mermaid
graph TD
    A[Write Markdown] --> B[Add Diagrams]
    B --> C[Style Document]
    C --> D[Export PDF]
```

### Sequence Diagrams

```mermaid
sequenceDiagram
    participant User
    participant Editor
    participant Preview

    User->>Editor: Type content
    Editor->>Preview: Render
    Preview-->>User: See results
```

### Class Diagrams

```mermaid
classDiagram
    class Document {
        +String content
        +render()
        +export()
    }
    class Theme {
        +String name
        +apply()
    }
    Document --> Theme
```

---

## Tips

1. **Load from URL** - Use `?url=` parameter or the Open URL dialog
2. **YAML Metadata** - Add `---` delimited YAML at the start for document info
3. **Code Validation** - Toggle the Lint button to check JSON, HTML, CSS
4. **Keyboard Shortcuts** - Ctrl+S to save, Ctrl+P to print
5. **Auto-save** - Your work is saved to browser storage

---

## Open Source

Merview is free and open source under the AGPL-3.0 license.

- **GitHub**: [github.com/mickdarling/merview](https://github.com/mickdarling/merview)
- **Issues**: [Report a bug or request a feature](https://github.com/mickdarling/merview/issues)

---

**Start writing!** Clear this document and create something amazing.
