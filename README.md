# Zig Dependabot Action

**Automated dependency updates for Zig projects.**

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
        uses: actions/checkout@v4

      - name: Setup Zig
        uses: mlugg/setup-zig@v1
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

## Features

- **Zero Config**: Scans `build.zig.zon` automatically.
- **Universal Git Support**: Supports GitHub, GitLab, Bitbucket, Codeberg, and any generic Git URL (`git+https`, `.git`, `ssh`, etc.).
- **Semver**: Smart version resolution (Stable > Prerelease).
- **PR & Issue Management**: Automatically creates PRs or Issues. Closes outdated PRs.
- **Automatic Validation**: Runs `zig build` and `zig build test` (configurable) for each update to ensure stability before creating a PR.
- **Minimal Diffs**: Preserves formatting of your ZON file.
- **Security Check**: Verifies hashes using `zig fetch` before updating.

## Development

- `bun install`: Install dependencies
- `bun run test`: Run tests
- `bun run build`: Build for distribution
- `bun x tsc --noEmit`: Type check
