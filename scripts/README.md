# Scripts

This directory contains verification and automation scripts for the Merview project.

## verify-ui-references.js

Verifies that documentation references to UI elements (buttons, menus, labels) and document names match what actually exists in the application.

**GitHub Issue:** [#303](https://github.com/mickdarling/merview/issues/303)

### What It Checks

1. **Button labels** - Ensures documentation references match actual button text
2. **Dropdown options** - Verifies menu items exist in the UI
3. **Dialog titles** - Checks modal/dialog names are correct
4. **Document file references** - Validates that referenced files exist
5. **UI terminology consistency** - Ensures feature names match UI labels

### Usage

```bash
# Run from project root
node scripts/verify-ui-references.js

# Run from any directory
node scripts/verify-ui-references.js /path/to/project
```

### How It Works

1. **Extracts UI Elements** - Parses `index.html` and `js/config.js` to find:
   - Button text (from `<button>` elements)
   - Dropdown IDs and options (from `<select>` elements)
   - Dialog titles (from `<h2>` elements)
   - Configuration-defined menu items

2. **Extracts Documentation References** - Scans all `.md` files in `docs/` for:
   - Bold quoted text: `**"Button Name"**`
   - Action references: `click the "Save" button`
   - Location references: `in the "Style" dropdown`
   - File paths: `docs/guide.md`

3. **Cross-References** - Compares documentation references against actual UI elements

4. **Reports Mismatches** - Provides:
   - File and line number of each issue
   - Context showing the problematic reference
   - Fuzzy match suggestions for likely corrections

### Example Output

```
================================================================================
UI Reference Verification Report
================================================================================

Errors (2):

✗ docs/CSS-LOADING-GUIDE.md:54
  UI element "Load from file" not found in index.html
  Reference: "Load from file"
  Context: 2. Select **"Load from file"**
  Did you mean: Load from file..., Load from URL...

✗ docs/developer-kit.md:139
  Referenced file "docs/guide.md" does not exist
  Reference: "/docs/guide.md"
  Context: <a href="https://merview.com/?url=...docs/guide.md"

================================================================================
Found 2 error(s)
```

### What Is Verified

#### UI Elements Checked
- All `<button>` elements with visible text
- All `<select>` dropdown options
- Dialog/modal titles
- Configuration-defined menu items from `js/config.js`
- Common UI patterns (Load/Save/Clear/etc.)

#### Documentation Patterns Matched
- `**"UI Element Name"**` - Bold quoted references
- `click/select/choose the "Element" button/menu/dropdown` - Action instructions
- `in/from the "Element" dropdown/menu/dialog` - Location references
- `docs/path/to/file.md` - File path references

#### What Is Skipped
- Example URLs (containing `example.com`, `user/repo`, etc.)
- Placeholder paths (common example filenames)
- Code blocks (unless they contain file references)
- External UI elements are pre-configured (e.g., GitHub's "Raw" button)

### Common Issues Caught

1. **Ellipsis Mismatches**
   - Doc: `"Load from URL"`
   - UI: `"Load from URL..."`
   - Fix: Add ellipsis to match actual UI

2. **Button Name Changes**
   - Doc: `"Save As"` button
   - UI: `"Save as PDF"` button
   - Fix: Update documentation to match current button text

3. **Renamed Menu Items**
   - Doc: `"Settings"` menu
   - UI: `"Options"` menu
   - Fix: Update documentation terminology

4. **Missing File References**
   - Doc: References `docs/api.md`
   - Reality: File doesn't exist
   - Fix: Create file or remove reference

### Integration with CI/CD

The script is integrated into GitHub Actions via `.github/workflows/verify-ui-references.yml`:

- Runs on pushes and PRs that touch `docs/`, `index.html`, or the script itself
- Automatically comments on PRs when issues are found
- Fails the build if errors are detected
- Uploads detailed report as workflow artifact

### Maintenance

#### Hardcoded UI Elements

The script automatically extracts most UI elements from HTML, but some elements require manual registration in the `addKnownUIElements()` method. **This is a maintenance requirement** - when UI elements are added/renamed/removed, this list must be updated.

**Why hardcoded elements exist:**
- Some button text is dynamically generated or contains icons stripped during parsing
- External UI elements (e.g., GitHub's "Raw" button referenced in docs)
- Menu items defined in JavaScript config rather than HTML
- Elements added via JavaScript after page load

**Current hardcoded elements location:** `scripts/verify-ui-references.js` in the `addKnownUIElements()` method

**When to update:**
- Adding a new button/menu item referenced in documentation
- Renaming an existing UI element
- Removing a UI element (remove from both UI and hardcoded list)
- Adding documentation that references external UI (e.g., third-party buttons)

**How to update:**
```javascript
// In addKnownUIElements() method:
const knownButtons = [
  'Save',
  'Save as PDF',
  'Your New Button',  // Add new buttons here
  // ...
];

const knownLabels = [
  'Style',
  'Code Theme',
  'Your New Label',  // Add new labels/menu items here
  // ...
];

const knownTitles = [
  'Load from URL',
  'Your New Dialog Title',  // Add new dialog titles here
  // ...
];
```

**Best practice:** When adding new UI elements to the application, ensure they're properly structured in HTML so the parser finds them automatically. Only add to `addKnownUIElements()` when automatic extraction isn't possible.

#### Adding New Documentation Patterns

When documentation uses new reference patterns:

1. Add regex patterns to `extractDocReferences()` method
2. Test with sample documentation to ensure matches are correct
3. Add appropriate tests to `tests/verify-ui-references.spec.js`

### Exit Codes

- `0` - All references verified successfully
- `1` - Verification errors found or script failure

### Dependencies

- Node.js 20+ (uses built-in modules only)
- No external dependencies required

### Testing

To test the script manually:

```bash
# Should pass
node scripts/verify-ui-references.js

# Test with specific path
node scripts/verify-ui-references.js /path/to/merview

# View verbose output
node scripts/verify-ui-references.js 2>&1 | less
```

### Future Enhancements

Potential improvements:

- [ ] Add support for checking keyboard shortcuts documentation
- [ ] Verify tooltip text matches code
- [ ] Check accessibility labels (aria-label) against docs
- [ ] Validate internationalization strings
- [ ] Add allowlist for known external UI elements
- [ ] Support for checking multiple languages/localizations
