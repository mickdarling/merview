/**
 * editor.js
 * CodeMirror editor initialization and management
 */

import { state } from './state.js';
import { getElements } from './dom.js';

/**
 * Initialize CodeMirror 5 editor
 * @param {Function} onChangeCallback - Callback to trigger when editor content changes
 * @returns {CodeMirror} The CodeMirror instance
 */
export function initCodeMirror(onChangeCallback) {
    const { editorTextarea } = getElements();

    state.cmEditor = CodeMirror.fromTextArea(editorTextarea, {
        mode: 'gfm', // GitHub Flavored Markdown
        theme: 'custom', // Our custom theme loaded from styles/editor/
        lineNumbers: true,
        lineWrapping: true,
        autofocus: true,
        dragDrop: false, // Disable drag and drop of selections
        extraKeys: {
            'Enter': 'newlineAndIndentContinueMarkdownList',
            'Ctrl-S': function(cm) {
                // Save functionality will be handled by file-ops module
                if (globalThis.saveFile) {
                    globalThis.saveFile();
                }
                return false;
            },
            'Cmd-S': function(cm) {
                // Save functionality will be handled by file-ops module
                if (globalThis.saveFile) {
                    globalThis.saveFile();
                }
                return false;
            }
        }
    });

    // Listen for changes
    state.cmEditor.on('change', function() {
        if (onChangeCallback) {
            onChangeCallback();
        }
    });

    return state.cmEditor;
}

/**
 * Get the current content of the editor
 * @returns {string} The editor content
 */
export function getEditorContent() {
    if (!state.cmEditor) {
        console.warn('CodeMirror editor not initialized');
        return '';
    }
    return state.cmEditor.getValue();
}

/**
 * Set the content of the editor
 * @param {string} content - The content to set
 */
export function setEditorContent(content) {
    if (!state.cmEditor) {
        console.warn('CodeMirror editor not initialized');
        return;
    }
    state.cmEditor.setValue(content);
}
