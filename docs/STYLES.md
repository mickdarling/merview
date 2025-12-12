# Marked2 Custom Styles Integration

## Overview

The Markdown + Mermaid Renderer now includes 37 professionally designed styles from the [Marked2 Custom Styles](https://github.com/ttscoff/MarkedCustomStyles) collection by Brett Terpstra.

## Default Style

**Academia** is set as the default style - a beautiful academic document theme designed by David Smith, featuring:
- Serif typography (Hoefler Text, Palatino, Georgia)
- Justified text with automatic hyphenation
- Professional headings and spacing
- Academic-style tables and blockquotes
- Print-optimized formatting
- Dark mode support

## How to Use

### Changing Styles

1. Look for the style dropdown in the top toolbar
2. Click to see all 37 available styles
3. Select any style to instantly apply it
4. Your choice is automatically saved in browser localStorage

### Available Styles

**Academic Styles:**
- Academia (default)
- Academic
- Academic CV
- Academic Review
- AMJ Academic
- Chicago Academic
- Juridico

**Professional Styles:**
- Brett Terpstra 2023
- Brett Terpstra
- Palatino Memo
- Meeting Minutes Classic
- Meeting Minutes Modern
- Resolute
- Simplex

**Creative Styles:**
- Amelia
- Avenue
- Bear
- Crim
- Emma
- Firates
- Gregarious
- Hardstock
- Kult
- Mouse
- Pesto
- Swiss
- Symphonic
- Ulysses
- Vostock
- Yeti

**Specialty Styles:**
- Fading Fast
- GitHub
- Highlighter
- Monophile
- Pandoctor
- Teleprompter
- Torpedo

## Technical Details

### How It Works

1. **Dynamic Loading**: Styles are loaded directly from GitHub's CDN
2. **No Dependencies**: Styles are loaded on-demand, not bundled
3. **Persistent**: Your style choice is saved in localStorage
4. **Fast Switching**: Change styles instantly without page reload

### Style Source

```
https://raw.githubusercontent.com/ttscoff/MarkedCustomStyles/master/[StyleName].css
```

All styles are:
- Open source (MIT-like license)
- Created for Marked.app by Brett Terpstra and contributors
- Optimized for markdown documents
- Print-friendly
- Professional quality

## Customization

### Adding Your Own Style

Want to add a custom style? Edit `index.html`:

```javascript
const availableStyles = [
    // Add your style here
    { name: 'My Custom Style', file: 'custom.css' },
    // ... other styles
];
```

Then host your `custom.css` file and update the URL in the `loadStyle()` function.

### Modifying Existing Styles

Styles are loaded from GitHub, so they can't be modified directly. However, you can:

1. Download a style you like
2. Modify it locally
3. Host it yourself
4. Add it to the availableStyles array

## Style Comparison

### Academia (Default)
- **Best for**: Academic papers, research documents, formal writing
- **Font**: Serif (Hoefler Text, Palatino)
- **Width**: 825px fixed
- **Features**: Text indent, justified, hyphenation, professional tables

### GitHub
- **Best for**: Technical documentation, README files
- **Font**: Sans-serif (system fonts)
- **Width**: Responsive
- **Features**: Code-focused, clean, modern

### Simplex
- **Best for**: Minimalist documents, clean reading
- **Font**: Clean sans-serif
- **Width**: Flexible
- **Features**: Maximum readability, minimal distraction

### Meeting Minutes
- **Best for**: Meeting notes, action items, minutes
- **Font**: Professional sans-serif
- **Width**: Standard letter
- **Features**: Structured headings, clear sections

## PDF Export

When exporting to PDF:
- The selected style is preserved
- Print-optimized rules apply
- Mermaid diagrams are included
- All formatting is maintained

## Mermaid Diagram Compatibility

All styles work with Mermaid diagrams. The diagrams are:
- Centered by default
- Scaled to fit
- Print-friendly
- Compatible with all styles

## Credits

- **Marked2 Custom Styles**: Brett Terpstra ([@ttscoff](https://github.com/ttscoff))
- **Academia Style**: David Smith
- **Integration**: Markdown + Mermaid Renderer

## License

The Marked2 custom styles are provided by their respective authors with permission to use and distribute. The repository explicitly welcomes forking and usage.

From the [Marked2 Styles Repository](https://github.com/ttscoff/MarkedCustomStyles):
> "Feel free to fork and submit new styles"
> "Browse the gallery and try them all out"

## Tips

1. **Try Different Styles**: Different styles work better for different content types
2. **Academic Papers**: Use Academia, Academic, or Chicago Academic
3. **Technical Docs**: Use GitHub, Monophile, or Brett Terpstra
4. **Creative Writing**: Use Emma, Amelia, or Ulysses
5. **Meeting Notes**: Use Meeting Minutes Classic or Modern
6. **Dark Mode**: Some styles (like Academia) include dark mode support

## Troubleshooting

**Style not loading?**
- Check your internet connection (styles load from GitHub)
- Try refreshing the page
- Check browser console for errors

**Style looks wrong?**
- Some styles are optimized for specific content types
- Try a different style
- Ensure you have content in the editor

**PDF export style issues?**
- Use browser's Print dialog, not direct save
- Some styles work better in print mode
- Use "Save as PDF" button or Cmd/Ctrl+P for best results

## Future Enhancements

Potential additions:
- Custom style upload
- Style preview thumbnails
- Style favorites/bookmarks
- Style search/filter
- Dark mode toggle for all styles
- Style editor
