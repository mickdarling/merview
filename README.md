# Merview

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=mickdarling_merview&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=mickdarling_merview)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=mickdarling_merview&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=mickdarling_merview)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=mickdarling_merview&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=mickdarling_merview)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=mickdarling_merview&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=mickdarling_merview)

**[Try it now at merview.com](https://merview.com)** - No signup required!

A client-side markdown editor with live Mermaid diagram rendering. No logins, no payments, completely free and open source.

![Merview Screenshot](docs/images/merview-screenshot.png)

## Features

- **Real-time Markdown rendering** - See your changes instantly
- **37 Professional Themes** - Beautiful styles from Marked2 collection (Academia default)
- **Mermaid diagram support** - Flowcharts, sequence diagrams, class diagrams, and more
- **PDF export** - Generate professional PDFs with one click
- **Drag and drop** - Drop .md files directly into the editor to load them
- **Auto-save** - Your work is automatically saved to browser localStorage
- **Clean interface** - Split-pane editor with syntax highlighting
- **Fast & lightweight** - Runs entirely in your browser
- **Privacy-focused** - Everything runs locally, no data sent anywhere

## Quick Start

### Option 1: Docker (Recommended)

**Using Docker Compose:**
```bash
docker-compose up -d
```

Then open http://localhost:8080 in your browser.

**Using Docker CLI:**
```bash
docker build -t merview:latest .
docker run -d -p 8080:80 --name merview merview:latest
```

**Using npm scripts:**
```bash
npm run docker:compose:up
# or
npm run docker:build && npm run docker:run
```

### Option 2: Open directly in browser

Simply open `index.html` in your web browser. That's it!

```bash
open index.html
```

### Option 3: Run with local server

```bash
npm install
npm start
```

This will start a local server at http://localhost:8080.

## Usage

1. **Edit** - Type or paste your Markdown in the left panel
2. **Choose a style** - Select from 37 professional themes in the dropdown
3. **Load files** - Drag and drop any .md file into the editor
4. **Preview** - See the rendered output in real-time on the right
5. **Export to PDF** - Click "Print/PDF" or use `Cmd/Ctrl + P`

### Keyboard Shortcuts

- `Cmd/Ctrl + S` - Show save status
- `Cmd/Ctrl + P` - Open print dialog (save as PDF)

## PDF Export with Page Breaks

Merview supports page breaks for creating slide decks and paginated documents.

### Using Horizontal Rules for Page Breaks

In markdown, use `---` (horizontal rule) to create page breaks:

```markdown
# Slide 1

Welcome to my presentation!

---

# Slide 2

Here's the second slide.

---

# Slide 3

And the conclusion.
```

When you export to PDF, each `---` will start a new page. The horizontal rules are hidden in the PDF output.

### CSS Utility Classes

For more control, use these CSS classes in your HTML:

| Class | Effect |
|-------|--------|
| `.page-break-before` | Start a new page before this element |
| `.page-break-after` | Start a new page after this element |
| `.page-break-avoid` | Prevent page breaks inside this element |

Example with inline HTML:

```markdown
<div class="page-break-before">

# This heading starts on a new page

</div>

<div class="page-break-avoid">

This table won't be split across pages:

| Column 1 | Column 2 |
|----------|----------|
| Data     | Data     |

</div>
```

### Tips for PDF Export

- Headings automatically avoid being orphaned (they won't appear alone at the bottom of a page)
- Tables, code blocks, and blockquotes avoid being split across pages when possible
- Use the "Save as PDF" button to generate PDF files with your chosen style

### Browser Compatibility

PDF page breaks work best in:
- **Chrome/Edge** (recommended) - Full support for all page break features
- **Firefox** - Good support, may have minor differences in break positioning
- **Safari** - Good support for basic page breaks

Note: The `---` separator appears as a horizontal line in the browser preview but becomes an invisible page break in PDF exports.

## Mermaid Diagram Examples

### Flowchart

```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
```

### Sequence Diagram

```mermaid
sequenceDiagram
    Alice->>Bob: Hello Bob!
    Bob->>Alice: Hello Alice!
```

### Class Diagram

```mermaid
classDiagram
    Animal <|-- Dog
    Animal <|-- Cat
```

## Libraries Used

- [Marked.js](https://marked.js.org/) - Fast Markdown parser (MIT License)
- [Mermaid.js](https://mermaid.js.org/) - Diagram generation (MIT License)
- [CodeMirror](https://codemirror.net/) - Code editor (MIT License)
- [highlight.js](https://highlightjs.org/) - Syntax highlighting (BSD License)

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## Docker Deployment

### Container Details

- **Base Image:** nginx:alpine (~25MB)
- **Port:** 80 (mapped to host port 8080)
- **Health Check:** Included
- **Auto-restart:** Enabled

### npm Scripts

```bash
npm run docker:compose:up      # Start with docker-compose
npm run docker:compose:down    # Stop container
npm run docker:build           # Build image
npm run docker:run             # Run container
npm run docker:stop            # Stop container
npm run docker:logs            # View logs
```

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

This means you're free to use, modify, and distribute this software, but if you run a modified version as a network service, you must make your source code available to users of that service.

See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Feel free to fork and submit pull requests.
