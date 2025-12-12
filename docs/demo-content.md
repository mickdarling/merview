# Merview Features Demo

## Mermaid Diagrams

```mermaid
graph LR
    A[Write Markdown] --> B[Add Diagrams]
    B --> C[Style Document]
    C --> D[Export PDF]
    style A fill:#e1f5ff
    style D fill:#e8f5e9
```

## Code Syntax Highlighting

```javascript
// Real-time rendering with 190+ languages
const render = async (markdown) => {
  const html = await marked.parse(markdown);
  preview.innerHTML = html;
  await mermaid.run();
};
```

## 37 Professional Themes

Choose from Academia, GitHub, Swiss, Amblin, and many more elegant styles.
