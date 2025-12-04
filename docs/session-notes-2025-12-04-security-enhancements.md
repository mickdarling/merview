# Session Notes: Security Enhancements
**Date:** December 4, 2025 (Evening Session)
**Session ID:** merview-session-2025-12-04-security-enhancements

## Summary

This session focused on security hardening after merging PR #93 (Share to Gist). We identified and fixed two security issues, and created a human-centered security modal for handling private repository URLs.

## What Was Accomplished

### 1. Merged PR #93 - Share to Gist Feature
- All CI checks passing, no SonarCloud issues
- Deployed Cloudflare Worker with rate limiting and security hardening

### 2. Created Issues for Future Work
- **#94** - Add test for 30-second gist creation timeout
- **#95** - Add Cloudflare Worker unit tests using Miniflare
- **#96** - Consider "Manage GitHub Connection" UI for token status
- **#97** - Monitor Cloudflare Worker rate limit effectiveness

### 3. Fixed: Localhost Origins in Production Worker
**Problem:** The deployed Cloudflare Worker had `localhost` and `127.0.0.1` in `ALLOWED_ORIGINS`, meaning anyone who cloned Merview and ran it locally could use the production OAuth proxy.

**Solution:**
- Removed localhost origins from `wrangler.toml` (production)
- Added `ALLOWED_ORIGINS` to `.dev.vars.example` for local development
- Redeployed worker - now only accepts `merview.com` and `www.merview.com`

**Commit:** `6d8cef5` (pushed directly to main - should have been a PR)

### 4. Fixed: Private Repo Token Exposure (PR #98)
**Problem:** When users copy raw URLs from private GitHub repos, the URL contains a `?token=` parameter. If they paste this into Merview and share the resulting URL, they accidentally share their private repo access token.

**Solution - Human-Centered Security Modal:**
Instead of silently stripping the token, we now show a modal giving users explicit control:

#### Option 1: "View Locally Only"
- Renders content in editor
- Strips entire URL parameter from browser (`merview.com/` not `merview.com/?url=...`)
- No shareable URL exists - prevents accidental sharing

#### Option 2: "Share Securely via Gist"
- Loads content and triggers Share to Gist flow
- Creates a gist copy under user's account
- Provides a clean, shareable link

**Files Modified:**
- `index.html` - Modal HTML/CSS, JavaScript handlers, display:none fix for dialogs
- `tests/url-loading.spec.js` - Added 7 new tests for modal flow
- `tests/share-to-gist.spec.js` - Updated selectors to be more specific (#gistModal)

### 5. Created Issue #99
Documented the enhanced token handling feature for tracking.

## Technical Details

### Private URL Modal Flow
```
User pastes URL with ?token= → stripGitHubToken() detects token
    → showPrivateUrlModal() displays choice
        → "View Locally Only":
            - history.replaceState(null, '', pathname)
            - loadMarkdownFromURL(originalUrl)
            - showStatus warning
        → "Share Securely":
            - loadMarkdownFromURL(originalUrl)
            - history.replaceState(null, '', pathname)
            - shareToGist()
        → Backdrop click/ESC:
            - Same as "View Locally Only"
```

### Dialog CSS Fix
The `<dialog>` elements were using `display: flex` by default, which caused them to intercept pointer events even when closed. Fixed by:
```css
.gist-modal-overlay {
    display: none; /* Hidden by default */
}
.gist-modal-overlay[open] {
    display: flex;
}
```

### Token Detection Logic
```javascript
function stripGitHubToken(url) {
    const parsed = new URL(url);
    if (parsed.hostname === 'raw.githubusercontent.com' &&
        parsed.searchParams.has('token')) {
        parsed.searchParams.delete('token');
        return { cleanUrl: parsed.toString(), hadToken: true };
    }
    return { cleanUrl: url, hadToken: false };
}
```

## Test Results

- All 167 Playwright tests passing
- 7 new tests for private URL modal flow
- Fixed test selectors in share-to-gist.spec.js (now use #gistModal)

## Security Discussion

### GitHub Token Types
- **Normal GitHub web auth**: Uses cookies/OAuth tokens in HTTP headers (not in URL)
- **Private repo raw URLs**: GitHub generates signed URLs with `?token=` in query string
- This is GitHub's design choice for allowing raw file access without login

### What We Protect Against
1. **Direct sharing**: Token stripped from shareable URL
2. **Browser history**: Clean URL replaces tokenized URL
3. **Accidental copy/paste**: Modal makes user aware of security implications

### What We Don't Protect Against
- Token in network logs (HTTPS encrypted, same as direct GitHub access)
- User manually copying the token before modal appears

## Commits This Session

1. `6d8cef5` - `fix(security): Remove localhost from production worker allowed origins`
2. `b214ce5` - `fix(security): Strip GitHub private repo tokens from URLs` (initial)
3. `2b1347b` - `feat: Add security modal for private repo URL handling`

## Pending Items

### PR #98 - Awaiting CI/Review
- Claude Code review pending
- SonarCloud analysis pending
- May have must/should fix issues to address

### Deployment
After PR merge, no additional deployment needed (changes are client-side only).

## Notes

### Lesson Learned
The localhost security fix was pushed directly to main instead of going through a PR. While it was a simple change, it should have had Claude review for verification. Will use PRs consistently going forward.

### Design Philosophy
This session exemplified "human-centered security" - rather than silently fixing security issues (which users might not notice or understand), we give users explicit control and educate them about the implications. The modal explains what's happening and lets them choose their path forward.
