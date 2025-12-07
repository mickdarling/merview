# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- Add URL validation edge case protections for remote markdown loading (#82)
  - Block URLs with embedded credentials (user:pass@host) to prevent credential leakage
  - Enforce 2048 character URL length limit to prevent DoS attacks
  - Block IDN/punycode homograph attacks by rejecting non-ASCII hostnames
- Add fetch timeout and content size limits for URL loading (#85)
  - 10-second timeout prevents app hanging on slow/unresponsive endpoints
  - 10MB content size limit prevents loading extremely large files
  - User-friendly error messages for timeout and size limit violations

### Changed
- Fresh visits to merview.com now load the sample document instead of cached content (#137)
  - Opening a new tab/window always shows the sample document for predictable UX
  - Refreshing within the same session preserves your edited content
  - Each tab has independent session state (opening a new tab = fresh start)
  - Addresses minor privacy concern of cached content persisting indefinitely

## [1.0.0] - 2025-01-30

### Added

#### Core Editor Features
- Real-time Markdown editing with live preview
- Mermaid diagram rendering support (flowcharts, sequence diagrams, class diagrams, and more)
- CodeMirror-based editor with syntax highlighting
- Split-pane interface with resizable editor and preview panels
- Auto-save to browser localStorage

#### Theming and Customization
- 37 professional preview themes from Marked2 collection (Academia as default)
- Multiple editor themes for CodeMirror
- Multiple syntax highlighting themes for code blocks via highlight.js
- Theme selection via dropdown menu

#### File Operations
- Open File button for loading Markdown files
- Drag and drop support for .md files
- Save functionality with keyboard shortcut (Ctrl/Cmd+S)
- Save As functionality for exporting files
- File validation and sanitization for security

#### Export Features
- Export to PDF via print dialog (Ctrl/Cmd+P)
- Export to HTML functionality
- Print in new tab option (Ctrl/Cmd+Shift+P)

#### User Interface
- Fullscreen mode support
- Clean, modern toolbar with Merview branding and logo
- Responsive split-pane layout
- Professional UI with intuitive controls

#### Security
- Client-side only operation (privacy-focused, no server communication)
- Content Security Policy (CSP) implementation
- Subresource Integrity (SRI) verification for CDN resources
- URL allowlisting for custom CSS loading
- Secure file loading and validation

#### Developer Experience
- Docker support with nginx:alpine base image
- Docker Compose configuration for easy deployment
- npm scripts for common Docker operations
- Playwright test infrastructure
- Comprehensive documentation (README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)

#### Legal and Licensing
- AGPL-3.0-or-later open source license
- Third-party library attribution documentation
- Clear licensing terms for network service providers

#### Dependencies
- Marked.js for Markdown parsing (MIT License)
- Mermaid.js for diagram generation (MIT License)
- CodeMirror for code editing (MIT License)
- highlight.js for syntax highlighting (BSD License)

[unreleased]: https://github.com/mickdarling/merview/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mickdarling/merview/releases/tag/v1.0.0
