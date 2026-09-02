# Stage 18.7 — Branch protection drift detection

The repository-level review found that `main` is currently reported by GitHub as unprotected and the repository has no rulesets. That means the existing Quality, Playwright, Firebase Rules and Hosting checks can run, but GitHub is not yet configured to require them before every merge or to prevent a direct push from bypassing the pull-request process.

## What this stage adds

`Branch Protection Audit` runs after pushes to `main`, once per day, and on demand. It queries GitHub's repository metadata and fails if both of the following are true:

- `main` is not protected; and
- the repository has no active or evaluating ruleset.

The audit intentionally uses only `contents: read`, has no production Firebase credential, and does not mutate repository settings.

The companion script is `scripts/audit-main-branch-protection.mjs`. It accepts `GITHUB_REPOSITORY` and the standard workflow `GITHUB_TOKEN`, reads the `main` branch and repository rulesets, and reports visible required-check metadata when GitHub exposes it through the branch summary endpoint.

## Important limitation

This workflow is drift detection, not enforcement. A workflow that runs after a push cannot undo a direct push or make a failed PR check mandatory. Enforcement must be configured in GitHub repository settings with branch protection or a repository ruleset.

Before treating Stage 18 production hardening as complete, configure protection for `main` so that changes go through pull requests and required CI checks cannot be bypassed accidentally. At minimum, require the project's merge-critical Quality, Playwright and Firebase Rules checks and prevent ordinary direct pushes to `main`. Keep the production Hosting deployment on `main` as the post-merge release path.

Once protection is enabled, run `Branch Protection Audit` manually and confirm it passes. If protection is later removed, the scheduled audit will surface the regression.
