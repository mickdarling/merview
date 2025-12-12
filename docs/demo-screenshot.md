# Merview Demo

A markdown editor with live preview and Mermaid diagram support.

## Code Example

```javascript
function greet(name) {
  return `Hello, ${name}!`;
}

const message = greet('World');
console.log(message);
```

## Architecture Diagram

```mermaid
graph LR
    A[Markdown Editor] --> B[Parser]
    B --> C[Renderer]
    B --> D[Mermaid]
    C --> E[Live Preview]
    D --> E
    E --> F[Export PDF]
```

## Features

- **Real-time preview** - See changes instantly
- **Syntax highlighting** - Code blocks with colors
- **Mermaid diagrams** - Flowcharts, sequences, and more
- **No login required** - Just start typing
