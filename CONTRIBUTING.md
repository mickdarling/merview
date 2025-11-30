# Contributing to Merview

Thank you for your interest in contributing to Merview! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## Development Philosophy

Merview is intentionally designed as a **single-file, client-side web application**. This means:

- **No server required** - Everything runs in the browser
- **No build step** - The `index.html` file is the application
- **Privacy first** - Your documents never leave your device
- **Simple deployment** - Just serve static files

When contributing, keep this philosophy in mind. Avoid introducing:
- Server-side dependencies
- Complex build pipelines
- External API calls that transmit user data

## Project Maintenance

This is an open source project maintained in spare time. Please be patient:

- **No guaranteed response times** - Reviews happen when maintainers are available
- **No regular release cadence** - Releases happen when features are ready
- **Community contributions welcome** - But may take time to review

## License

Merview is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). By contributing to this project, you agree that your contributions will be licensed under the same license.

## How to Contribute

### Reporting Bugs

1. **Check existing issues** - Search [open issues](https://github.com/mickdarling/merview/issues) to see if the bug has already been reported.
2. **Create a new issue** - If not found, [open a new issue](https://github.com/mickdarling/merview/issues/new) with:
   - Clear, descriptive title
   - Steps to reproduce the bug
   - Expected vs actual behavior
   - Browser and OS information
   - Screenshots if applicable

### Suggesting Features

1. **Check existing issues** - Your idea may already be proposed.
2. **Open a feature request** - Describe the feature and why it would be useful.
3. **Be specific** - Include use cases and potential implementation ideas.

### Submitting Pull Requests

1. **Fork the repository** and create your branch from `main`.
2. **Create an issue first** - For significant changes, discuss in an issue before coding.
3. **Follow the code style** - See [Code Style](#code-style) below.
4. **Test your changes** - Run existing tests and add new ones if needed.
5. **Write clear commit messages** - See [Commit Messages](#commit-messages).
6. **Submit the PR** - Reference any related issues.

## Development Setup

### Prerequisites

- [Docker](https://www.docker.com/) (recommended) or
- [Node.js](https://nodejs.org/) (v18+) with npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/mickdarling/merview.git
cd merview

# Build and run
docker build -t merview:latest .
docker run -d -p 8080:80 --name merview merview:latest

# Open in browser
# macOS: open http://localhost:8080
# Linux: xdg-open http://localhost:8080
# Windows: start http://localhost:8080
# Or just navigate to http://localhost:8080 in your browser
```

### Quick Start with npm

```bash
# Clone the repository
git clone https://github.com/mickdarling/merview.git
cd merview

# Install dependencies
npm install

# Start development server (opens browser automatically)
npm start
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed

# View test report
npm run test:report
```

## Code Style

### General Principles

- **Keep it simple** - Merview is a single-file application. Avoid over-engineering.
- **Self-documenting code** - Use clear variable and function names.
- **Comments for "why"** - Comment complex logic, not obvious code.

### HTML

- Use semantic HTML5 elements
- Keep accessibility in mind (alt text, ARIA labels)
- Indent with 4 spaces

### CSS

- Use CSS custom properties (variables) for theming
- Mobile-responsive where applicable
- Prefer flexbox/grid for layouts
- Indent with 4 spaces

### JavaScript

- Use modern ES6+ syntax
- Prefer `const` over `let`, avoid `var`
- Use async/await for asynchronous code
- Handle errors gracefully with try/catch
- Indent with 4 spaces

### Example

```javascript
// Good
async function loadMarkdownFile(file) {
    try {
        const content = await file.text();
        if (cmEditor) {
            cmEditor.setValue(content);
        }
        currentFilename = file.name;
        await renderMarkdown();
        showStatus(`Loaded: ${file.name}`);
        return true;
    } catch (error) {
        console.error('Error loading file:', error);
        showStatus(`Error loading file: ${error.message}`);
        return false;
    }
}

// Avoid
function loadFile(f) {
    var c = f.text(); // unclear variable names
    // no error handling
}
```

## Commit Messages

Follow conventional commit format:

```
<type>: <short description>

<optional body with more details>

<optional footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, no code change
- `refactor`: Code restructuring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

### Examples

```
feat: Add Mermaid theme selector

Add dropdown to switch between Mermaid's built-in themes
(default, forest, dark, neutral, base).

Fixes #11
```

```
fix: Resolve dark mode preview background color

The preview pane was showing incorrect background colors
when dark mode was enabled.

Fixes #10
```

## Pull Request Process

1. **Update documentation** - If your change affects usage, update README or other docs.
2. **Add tests** - For new features or bug fixes, add appropriate tests.
3. **Ensure tests pass** - Run `npm test` before submitting.
4. **Request review** - Tag maintainers for review.
5. **Address feedback** - Respond to review comments promptly.

## Questions?

- Open a [GitHub Discussion](https://github.com/mickdarling/merview/discussions) for general questions
- Check existing [issues](https://github.com/mickdarling/merview/issues) for known problems
- Read the [README](README.md) for usage information

Thank you for contributing to Merview!
