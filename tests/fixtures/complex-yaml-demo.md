---
title: Complex YAML Highlighting Demo
description: |
  This document demonstrates enhanced YAML front matter highlighting
  for complex structures including nested objects, multi-line strings,
  anchors, aliases, and arrays with nested objects.
metadata:
  author:
    name: John Doe
    email: john@example.com
    social:
      github: johndoe
      twitter: "@johndoe"
  tags:
    - documentation
    - yaml
    - syntax-highlighting
    - testing
  statistics:
    lines: 100
    characters: 5000
    words: 750
# Comments are also highlighted
# Both inline and full-line comments
published: true # This is an inline comment
draft: false

# Multi-line strings with different styles
bio: |
  This is a literal block scalar.
  Newlines are preserved.
  Each line is kept separate.

  Even blank lines are preserved.

summary: >
  This is a folded block scalar.
  Lines are joined with spaces.
  This is useful for long paragraphs
  that need to wrap.

# Anchors and Aliases demonstration
defaults: &defaults
  layout: post
  published: true
  comments: enabled
  sidebar: true

# Using the anchor with merge key
post_settings:
  <<: *defaults
  category: blog
  featured: true

page_settings:
  <<: *defaults
  category: pages
  comments: disabled

# Complex nested arrays with objects
servers:
  production:
    - host: prod1.example.com
      port: 443
      ssl: true
      location:
        city: New York
        datacenter: us-east-1
    - host: prod2.example.com
      port: 443
      ssl: true
      location:
        city: London
        datacenter: eu-west-1
  staging:
    - host: stage.example.com
      port: 8080
      ssl: false

# Mixed data types
config:
  string_value: "Double quoted string"
  another_string: 'Single quoted string'
  unquoted_string: No quotes needed
  number: 42
  float: 3.14159
  boolean_true: true
  boolean_false: false
  null_value: null
  # Scientific notation
  scientific: 1.23e-4

# Nested arrays
matrix:
  - row:
      - cell: A1
        value: 10
      - cell: A2
        value: 20
  - row:
      - cell: B1
        value: 30
      - cell: B2
        value: 40

# Edge cases
edge_cases:
  empty_string: ""
  just_whitespace: "   "
  special_chars: "!@#$%^&*()"
  unicode: "Hello 世界 🌍"
  escaped: "Line 1\nLine 2\tTabbed"

# Another anchor for inheritance
base_config: &base
  timeout: 30
  retry: 3
  verbose: true

# Multiple inheritance
service_a:
  <<: *base
  name: "Service A"
  port: 8001

service_b:
  <<: *base
  name: "Service B"
  port: 8002
  timeout: 60  # Override from base

# Complex quoting scenarios
quotes:
  needs_quotes: "value: with colon"
  needs_quotes_2: "- starts with dash"
  needs_quotes_3: "# starts with hash"
  optional_quotes: plain value
  flow_style: { key1: value1, key2: value2 }
  flow_array: [item1, item2, item3]
---

# Markdown Content Starts Here

After the YAML front matter ends, this markdown content is highlighted with GFM syntax highlighting.

## Features Demonstrated

1. **Nested Objects**: Multiple levels of indentation
2. **Multi-line Strings**: Both literal (`|`) and folded (`>`) styles
3. **Anchors and Aliases**: `&anchor` and `*alias` with merge keys `<<:`
4. **Complex Arrays**: Arrays containing nested objects
5. **Comments**: Both inline and full-line comments
6. **Quoted Strings**: Double, single, and unquoted strings
7. **Data Types**: Numbers, booleans, null, scientific notation
8. **Flow Style**: Inline objects and arrays
9. **Unicode**: International characters and emojis
10. **Edge Cases**: Empty strings, special characters, escaped sequences

## Visual Verification

Open this file in the Merview editor to verify that:

- Keys are highlighted in one color
- Values are highlighted in another color
- Comments are clearly distinguished
- Anchors (`&name`) and aliases (`*name`) stand out
- Multi-line string indicators (`|` and `>`) are visible
- Delimiters (`---`) are highlighted as metadata
- Strings in quotes have different highlighting than unquoted strings
- Nested structures maintain proper indentation and highlighting
- The transition from YAML to Markdown is clear

## Code Example

Here's some code to show that markdown highlighting also works:

```javascript
function testYaml() {
  const yaml = `
    key: value
    nested:
      deep: data
  `;
  return yaml;
}
```

## Links and Formatting

- [Link to YAML spec](https://yaml.org/spec/)
- **Bold text** and *italic text*
- `Inline code` examples

> Blockquote to test GFM highlighting

| Table | Header |
|-------|--------|
| Cell  | Data   |

### Conclusion

This document should display with proper syntax highlighting in both the YAML front matter section and the Markdown content section.
