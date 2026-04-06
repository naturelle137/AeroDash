# Branching Model (Gitflow)

This project strictly follows the **Gitflow** branching model to ensure a stable production release while allowing for continuous integration of new features and fixes.

## Branch Types & Diagram

```text
main (production)          ← Only stable, tagged releases live here
  │
  ├── release/1.0.x        ← Stabilization branch for v1.0 series
  │     ├── hotfix/1.0.1-fix-cg-calc
  │     └── hotfix/1.0.2-unit-conversion
  │
  ├── release/1.1.x        ← Next point release series
  │
develop                    ← Integration branch for next release
  │
  ├── feature/mb-core      ← Feature development
  ├── feature/issue-51     ← Bug fixes
  └── feature/metar-fetch
```

## Main Branches

1. **`main`**: The production-ready branch. **Never commit directly to `main`**. Code is only merged into `main` from a `release/` or `hotfix/` branch.
2. **`develop`**: The integration branch for the next release. **Never commit directly to `develop`**. All feature branches and bug fixes must be merged into `develop` via Pull Requests.

## Supporting Branches

### 1. Feature Branches (`feature/`)

* **Branched from:** `develop`
* **Must merge back into:** `develop`
* **Naming Convention:** `feature/issue-<number>` or `feature/<short-description>`
* **Purpose:** Developing new features AND fixing non-critical bugs for an upcoming release. Always use a Pull Request to merge back into `develop`.

### 1a. Dependency Update Branches (`dependabot/`)

* **Branched from:** `develop` *(automated)*
* **Must merge back into:** `develop`
* **Naming Convention:** `dependabot/*` *(GitHub-native Dependabot naming; not configurable to `feature/*`)*
* **Purpose:** Automated dependency updates. Treated like feature branches: must go through a PR and pass required checks before merging into `develop`.

### 2. Release Branches (`release/`)

* **Branched from:** `develop`
* **Must merge back into:** `main` and `develop`
* **Naming Convention:** `release/v<semantic-version>` (e.g., `release/v0.1.0-alpha`)
* **Purpose:** Preparing a new production release. Only bug fixes and documentation updates are allowed here.

### 3. Hotfix Branches (`hotfix/`)

* **Branched from:** `main` (or a specific `release/*` branch)
* **Must merge back into:** `main` and `develop`
* **Naming Convention:** `hotfix/issue-<number>` or `hotfix/<short-description>`
* **Purpose:** Addressing severe, critical bugs in the production environment.

---

## Workflow

### 1. Feature Development

```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/issue-123

# Work on feature/bug...
git add .
git commit -m "feat: implement issue 123"

# When complete, open PR to develop
git push origin feature/issue-123
gh pr create --base develop --title "feat: implement issue 123"
```

### 2. Preparing a Release

```bash
# When develop is ready for release
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0

# Stabilize, fix release-blocking bugs, update versions
git commit -m "chore: prepare release 1.0.0"
git push origin release/v1.0.0
```

### 3. Publishing a Release

```bash
# Merge release branch to main via PR
gh pr create --base main --head release/v1.0.0 --title "Release v1.0.0"

# After merging to main, tag the release
git checkout main
git pull origin main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags

# Back-merge to develop via PR
gh pr create --base develop --head release/v1.0.0 --title "chore: back-merge release v1.0.0 to develop"
```

### 4. Hotfix (Critical Production Bug)

```bash
# Branch from main (or active release branch)
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# Fix the bug
git commit -m "fix: critical production crash"
git push origin hotfix/critical-bug

# Merge back to main via PR and tag
gh pr create --base main --head hotfix/critical-bug --title "fix: critical production crash"

# Tag the patch release on main
git checkout main
git pull origin main
git tag -a v1.0.1 -m "Hotfix v1.0.1"
git push origin main --tags

# Back-merge the hotfix to develop via another PR
gh pr create --base develop --head hotfix/critical-bug --title "chore: back-merge hotfix to develop"
```

---

## Version Numbering (Semantic Versioning)

```text
vMAJOR.MINOR.PATCH
  │     │     └── Bug fixes, hotfixes (1.0.1, 1.0.2)
  │     └── New features, backward compatible (1.1.0, 1.2.0)
  └── Breaking changes, major rewrites (2.0.0)
```

* **Hotfix:** Increments PATCH (e.g., `1.0.0` → `1.0.1`)
* **Point Release:** Increments MINOR (e.g., `1.0.2` → `1.1.0`)
* **Major Release:** Increments MAJOR (e.g., `1.x` → `2.0.0`)

---

## Protected Branch Rules (GitHub Settings)

Configure the following rules in **Settings → Branches → Branch protection rules**:

### `main`

* ✅ Require pull request reviews (1 approval minimum)
* ✅ Require status checks to pass (CI/Tests)
* ✅ Require branches to be up to date
* ✅ Require signed commits *(recommended)*
* ✅ Do not allow force pushes
* ✅ Do not allow deletions

### `develop`

* ✅ Require pull request reviews
* ✅ Require status checks to pass
* ❌ Allow force pushes (for rebasing feature branches)

#### Allow Dependabot to merge into `develop`

In GitHub **branch protection** / **rulesets**, ensure PRs from `dependabot/*` are permitted to merge into `develop`:

* **Base branch pattern**: `develop`
* **Allowed source branches** (for PRs): include `feature/*`, `release/*`, `hotfix/*`, and **`dependabot/*`**
* **Required checks**: keep the same checks as other PRs into `develop`
* **Bypass / exceptions**: optional, but if used, apply only to Dependabot and only for `develop` (never for `main`)

### `release/*`

* ✅ Require pull request reviews
* ✅ Require status checks to pass

---

## Pull Request Guidelines

* All merges into `develop` or `main` **must** be done via Pull Requests.
* Please use the repository's `.github/pull_request_template.md` and complete the safety and quality checklists.
