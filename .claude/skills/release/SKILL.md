---
description: Create a signed release with version bump, tag, and GitHub release notes
disable-model-invocation: true
arguments:
  - name: bump
    description: "Version bump type: patch (default), minor, or major"
    required: false
    default: patch
---

# Release

Create a new Canon release with version bump, signed commit/tag, and GitHub release.

## Workflow

### 1. Determine bump type

Use the `$ARGUMENTS` value. Valid values: `patch`, `minor`, `major`. Default to `patch` if empty or not provided.

### 2. Read current version

Read `package.json` and extract the current `version` field.

### 3. Calculate new version

Apply semver increment based on bump type:

- `patch`: `0.3.0` → `0.3.1`
- `minor`: `0.3.0` → `0.4.0`
- `major`: `0.3.0` → `1.0.0`

### 4. Bump version in both files

Update the `version` field in:

- `package.json`
- `.claude-plugin/plugin.json`

### 5. Commit with signing

Stage the two changed files and create a signed commit:

```bash
git add package.json .claude-plugin/plugin.json
git commit -S -m "Release v{new_version}"
```

### 6. Create signed tag

```bash
git tag -s v{new_version} -m "v{new_version}"
```

### 7. Push commit and tag

```bash
git push && git push --tags
```

### 8. Draft release notes

Review the git log since the previous tag:

```bash
git log $(git describe --tags --abbrev=0 HEAD~1)..HEAD --oneline
```

Organize changes into the following format:

```markdown
## What's New

### Category Name
- **Feature/change name** — description

### Another Category
- **Item** — description
```

Use descriptive category names based on the changes (e.g., "UI Improvements", "Performance", "Bug Fixes", "Developer Experience", "Infrastructure").

### 9. Create GitHub release

Create the release using `gh` — do NOT upload any binaries (a GitHub Actions workflow in `.github/workflows/release.yml` handles building and attaching binaries automatically):

```bash
gh release create v{new_version} --title "v{new_version}" --notes "{release_notes}"
```
