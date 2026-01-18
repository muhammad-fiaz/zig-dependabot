<div align="center">
<img width="500" height="500" alt="logo" src="https://github.com/user-attachments/assets/774b5e27-5c7c-4255-a7bf-f6f431b26e30" />

# Zig Dependabot Action

**Automated dependency updates for Zig projects.**

<a href="https://github.com/muhammad-fiaz/zig-dependabot"><img src="https://img.shields.io/github/stars/muhammad-fiaz/zig-dependabot" alt="GitHub stars"></a>
<a href="https://github.com/muhammad-fiaz/zig-dependabot/issues"><img src="https://img.shields.io/github/issues/muhammad-fiaz/zig-dependabot" alt="GitHub issues"></a>
<a href="https://github.com/muhammad-fiaz/zig-dependabot/pulls"><img src="https://img.shields.io/github/issues-pr/muhammad-fiaz/zig-dependabot" alt="GitHub pull requests"></a>
<a href="https://github.com/muhammad-fiaz/zig-dependabot"><img src="https://img.shields.io/github/last-commit/muhammad-fiaz/zig-dependabot" alt="GitHub last commit"></a>
<a href="https://github.com/muhammad-fiaz/zig-dependabot"><img src="https://img.shields.io/github/license/muhammad-fiaz/zig-dependabot" alt="License"></a>
<a href="https://github.com/muhammad-fiaz/zig-dependabot/actions/workflows/ci.yml"><img src="https://github.com/muhammad-fiaz/zig-dependabot/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
<a href="https://github.com/muhammad-fiaz/zig-dependabot/actions/workflows/github-code-scanning/codeql"><img src="https://github.com/muhammad-fiaz/zig-dependabot/actions/workflows/github-code-scanning/codeql/badge.svg" alt="CodeQL"></a>
<img src="https://img.shields.io/badge/platforms-linux%20%7C%20windows%20%7C%20macos-blue" alt="Supported Platforms">
<a href="https://github.com/muhammad-fiaz/zig-dependabot/releases/latest"><img src="https://img.shields.io/github/v/release/muhammad-fiaz/zig-dependabot?label=Latest%20Release&style=flat-square" alt="Latest Release"></a>
<a href="https://pay.muhammadfiaz.com"><img src="https://img.shields.io/badge/Sponsor-pay.muhammadfiaz.com-ff69b4?style=flat&logo=heart" alt="Sponsor"></a>
<a href="https://github.com/sponsors/muhammad-fiaz"><img src="https://img.shields.io/badge/Sponsor-💖-pink?style=social&logo=github" alt="GitHub Sponsors"></a>
<a href="https://hits.sh/github.com/muhammad-fiaz/zig-dependabot/"><img alt="Hits" src="https://hits.sh/github.com/muhammad-fiaz/zig-dependabot.svg"/></a>

<p><em>Automated dependency updates for Zig projects.</em></p>

<b><a href="#usage">Usage</a> |
<a href="#inputs">Inputs</a> |
<a href="CONTRIBUTING.md">Contributing</a></b>

</div>

This action automatically keeps your Zig dependencies up-to-date by scanning your `build.zig.zon`, checking for newer versions of your git-based dependencies (GitHub, GitLab, Codeberg, etc.), and managing the update process via Pull Requests or Issues.

## Usage

Create a workflow file `.github/workflows/dependabot.yml`.

### Minimal Configuration

```yaml
name: Zig Dependabot

on:
  schedule:
    - cron: '0 0 * * *' # Run daily at midnight
  workflow_dispatch: # Allow manual trigger

permissions:
  contents: write # Required to push update branches
  pull-requests: write # Required to create and manage PRs
  issues: write # Required if you enabled issue creation

jobs:
  update-deps:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Setup Zig
        uses: mlugg/setup-zig@v2
        with:
          version: master

      - name: Run Zig Dependabot
        uses: ./ # Replace with actual action path/repo
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          # Optional: Add extra trusted domains
          extra_domains: 'git.sr.ht, my-gitea.com'
          # Optional: Configure notifications
          create_pr: true
          create_issue: false
          # Optional: Validate updates before creating PR (Recommended)
          run_validation: true
          build_command: 'zig build -Doptimize=ReleaseSafe'
          test_command: 'zig build test'
```

### Inputs

| Input            | Description                                                                                                                                                         | Default               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `token`          | GitHub Token used for API access.                                                                                                                                   | `${{ github.token }}` |
| `extra_domains`  | Comma-separated list of additional trusted git domains (e.g. `git.sr.ht`). By default, `github.com`, `gitlab.com`, `bitbucket.org`, and `codeberg.org` are trusted. | `""`                  |
| `create_pr`      | Whether to create a Pull Request for updates.                                                                                                                       | `true`                |
| `create_issue`   | Whether to create an Issue for updates instead of/in addition to PRs.                                                                                               | `false`               |
| `run_validation` | Whether to run build and test commands to validate updates.                                                                                                         | `true`                |
| `build_command`  | Command to run for building the project during validation.                                                                                                          | `zig build`           |
| `test_command`   | Command to run for testing the project during validation.                                                                                                           | `zig build test`      |

### Required Permissions

This action requires the following permissions to function correctly:

- **`contents: write`**: To create new branches and push commits with dependency updates.
- **`pull-requests: write`**: To create new Pull Requests and close outdated ones.
- **`issues: write`**: To create issues (if `create_issue` is enabled).

If you are using a restrictive token or Fine-grained PAT, ensure it has these scopes for the repository.
