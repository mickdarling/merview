# Branch Protection Rules

[← Back to Welcome](/?sample)

---

This document describes the branch protection rules configured for the Merview project to ensure code quality and prevent accidental changes to critical branches.

## Overview

Branch protection rules help maintain the integrity of the codebase by enforcing specific workflows and preventing destructive operations. The Merview project uses different protection levels for different branches based on their role in the development workflow.

## Protected Branches

### `main` Branch

The `main` branch contains production-ready code and has the strictest protection rules:

- **Require pull request before merging**: All changes must go through a pull request
- **Required approving review count**: 0 (suitable for solo development; can be increased when team grows)
- **Dismiss stale reviews**: Disabled (existing approvals remain valid after new commits)
- **Enforce admins**: Disabled (allows repository admins to bypass restrictions when necessary)
- **Allow force pushes**: Disabled (prevents rewriting history)
- **Allow deletions**: Disabled (prevents accidental branch deletion)
- **Required status checks**: None currently (can be added once CI workflows are merged and running)

### `develop` Branch

The `develop` branch is the main integration branch for ongoing development:

- **Require pull request before merging**: All changes must go through a pull request
- **Required approving review count**: 0 (suitable for solo development; can be increased when team grows)
- **Dismiss stale reviews**: Disabled
- **Enforce admins**: Disabled
- **Allow force pushes**: Disabled (prevents rewriting history)
- **Allow deletions**: Disabled (prevents accidental branch deletion)
- **Required status checks**: None currently (can be added once CI workflows are merged and running)

## Future Enhancements

Once the CI/security workflows are merged and have run successfully, the protection rules can be updated to require passing status checks before merging. This would include:

- **CodeQL Analysis**: Security scanning for vulnerabilities
- **SonarCloud**: Code quality and security analysis
- **Unit Tests**: Automated testing suite
- **Build Validation**: Ensuring the project builds successfully

## Updating Branch Protection

Branch protection rules can be updated using the GitHub API via the `gh` CLI tool:

```bash
gh api repos/mickdarling/merview/branches/BRANCH_NAME/protection -X PUT --input - <<'EOF'
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false
  },
  "enforce_admins": false,
  "required_status_checks": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

Replace `<BRANCH_NAME>` with the branch to update (e.g., `main` or `develop`).

## Benefits

These protection rules provide several benefits:

1. **Prevents Accidental Changes**: Force pushes and deletions are blocked
2. **Encourages Code Review**: All changes must go through pull requests
3. **Maintains History**: Prevents history rewriting that could confuse collaborators
4. **Flexible for Solo Development**: Zero required approvals allows efficient solo work
5. **Scalable**: Rules can be tightened as the team grows or loosened for special circumstances

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub API Branch Protection Reference](https://docs.github.com/rest/branches/branch-protection)

---

## Navigation

- [← Back to Welcome](/?sample)
- [About Merview](/?url=docs/about.md)
- [Security](/?url=docs/security.md)
- [Contributing](/?url=docs/contributing.md)
- [Developer Kit](/?url=docs/developer-kit.md)
