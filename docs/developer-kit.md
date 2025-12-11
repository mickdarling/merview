# Developer Kit

[Back to Welcome](/?sample)

---

Welcome to the Merview Developer Kit. This guide helps you integrate Merview into your documentation workflow, create shareable links, and understand how to leverage Merview as a rendering endpoint for markdown content.

```mermaid
graph LR
    A[Your Documentation] --> B[Generate Merview Link]
    B --> C[Users Click Link]
    C --> D[Merview Renders Content]
    D --> E[Beautiful Preview]

    style A fill:#3498db
    style E fill:#27ae60
```

---

> **🔧 Self-Hosting?**
>
> All examples in this guide use `merview.com`, the public production instance.
> If you're running your own Merview instance, simply replace `merview.com` with your domain (e.g., `merview.yourdomain.com`).

---

## Quick Start - No Installation Required

The easiest way to use Merview is through the public instance at **merview.com**. Just construct a URL:

```
https://merview.com/?url=YOUR_MARKDOWN_FILE_URL
```

**Example**: View any GitHub README instantly:
```
https://merview.com/?url=https://raw.githubusercontent.com/mickdarling/merview/main/README.md
```

That's it! Merview loads in the browser, fetches your markdown file, and renders it beautifully - including all Mermaid diagrams, code highlighting, and styling.

### Try It Now

Click this link to see it in action:
[View Merview's README in Merview](https://merview.com/?url=https://raw.githubusercontent.com/mickdarling/merview/main/README.md)

---

## What is Merview?

Merview is a client-side markdown and Mermaid diagram renderer. It runs entirely in the browser with no server-side processing, making it perfect for:

- Quick markdown previews
- Documentation rendering
- Diagram visualization
- Shareable markdown links
- Educational content display

---

## URL-Based Document Loading

### The `?url=` Parameter

Merview can load and render any publicly accessible markdown file via the `?url=` parameter:

```
https://merview.com/?url=YOUR_MARKDOWN_URL
```

### Requirements

1. **HTTPS Only** - URLs must use HTTPS protocol
2. **Public Access** - Content must be publicly accessible (no authentication)
3. **CORS-Friendly** - Server should allow cross-origin requests
4. **Raw Content** - URL should point to raw markdown (not HTML wrapper)

### Security Note

Merview supports loading from any HTTPS URL for maximum flexibility:
- **No Domain Restrictions** - Load content from any HTTPS source
- **Content Sanitization** - All rendered HTML is sanitized with DOMPurify for XSS protection
- **Client-Side Processing** - Content is processed entirely in the browser with no server-side storage

---

## Creating Shareable Links

### GitHub Files

For GitHub repository files:

1. Navigate to your markdown file on GitHub
2. Click the "Raw" button
3. Copy the raw URL (starts with `raw.githubusercontent.com`)
4. Construct your Merview link:

```
https://merview.com/?url=https://raw.githubusercontent.com/user/repo/main/README.md
```

**Example:**
```
https://merview.com/?url=https://raw.githubusercontent.com/mickdarling/merview/main/README.md
```

### GitHub Gists

For Gist files:

1. Create or open a Gist
2. Click the "Raw" button on the file
3. Copy the raw URL
4. Construct your Merview link:

```
https://merview.com/?url=https://gist.githubusercontent.com/user/gist-id/raw/file.md
```

### CDN-Hosted Files

If you host markdown on a CDN:

```
https://merview.com/?url=https://cdn.jsdelivr.net/gh/user/repo@version/file.md
```

---

## Integration Examples

### HTML Link Button

Add a "View in Merview" button to your documentation:

```html
<a href="https://merview.com/?url=https://raw.githubusercontent.com/user/repo/main/docs/guide.md"
   target="_blank"
   rel="noopener noreferrer">
    View in Merview
</a>
```

### Markdown Badge/Link

Create a clickable badge in your README:

```markdown
[![View in Merview](https://img.shields.io/badge/View%20in-Merview-blue?logo=markdown)](https://merview.com/?url=https://raw.githubusercontent.com/user/repo/main/README.md)
```

### JavaScript Function

Generate Merview links programmatically:

```javascript
/**
 * Generate a Merview link for a markdown file
 * @param {string} rawUrl - Raw markdown file URL
 * @returns {string} Merview preview URL
 */
function generateMerviewLink(rawUrl) {
    const baseUrl = 'https://merview.com/';
    const params = new URLSearchParams({ url: rawUrl });
    return `${baseUrl}?${params.toString()}`;
}

// Example usage
const readmeUrl = 'https://raw.githubusercontent.com/user/repo/main/README.md';
const merviewLink = generateMerviewLink(readmeUrl);
console.log(merviewLink);
// Output: https://merview.com/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fuser%2Frepo%2Fmain%2FREADME.md
```

### Python Script

Generate links from a script:

```python
from urllib.parse import urlencode

def generate_merview_link(raw_url):
    """Generate a Merview link for a markdown file"""
    base_url = 'https://merview.com/'
    params = urlencode({'url': raw_url})
    return f'{base_url}?{params}'

# Example usage
readme_url = 'https://raw.githubusercontent.com/user/repo/main/README.md'
merview_link = generate_merview_link(readme_url)
print(merview_link)
```

---

## Use Cases

### 1. Documentation Sites

Add "Preview" links to your documentation:

```markdown
## API Reference

[View API Docs](docs/api.md) | [Preview in Merview](https://merview.com/?url=https://raw.githubusercontent.com/user/repo/main/docs/api.md)
```

### 2. GitHub Issues/PRs

Share rendered versions of documentation changes:

```markdown
I've updated the guide. Preview the changes here:
https://merview.com/?url=https://raw.githubusercontent.com/user/repo/feature-branch/GUIDE.md
```

### 3. Email/Chat Links

Share formatted documentation in team chats or emails without requiring recipients to clone repositories or install tools.

### 4. Education & Training

Create shareable links to course materials, tutorials, and guides that render beautifully with diagrams.

### 5. Blog Posts

Embed markdown content in blog posts or articles with a "view rendered" link.

---

## Architecture Overview

How Merview processes your content:

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Merview
    participant Source

    User->>Browser: Click Merview Link
    Browser->>Merview: Load App
    Merview->>Source: Fetch Markdown (HTTPS)
    Source-->>Merview: Return Content
    Merview->>Merview: Parse Markdown
    Merview->>Merview: Render Mermaid Diagrams
    Merview->>Merview: Highlight Code
    Merview->>Merview: Sanitize HTML (DOMPurify)
    Merview->>Browser: Display Preview
    Browser-->>User: See Rendered Document
```

### Processing Pipeline

```mermaid
graph TD
    A[Markdown Source] --> B{URL Validation}
    B -->|Invalid| C[Show Error]
    B -->|Valid| D[Fetch Content]
    D --> E[Parse Markdown]
    E --> F[Extract Mermaid Blocks]
    E --> G[Extract Code Blocks]
    F --> H[Render Diagrams]
    G --> I[Syntax Highlighting]
    E --> J[Convert to HTML]
    J --> K[Sanitize with DOMPurify]
    H --> K
    I --> K
    K --> L[Apply Theme]
    L --> M[Display Preview]
```

---

## URL Encoding

### When to URL Encode

Always URL-encode the markdown URL when constructing Merview links:

```javascript
// Wrong - special characters can break the URL
const link = `https://merview.com/?url=https://example.com/path with spaces/file.md`;

// Correct - URL encoded
const encodedUrl = encodeURIComponent('https://example.com/path with spaces/file.md');
const link = `https://merview.com/?url=${encodedUrl}`;
```

### How Merview Keeps URLs Readable

Merview uses a **minimal encoding strategy** to keep URLs human-readable while maintaining correctness. Unlike standard `encodeURIComponent()`, which encodes almost everything, Merview only encodes characters that would actually break the URL.

#### Characters That Stay Readable

Merview keeps these characters readable (NOT encoded):

- **Alphanumeric**: A-Z, a-z, 0-9
- **Unreserved characters** (RFC 3986): `-` `_` `.` `~`
- **URL structure**: `/` `:` (needed for `https://` and path separators)

This means a typical URL looks clean in your browser's address bar:
```
https://merview.com/?url=https://raw.githubusercontent.com/user/repo/main/docs/guide.md
```

#### Characters That Get Encoded

These characters MUST be encoded to prevent URL parsing errors:

| Character | Encoded As | Why |
|-----------|------------|-----|
| Space | `%20` | Would break the URL structure |
| `&` | `%26` | Query string separator |
| `?` | `%3F` | Query string start marker |
| `#` | `%23` | Fragment identifier |
| `=` | `%3D` | Query parameter assignment |
| `%` | `%25` | Reserved for encoding itself |
| `@` | `%40` | Reserved character |
| `!` `$` `'` `(` `)` `*` `+` `,` `;` `[` `]` | Various | Special URL characters |

#### Why This Approach?

**Standard encoding** (encodeURIComponent):
```
https://merview.com/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fuser%2Frepo%2Fmain%2Ffile.md
```
Technically correct but hard to read and share.

**Merview's minimal encoding**:
```
https://merview.com/?url=https://raw.githubusercontent.com/user/repo/main/file.md
```
Human-readable, shareable, and still functionally correct.

### URL Length Considerations

#### Browser URL Length Limits

Different browsers have different URL length limits:

- **Chrome/Edge**: ~32,000 characters (very generous)
- **Firefox**: ~65,000 characters (most generous)
- **Safari**: ~80,000 characters (extremely generous)
- **Historic IE11**: 2,083 characters (no longer supported, but a good baseline)

**Merview's thresholds**:

| Length | Behavior |
|--------|----------|
| < 2,000 chars | No warning (safe for all browsers and sharing) |
| 2,000 - 8,000 chars | Console warning + subtle status message |
| > 8,000 chars | Console error + prominent warning message |

#### Why Length Matters

Very long URLs cause practical problems:

1. **Sharing limitations**: Email clients, chat apps, and social media may truncate or break long URLs
2. **Readability**: Humans can't easily verify or edit extremely long URLs
3. **Server logs**: Some servers truncate URLs in logs, making debugging harder
4. **Proxy/firewall issues**: Corporate proxies may reject very long URLs
5. **Mobile issues**: Long URLs are hard to work with on mobile devices

#### Best Practices for Long Content URLs

If your markdown source URL is long, consider these alternatives:

1. **Use URL shorteners**: bit.ly, tinyurl.com, or your own domain
   ```
   Original: https://merview.com/?url=https://example.com/very/long/path/to/document.md
   Shortened: https://bit.ly/abc123 → redirects to the Merview URL
   ```

2. **Host at shorter paths**: Use CDNs or reorganize your content structure
   ```
   Long:  https://cdn.example.com/documentation/2024/project-name/guides/getting-started.md
   Short: https://cdn.example.com/docs/start.md
   ```

3. **Use GitHub releases or tags** instead of long branch names:
   ```
   Long:  https://raw.githubusercontent.com/org/repo/feature/very-long-branch-name/file.md
   Short: https://raw.githubusercontent.com/org/repo/v1.0/file.md
   ```

4. **GitHub Gists** for standalone documents (short, clean URLs):
   ```
   https://gist.githubusercontent.com/username/gist-id/raw/file.md
   ```

### Common Encoding Issues

| Character | Unencoded | Encoded |
|-----------|-----------|---------|
| Space | ` ` | `%20` |
| `?` | `?` | `%3F` |
| `&` | `&` | `%26` |
| `=` | `=` | `%3D` |
| `/` | `/` | Kept readable in Merview |
| `:` | `:` | Kept readable in Merview |

### Manual Construction

Most languages provide URL encoding utilities:

```javascript
// JavaScript - full encoding (less readable)
const url = encodeURIComponent(rawUrl);

// JavaScript - using URLSearchParams (recommended)
const params = new URLSearchParams({ url: rawUrl });
const merviewLink = `https://merview.com/?${params.toString()}`;
```

```python
# Python
from urllib.parse import quote
url = quote(raw_url, safe='')

# Python - using urlencode (recommended)
from urllib.parse import urlencode
params = urlencode({'url': raw_url})
merview_link = f'https://merview.com/?{params}'
```

```bash
# Shell (jq)
echo "https://example.com/file.md" | jq -sRr @uri
```

### Examples: Encoded vs Readable

#### Example 1: Simple GitHub URL

**Input URL**: `https://raw.githubusercontent.com/user/repo/main/README.md`

**Standard encoding**:
```
https://merview.com/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fuser%2Frepo%2Fmain%2FREADME.md
```

**Merview (minimal encoding)**:
```
https://merview.com/?url=https://raw.githubusercontent.com/user/repo/main/README.md
```

#### Example 2: URL with Spaces

**Input URL**: `https://example.com/My Documents/guide.md`

**Standard encoding**:
```
https://merview.com/?url=https%3A%2F%2Fexample.com%2FMy%20Documents%2Fguide.md
```

**Merview (minimal encoding)**:
```
https://merview.com/?url=https://example.com/My%20Documents/guide.md
```

Notice: Spaces are encoded (`%20`), but `/` and `:` stay readable.

#### Example 3: URL with Query Parameters

**Input URL**: `https://example.com/api/content?id=123&format=markdown`

**Standard encoding**:
```
https://merview.com/?url=https%3A%2F%2Fexample.com%2Fapi%2Fcontent%3Fid%3D123%26format%3Dmarkdown
```

**Merview (minimal encoding)**:
```
https://merview.com/?url=https://example.com/api/content%3Fid%3D123%26format%3Dmarkdown
```

Notice: `?` `=` `&` are encoded (they would break the query string), but `/` and `:` stay readable.

---

## Error Handling

### What Happens When URLs Fail?

Merview displays user-friendly error messages:

- **Invalid Domain**: "URL domain not allowed for security"
- **Network Error**: "Failed to load content from URL"
- **Invalid Content**: "Content type not allowed"
- **CORS Error**: "Cross-origin request blocked"

### Testing Links

Before sharing Merview links:

1. Test the raw URL directly in your browser
2. Verify it returns raw markdown (not HTML)
3. Check there are no authentication requirements
4. Confirm the URL is publicly accessible

### Debugging Tips

If a Merview link doesn't work:

```mermaid
flowchart TD
    A[Link Not Working?] --> B{Can you access raw URL?}
    B -->|No| C[Check URL validity]
    B -->|Yes| D{Is it HTTPS?}
    D -->|No| E[Use HTTPS version]
    D -->|Yes| F{Returns raw markdown?}
    F -->|No| G[Get raw file URL]
    F -->|Yes| H{Publicly accessible?}
    H -->|No| I[Remove authentication]
    H -->|Yes| J{Domain allowed?}
    J -->|No| K[Use allowed domain or any HTTPS URL]
    J -->|Yes| L[Check browser console]
```

---

## Best Practices

### 1. Use Version Tags

For stable links, reference specific versions or tags:

```
# Bad - points to moving target
?url=https://raw.githubusercontent.com/user/repo/main/docs.md

# Good - points to specific version
?url=https://raw.githubusercontent.com/user/repo/v1.2.0/docs.md
```

### 2. Keep URLs Short

Long URLs can be unwieldy. Consider:
- Using URL shorteners like bit.ly or tinyurl.com
- Hosting on CDNs with shorter paths
- Using GitHub Gists for standalone documents

### 3. Test with Different Themes

Merview offers 37+ themes. Test your content with:
- Light themes (Clean, Academic)
- Dark themes (Dark, Nord)
- Specialized themes (GitHub, Markdown)

Ensure your content looks good across themes.

### 4. Optimize Diagrams

Large Mermaid diagrams may not render well:
- Keep diagrams focused and concise
- Use subgraphs for organization
- Consider splitting complex diagrams
- Test on mobile viewports

### 5. Document Your Links

When sharing Merview links, explain what they are:

```markdown
## Documentation

View the [User Guide](https://merview.com/?url=...)
(rendered version via Merview)
```

---

## Security Considerations

### Content Sanitization

All rendered HTML is sanitized with [DOMPurify](https://github.com/cure53/DOMPurify):
- Scripts are stripped
- Dangerous attributes removed
- Only safe HTML elements allowed

### HTTPS Requirement

Merview requires HTTPS for:
- Protecting content in transit
- Preventing man-in-the-middle attacks
- Ensuring content integrity

### Private Content Warning

If you accidentally paste a URL with authentication tokens, Merview will:
1. Detect the token pattern
2. Show a warning modal
3. Require explicit confirmation
4. Suggest secure alternatives (Gist sharing)

### No Server Logging

Merview is client-side only:
- No server processing
- No URL logging
- No content storage
- No analytics (currently)

---

## Advanced Features

### Custom Themes

Users can select from 37+ built-in themes or load external styles. Your documentation will adapt to their chosen theme automatically.

### Mermaid Interactivity

Mermaid diagrams in Merview support:
- Click events (if defined in diagram)
- Fullscreen view (double-click)
- Zoom controls
- Pan and drag

### Code Validation

Merview includes optional code validation for:
- YAML syntax checking
- JSON structure validation
- Markdown linting

### Export to PDF

Users can export your documentation to PDF with:
- All diagrams rendered
- Syntax highlighting preserved
- Custom styling applied

---

## API Reference

While Merview doesn't have a formal API, you can construct URLs programmatically:

### URL Structure

```
https://merview.com/[?parameter]
```

### Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `url` | string | HTTPS URL to markdown file | `?url=https://raw.githubusercontent.com/...` |
| `sample` | flag | Load welcome document | `?sample` |

### Future Parameters

The following parameters are under consideration and may be implemented in future releases:

| Parameter | Type | Description | Status |
|-----------|------|-------------|--------|
| `theme` | string | Default theme to apply | Under consideration |
| `style` | string | Default preview style | Under consideration |
| `readonly` | flag | Hide editor panel | Under consideration |

> **Note**: These features are speculative and may not be implemented. Check the [GitHub Issues](https://github.com/mickdarling/merview/issues) for current development status.

---

## Examples Gallery

### Example 1: Project README

```markdown
# My Project

[![View in Merview](https://img.shields.io/badge/View-Merview-blue)](https://merview.com/?url=https://raw.githubusercontent.com/user/project/main/README.md)

Quick documentation preview without leaving GitHub.
```

### Example 2: Tutorial Series

```markdown
# Learning Series

1. [Introduction](tutorial/intro.md) - [Preview](https://merview.com/?url=https://raw.githubusercontent.com/user/repo/main/tutorial/intro.md)
2. [Getting Started](tutorial/getting-started.md) - [Preview](https://merview.com/?url=https://raw.githubusercontent.com/user/repo/main/tutorial/getting-started.md)
3. [Advanced Topics](tutorial/advanced.md) - [Preview](https://merview.com/?url=https://raw.githubusercontent.com/user/repo/main/tutorial/advanced.md)
```

### Example 3: Documentation Hub

```html
<div class="docs-hub">
  <h2>Documentation</h2>
  <ul>
    <li><a href="https://merview.com/?url=https://raw.githubusercontent.com/org/repo/main/docs/api.md">API Reference</a></li>
    <li><a href="https://merview.com/?url=https://raw.githubusercontent.com/org/repo/main/docs/guides.md">User Guides</a></li>
    <li><a href="https://merview.com/?url=https://raw.githubusercontent.com/org/repo/main/docs/faq.md">FAQ</a></li>
  </ul>
</div>
```

---

## Troubleshooting

### Common Issues

#### "Failed to load content from URL"

**Cause**: Network error, CORS issue, or invalid URL

**Solution**:
1. Verify URL is accessible in a browser
2. Check for CORS headers on the source server
3. Ensure URL uses HTTPS
4. Try with a known-working URL to isolate the issue

#### "Domain not allowed"

**Cause**: URL domain is not in the allowlist (if using older version)

**Solution**:
1. Use a supported CDN or GitHub raw URLs
2. Update to latest Merview version (supports any HTTPS URL)
3. Host content on an allowed domain

#### Diagrams Not Rendering

**Cause**: Mermaid syntax error or unsupported diagram type

**Solution**:
1. Test diagram syntax at [mermaid.live](https://mermaid.live)
2. Check for syntax errors in code blocks
3. Ensure code block is marked as `mermaid`
4. Review Mermaid version compatibility

#### Content Shows as Raw Markdown

**Cause**: Content-Type header indicates HTML instead of text

**Solution**:
1. Use the raw file URL, not the GitHub HTML view
2. Check server Content-Type headers
3. Ensure URL returns markdown content, not HTML wrapper

---

## Contributing

Found a bug or have a feature request?

- [GitHub Issues](https://github.com/mickdarling/merview/issues)
- [Contributing Guide](/?url=docs/contributing.md)

Want to improve this documentation?

- Fork the repository
- Edit `docs/developer-kit.md`
- Submit a pull request

---

## Navigation

- [Back to Welcome](/?sample)
- [About Merview](/?url=docs/about.md)
- [Theme Guide](/?url=docs/themes.md)
- [Security](/?url=docs/security.md)
- [Contributing](/?url=docs/contributing.md)
- [Support the Project](/?url=docs/sponsor.md)

---

## Resources

### Official Links

- **Website**: [merview.com](https://merview.com)
- **Source Code**: [github.com/mickdarling/merview](https://github.com/mickdarling/merview)
- **Issues**: [github.com/mickdarling/merview/issues](https://github.com/mickdarling/merview/issues)

### Related Projects

- [Marked](https://marked.js.org/) - Markdown parser
- [Mermaid](https://mermaid.js.org/) - Diagram rendering
- [DOMPurify](https://github.com/cure53/DOMPurify) - HTML sanitization
- [Highlight.js](https://highlightjs.org/) - Syntax highlighting

### Alternatives

If Merview doesn't fit your needs:

- **StackEdit** - In-browser markdown editor with sync
- **HackMD** - Collaborative markdown editor
- **Dillinger** - Online markdown editor
- **Markdown Viewer** - Browser extension for local files

---

**Last Updated**: 2025-12-11

**License**: AGPL-3.0
