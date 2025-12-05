// DOM element references - lazy loaded after DOMContentLoaded
let elements = null;

export function getElements() {
  if (!elements) {
    elements = {
      // Main editor and preview elements
      editorTextarea: document.getElementById('editor'),
      editorContainer: document.getElementById('editor-container'),
      preview: document.getElementById('preview'),
      wrapper: document.getElementById('wrapper'),
      statusDiv: document.getElementById('status'),

      // Layout elements
      container: document.querySelector('.container'),
      editorPanel: document.querySelector('.editor-panel'),
      previewPanel: document.querySelector('.preview-panel'),
      resizeHandle: document.getElementById('resizeHandle'),

      // Theme and style selectors
      styleSelector: document.getElementById('styleSelector'),
      syntaxThemeSelector: document.getElementById('syntaxThemeSelector'),
      editorThemeSelector: document.getElementById('editorThemeSelector'),

      // Lint panel elements
      lintPanel: document.getElementById('lintPanel'),
      lintContent: document.getElementById('lintContent'),
      lintToggle: document.getElementById('lintToggle'),

      // Modal elements
      gistModal: document.getElementById('gistModal'),
      gistModalTitle: document.getElementById('gistModalTitle'),
      gistModalContent: document.getElementById('gistModalContent'),
      privateUrlModal: document.getElementById('privateUrlModal'),

      // Mermaid-specific elements
      mermaidPanArea: document.getElementById('mermaid-pan-area'),
      mermaidZoomLevel: document.getElementById('mermaid-zoom-level'),
      mermaidFullscreenOverlay: document.getElementById('mermaid-fullscreen-overlay'),

      // Other elements
      copyrightYear: document.getElementById('copyright-year'),
      syntaxOverride: document.getElementById('syntax-override'),
    };
  }
  return elements;
}
