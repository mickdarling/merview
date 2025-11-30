# Security Policy

## Reporting Security Vulnerabilities

We take security seriously in the Merview project. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please use GitHub's Security Advisories feature for private vulnerability reporting:**

1. Visit: https://github.com/mickdarling/merview/security/advisories
2. Click "Report a vulnerability"
3. Fill out the advisory form with details (see below)

**Do NOT:**
- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before we've had a chance to address it
- Use the vulnerability maliciously or share it with others

### What to Include in Your Report

To help us understand and address the issue quickly, please include:

1. **Description**: Clear explanation of the vulnerability
2. **Steps to Reproduce**: Detailed steps to reproduce the issue
3. **Impact**: What an attacker could achieve by exploiting this
4. **Affected Versions**: Which versions of Merview are affected
5. **Proof of Concept**: Code, screenshots, or demonstrations (if applicable)
6. **Suggested Fix**: If you have ideas on how to fix it (optional)
7. **Your Environment**: Browser version, OS, etc. (if relevant)

### What Constitutes a Security Issue?

**Security vulnerabilities** include:
- Cross-Site Scripting (XSS) that could affect other users
- Content Security Policy (CSP) bypasses that enable malicious code execution
- Dependency vulnerabilities in critical libraries (Mermaid.js, CodeMirror, etc.)
- Authentication/authorization issues (if auth features are added)
- Subresource Integrity (SRI) bypass vulnerabilities
- Malicious markdown/Mermaid syntax that could execute unintended code
- URL injection vulnerabilities in custom CSS loading
- Issues that could compromise user data in localStorage

**Regular bugs** (please use normal GitHub issues):
- UI/UX issues that don't have security implications
- Performance problems
- Feature requests
- Rendering bugs in markdown or Mermaid diagrams
- Browser compatibility issues (unless security-related)

### Response Timeline

Merview is maintained in spare time, but we prioritize security issues:

- **Initial Response**: Within 7 days of report
- **Severity Assessment**: Within 14 days
- **Fix Timeline**:
  - Critical vulnerabilities: 30 days
  - High severity: 60 days
  - Medium/Low severity: 90 days or next release

These are goals, not guarantees. Complex issues may take longer. We'll keep you updated on progress.

### Disclosure Policy

- We follow coordinated disclosure practices
- We'll work with you to understand and fix the issue
- Once a fix is released, we'll publish a security advisory
- We ask that you wait for our fix before public disclosure
- If you have a deadline for disclosure, please let us know in your report

### Recognition

We believe in recognizing security researchers who help make Merview safer:

- **Credit**: We'll credit you in the security advisory (if you wish)
- **Hall of Fame**: We maintain a list of security contributors in SECURITY.md
- **What we can't offer**: As an open-source spare-time project, we cannot offer bug bounties or financial rewards

### Security Hall of Fame

Security researchers who have responsibly disclosed vulnerabilities:

- *None yet - be the first!*

---

# Security Analysis & Cloudflare Tunnel Setup

## Security Assessment

### ✅ Safe to Expose (Good News!)

This application is **relatively safe** to expose via Cloudflare Tunnel because:

1. **100% Client-Side Processing**
   - All markdown rendering happens in the browser
   - No server-side code execution
   - No database or backend
   - No file uploads to server

2. **No Data Storage**
   - Uses browser localStorage only
   - Nothing stored on the server
   - Completely stateless

3. **No User Input Processing on Server**
   - No forms submitted to server
   - No API endpoints
   - Just static file serving

### ⚠️ Security Considerations

**1. Content Security Policy (CSP) - `unsafe-inline` Required**

The CSP includes `'unsafe-inline'` for both `script-src` and `style-src`. This is a known limitation, not a vulnerability:

- **Why it's required:**
  - CodeMirror dynamically generates inline styles for editor rendering
  - Mermaid.js generates inline SVG styles for diagram elements
  - Neither library supports nonce-based CSP

- **Mitigations in place:**
  - All CDN resources use Subresource Integrity (SRI) hashes
  - `frame-src: 'none'` blocks iframe injection
  - `object-src: 'none'` blocks plugin-based attacks
  - Script sources restricted to specific CDN domains

- **Future improvements:**
  - CodeMirror 6 may offer better CSP support
  - Could investigate `unsafe-hashes` with specific hash values

**2. No Authentication (Current)**
- Anyone with the URL can access it
- Suitable for public tools, not for private documents

**3. Public Access**
- Once exposed, anyone on the internet can use it
- They can render their own markdown
- They CANNOT access your documents (everything is client-side)

**4. Bandwidth Usage**
- People could use it heavily
- Cloudflare provides DDoS protection
- Rate limiting recommended

## Security Levels

### Level 1: Basic (Current - Default)
**Good for:** Personal use, internal tools, trusted users

**Security:**
- ✅ Basic security headers
- ✅ Hidden file protection
- ❌ No authentication
- ❌ No rate limiting
- ❌ No CSP

**Use:** `nginx.conf` (current default)

---

### Level 2: Enhanced (Recommended for Public)
**Good for:** Public exposure via Cloudflare Tunnel

**Security:**
- ✅ Enhanced security headers
- ✅ Content Security Policy (CSP)
- ✅ Rate limiting (10 req/sec)
- ✅ Hidden file protection
- ✅ Version hiding
- ❌ No authentication

**Use:** `nginx-secure.conf`

---

### Level 3: Password Protected (Most Secure)
**Good for:** Private use, sensitive content

**Security:**
- ✅ All Level 2 features
- ✅ Basic HTTP authentication (username/password)
- ✅ Locked down access

**Use:** `nginx-with-auth.conf`

---

## Switching Security Levels

### Option 1: Use Enhanced Security (No Auth)

```dockerfile
# Edit Dockerfile, change line:
COPY --chmod=644 nginx.conf /etc/nginx/conf.d/default.conf

# To:
COPY --chmod=644 nginx-secure.conf /etc/nginx/conf.d/default.conf
```

Then rebuild:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Option 2: Add Password Protection

**Step 1:** Create password file
```bash
# Install htpasswd (if needed)
# Mac: brew install httpd
# Linux: sudo apt-get install apache2-utils

# Create password file
htpasswd -c .htpasswd yourusername
# Enter password when prompted
```

**Step 2:** Update Dockerfile
```dockerfile
# Add after the COPY commands:
COPY --chmod=644 nginx-with-auth.conf /etc/nginx/conf.d/default.conf
COPY --chmod=644 .htpasswd /etc/nginx/.htpasswd
```

**Step 3:** Update .dockerignore
Remove `.htpasswd` from .dockerignore (if present)

**Step 4:** Rebuild
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

Now users will need to enter username/password to access.

---

## Cloudflare Tunnel Best Practices

### 1. Use Cloudflare Access (Recommended)

Instead of basic auth, use Cloudflare Access for better security:

- Add authentication via Google/GitHub/Email
- Set access policies (who can access)
- Audit logs
- No password to remember

**Setup:** In Cloudflare Zero Trust dashboard → Access → Applications

### 2. Cloudflare WAF Rules

Add Web Application Firewall rules:
- Rate limiting (already have nginx rate limiting, but extra layer)
- Bot protection
- Geographic restrictions
- Custom rules

### 3. Cloudflare Cache Settings

Set proper caching:
- Cache static assets (JS, CSS)
- Don't cache HTML (dynamic content)

---

## What Can/Cannot Be Compromised

### ✅ Safe (Cannot Be Compromised)

1. **Your Documents**
   - Nothing is stored on server
   - All content in user's browser only
   - Each user sees only what they type

2. **User Data**
   - No user accounts
   - No personal information collected
   - No cookies or tracking

3. **Server Data**
   - No database to hack
   - No backend to exploit
   - Just static HTML/JS/CSS

### ⚠️ Potential Risks

1. **Bandwidth Abuse**
   - Users could hammer the server
   - **Mitigation:** Rate limiting, Cloudflare DDoS protection

2. **Resource Usage**
   - Heavy Mermaid diagram rendering
   - **Mitigation:** Cloudflare's CDN, rate limiting

3. **Someone Uses It**
   - Others can render their markdown
   - **Impact:** Minimal - just bandwidth
   - **Mitigation:** Add authentication if unwanted

---

## Comparison: Security Levels

| Feature | Basic | Enhanced | With Auth |
|---------|-------|----------|-----------|
| Security Headers | Basic | Full | Full |
| CSP | ❌ | ✅ | ✅ |
| Rate Limiting | ❌ | ✅ | ✅ |
| Password | ❌ | ❌ | ✅ |
| Public Access | Yes | Yes | No |
| Best For | Local | Public Tool | Private |

---

## Recommended Setup for Cloudflare Tunnel

**For Public Sharing (anyone can use):**
1. Use `nginx-secure.conf` (Enhanced security)
2. Enable Cloudflare WAF
3. Monitor usage in Cloudflare Analytics
4. Set up rate limiting in Cloudflare

**For Private Use (only you/team):**
1. Use `nginx-with-auth.conf` OR Cloudflare Access
2. Cloudflare Access is better (SSO, audit logs)
3. Still enable WAF and monitoring

---

## Quick Security Checklist

Before exposing via Cloudflare:

- [ ] Decide: Public tool or private?
- [ ] Choose security level (Basic/Enhanced/Auth)
- [ ] Update nginx config if needed
- [ ] Rebuild Docker container
- [ ] Test locally first
- [ ] Set up Cloudflare Tunnel
- [ ] Enable Cloudflare WAF (recommended)
- [ ] Consider Cloudflare Access for private use
- [ ] Monitor traffic in first week
- [ ] Check Cloudflare Analytics for abuse

---

## Bottom Line

### ✅ Safe to Expose Because:
- No backend processing
- No data storage
- No user information collected
- Completely client-side
- Stateless application

### ⚠️ Considerations:
- Add rate limiting (use Enhanced config)
- Consider authentication for private use
- Monitor bandwidth usage
- Use Cloudflare's security features

**Recommendation:** Use Enhanced security (`nginx-secure.conf`) for public exposure, or add Cloudflare Access for private use.

The application itself is secure - the main consideration is controlling WHO can access it and preventing bandwidth abuse.
