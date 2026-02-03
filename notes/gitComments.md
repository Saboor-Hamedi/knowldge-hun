# Git Collaboration Workflow

## 1. Branch Management

- **Main Branch**: production-ready code.
- **Develop Branch**: integration branch for features.
- **Feature Branches**: `feature/feature-name`
- **Bugfix Branches**: `hotfix/bug-name`

## 2. Commit Messages

- Use imperative mood: "Add feature" not "Added feature"
- Structure:
  ```
  feat: add login page
  fix: resolve navigation bug
  docs: update README
  style: format code
  refactor: restructure component
  test: add unit tests
  chore: update build tasks
  ```

## 3. Pull Requests

- Keep PRs small and focused.
- Review code before merging.
- Ensure CI checks pass.
- Squash commits if necessary before merging.

## 4. Syncing

- `git fetch origin`
- `git pull origin main`
- `git rebase main` (on feature branch)
