# CSS Theme Loading Guide

The Markdown + Mermaid Renderer supports multiple ways to customize the appearance of your rendered markdown documents.

---

## Built-in Themes (MIT Licensed)

The application includes 6 professionally-designed themes created by us:

### 1. **Clean** (Default)
- Minimal, modern design
- Sans-serif fonts
- GitHub-inspired styling
- Best for: Technical documentation, READMEs

### 2. **Academic**
- Professional serif typography
- Drop cap on first paragraph
- Formal document styling
- Best for: Research papers, formal reports

### 3. **GitHub**
- Matches GitHub's markdown styling
- Familiar appearance for developers
- Task list support
- Best for: Project documentation, issues

### 4. **Dark Mode**
- High-contrast dark theme
- Easy on the eyes
- Syntax highlighting optimized
- Best for: Late-night writing, presentations

### 5. **Monospace**
- Code-focused, monospace fonts
- Markdown syntax indicators (# ## ###)
- Terminal-like aesthetic
- Best for: Technical notes, code documentation

### 6. **Newspaper**
- Classic newspaper/magazine layout
- Two-column support (optional)
- Drop cap first paragraph
- Best for: Articles, newsletters, print-ready documents

---

## Loading Custom CSS

### Method 1: Load from File

1. Click the style dropdown
2. Select **"Load from file..."**
3. Choose a `.css` file from your computer

### Method 2: Drag and Drop

1. Open any `.css` file in your file manager
2. Drag it over the **preview panel** (right side)
3. Drop it to apply the style

**Visual Feedback:**
- Preview panel will show a blue dashed outline when dragging a CSS file
- Status message confirms when style is loaded

### Method 3: Load from URL

1. Click the style dropdown
2. Select **"Load from URL..."**
3. Enter a direct URL to a CSS file

**Examples:**
```
https://example.com/my-style.css
https://raw.githubusercontent.com/user/repo/main/styles/custom.css
```

### Method 4: Load from Repository

1. Click the style dropdown
2. Select **"MarkedCustomStyles (external)"** or any other repository option
3. Enter the filename from that repository

**Example for MarkedCustomStyles:**
```
Academia.css
github-updated.css
Torpedo.css
```

**Note:** Third-party repositories may have different licensing. Check the repository's license before redistributing.

---

## Creating Your Own CSS Themes

### CSS Structure

All themes should be scoped to `#wrapper` to avoid affecting the editor UI:

```css
/* Your Custom Theme */

#wrapper {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 20px;
    font-family: 'Your Font', sans-serif;
    font-size: 16px;
    line-height: 1.6;
    color: #333;
    background: #fff;
}

#wrapper h1 {
    font-size: 2em;
    /* ... */
}

#wrapper h2 {
    font-size: 1.5em;
    /* ... */
}

#wrapper p {
    margin-bottom: 16px;
    /* ... */
}

#wrapper code {
    /* Inline code styling */
}

#wrapper pre {
    /* Code block styling */
}

#wrapper blockquote {
    /* Quote styling */
}

#wrapper table {
    /* Table styling */
}

/* ... more selectors ... */
```

### Key Elements to Style

**Typography:**
- `#wrapper h1, h2, h3, h4, h5, h6` - Headings
- `#wrapper p` - Paragraphs
- `#wrapper a` - Links
- `#wrapper strong` - Bold text
- `#wrapper em` - Italic text

**Code:**
- `#wrapper code` - Inline code
- `#wrapper pre` - Code blocks
- `#wrapper pre code` - Code inside blocks

**Lists:**
- `#wrapper ul` - Unordered lists
- `#wrapper ol` - Ordered lists
- `#wrapper li` - List items

**Tables:**
- `#wrapper table` - Table container
- `#wrapper th` - Table headers
- `#wrapper td` - Table cells
- `#wrapper tr` - Table rows

**Other:**
- `#wrapper blockquote` - Quotes
- `#wrapper hr` - Horizontal rules
- `#wrapper img` - Images

### Tips for Good Themes

1. **Use `#wrapper` scoping** - Prevents affecting the editor/toolbar
2. **Set max-width** - Makes content readable (600-1000px recommended)
3. **Center content** - Use `margin: 0 auto`
4. **Line height 1.5-1.8** - Improves readability
5. **Test print styles** - Use `@media print` for PDF exports
6. **Preserve syntax highlighting** - Don't override `.hljs` styles

### Dark Theme Background Requirements

**IMPORTANT:** Dark themes MUST define a background color on `#wrapper` using simple color values.

**Supported background types:**
- Hex colors (3, 6, or 8 digits): `background: #1e1e1e;` or `#fff`
- Named colors: `background: black;` or `background-color: darkgray;` or `transparent`
- RGB/RGBA values: `background: rgb(30, 30, 30);` or `background-color: rgba(0, 0, 0, 0.95);`
- HSL/HSLA values: `background: hsl(0, 0%, 12%);` or `background-color: hsla(0, 0%, 12%, 0.95);`

**NOT supported (will fall back to white):**
- CSS variables: `background: var(--bg-color);` ❌
- Gradients: `background: linear-gradient(...);` ❌
- Complex backgrounds: `background: url(...) #1e1e1e;` ❌

**Why this limitation?**

The preview panel extracts the `#wrapper` background color using regex-based CSS parsing to ensure the entire preview area matches your theme's background. This provides a seamless visual experience, especially for dark themes.

**Example dark theme:**

```css
#wrapper {
    background: #1e1e1e;  /* Simple hex color - GOOD */
    color: #e0e0e0;
    max-width: 850px;
    margin: 0 auto;
    padding: 40px 20px;
    font-family: 'Segoe UI', sans-serif;
}

/* NOT this: */
#wrapper {
    background: var(--dark-bg);  /* CSS variable - WON'T WORK */
    color: #e0e0e0;
}
```

If your theme uses CSS variables or complex backgrounds, the preview will fall back to white, which will look incorrect for dark themes. Always use simple color values for the `#wrapper` background property.

---

## Advanced: Repository Integration

You can add your own repository of CSS themes to the dropdown.

### Adding a Repository

Edit `index.html` and add to the `availableStyles` array:

```javascript
{
    name: 'Your Repository Name',
    file: '',
    source: 'repository',
    url: 'https://raw.githubusercontent.com/user/repo/main/styles/',
    note: 'Optional note about licensing'
}
```

### Repository Structure

Your repository should have CSS files directly accessible:

```
your-repo/
├── styles/
│   ├── theme1.css
│   ├── theme2.css
│   └── theme3.css
└── README.md
```

Access via:
```
https://raw.githubusercontent.com/user/repo/main/styles/theme1.css
```

---

## Licensing Notes

### Our Built-in Themes

All themes in the `styles/` directory are:
- **Licensed:** MIT License
- **Copyright:** Markdown + Mermaid Renderer project
- **Usage:** Free for any purpose (commercial, private, redistribution)
- **Attribution:** Not required, but appreciated

### Third-Party Themes

When using themes from external sources:
- Check the repository's LICENSE file
- Respect the author's licensing terms
- Provide proper attribution if required
- Don't redistribute without permission (unless licensed)

### MarkedCustomStyles Repository

**Status:** No explicit license (as of 2025-01-21)
- Use at your own discretion
- We've contacted the author for clarification
- Don't redistribute without permission
- Consider using our built-in themes instead

---

## Troubleshooting

### CSS Not Loading

**Check:**
- File is valid CSS
- URL is accessible
- CORS headers allow loading (for external URLs)
- Browser console for errors (F12)

### Styles Look Wrong

**Try:**
- Ensure CSS is scoped to `#wrapper`
- Check for syntax errors
- Verify font URLs work
- Test in different browsers

### Drag-and-Drop Not Working

**Solutions:**
- Ensure file has `.css` extension
- Drop directly on the preview panel (right side)
- Check browser permissions
- Try "Load from file..." instead

### Syntax Highlighting Broken

- Syntax highlighting is separate from document styles
- Use the "Syntax Theme" dropdown
- Don't override `.hljs` classes in your CSS
- See STYLES.md for syntax theme options

---

## Examples

### Loading Local Theme

1. Download or create `my-theme.css`
2. Drag it onto the preview panel
3. OR use dropdown → "Load from file..."

### Loading from GitHub

1. Find raw URL: `https://raw.githubusercontent.com/...`
2. Dropdown → "Load from URL..."
3. Paste URL and press OK

### Using MarkedCustomStyles

1. Dropdown → "MarkedCustomStyles (external)"
2. Enter filename: `Academia.css`
3. Press OK

---

## Best Practices

### For Personal Use

- Use built-in themes as starting points
- Customize via drag-and-drop
- Save your favorites for reuse

### For Sharing/Publishing

- Create themes in `styles/` directory
- Add MIT license header to CSS
- Document font requirements
- Test print/PDF output
- Provide screenshots

### For Teams

- Host themes in team repository
- Add repository to dropdown
- Document theme guidelines
- Version control theme files

---

## Contributing Themes

Want to contribute a theme to the project?

1. Create CSS following our structure
2. Test thoroughly (desktop, mobile, print)
3. Add MIT license header
4. Submit pull request
5. Include screenshot

**Requirements:**
- MIT compatible license
- Scoped to `#wrapper`
- No external dependencies (self-contained)
- Properly documented

---

## FAQ

**Q: Can I use Google Fonts?**
A: Yes! Use `@import` at the top of your CSS:
```css
@import url('https://fonts.googleapis.com/css2?family=Roboto');
```

**Q: Will my theme work in PDFs?**
A: Yes, but add `@media print` rules for best results.

**Q: Can I sell themes?**
A: Our built-in themes are MIT licensed (free). Your custom themes can use any license you choose.

**Q: How do I share a theme?**
A: Upload to GitHub, get raw URL, share the URL. Recipients use "Load from URL..."

**Q: Do themes persist?**
A: Built-in themes persist. External themes must be reloaded each session (or save them locally).

---

**Happy Theming!** 🎨

For issues or questions, please open an issue on GitHub.
