import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        // Third-party libraries loaded via CDN
        marked: "readonly",
        mermaid: "readonly",
        Prism: "readonly",
        DOMPurify: "readonly",
        CodeMirror: "readonly",
        hljs: "readonly",
        // App globals
        expandMermaid: "readonly",
      },
    },
    rules: {
      "indent": "off",
      "linebreak-style": ["error", "unix"],
      "quotes": "off",
      "semi": "off",
      "no-unused-vars": "warn",
      "no-console": "off",
    },
  },
];
