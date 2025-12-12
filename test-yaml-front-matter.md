---
title: Test Document with YAML Front Matter
author: Mick Darling
date: 2025-12-12
version: 1.0
tags:
  - markdown
  - yaml
  - front-matter
  - testing
description: This document tests the YAML front matter rendering feature in Merview
license: AGPL-3.0
---

# Test Document

This document contains YAML front matter that should be rendered as a clean metadata panel.

## Features Being Tested

1. **Basic key-value pairs** (title, author, date)
2. **Array values** (tags)
3. **Multi-word values** (description)

## Expected Behavior

The YAML front matter above should:
- Be extracted from the markdown
- Rendered as a collapsible panel
- Display in a table format
- Handle arrays as bullet lists
- Not appear as a code block

## Sample Mermaid Diagram

```mermaid
graph LR
    A[YAML Front Matter] --> B[Parser]
    B --> C[Render as Panel]
    C --> D[Beautiful Display]

    style A fill:#3498db
    style D fill:#27ae60
```

## Code Example

```javascript
// This is a code block
function parseYAML(text) {
    return parse(text);
}
```

That's it! The front matter should display nicely above this content.
