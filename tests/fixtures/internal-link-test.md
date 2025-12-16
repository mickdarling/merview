# Internal Link Test Fixture

This file contains intentionally broken links to verify the internal link checker works correctly.

## Valid Links (should pass)

- [README](../../README.md)
- [Contributing Guide](../../CONTRIBUTING.md)

## Broken File Links (should fail)

- [Non-existent file](./non-existent-file.md)
- [Missing document](../../docs/this-does-not-exist.md)

## Broken Anchor Links (should fail)

- [Non-existent heading in this file](#non-existent-heading)
- [Missing section](#this-section-does-not-exist)

## Test Heading

This heading exists for anchor testing.
