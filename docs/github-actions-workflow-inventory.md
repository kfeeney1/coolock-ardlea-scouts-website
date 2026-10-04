# GitHub Actions workflow inventory

SW-291 reviewed the workflows retained under `.github/workflows/` against the current CI/CD, deployment, assurance, recovery and operational model.

| Workflow | Classification | Current purpose / rationale |
| --- | --- | --- |
| `branch-protection-audit.yml` | Current | Audits the main branch protection contract on push, schedule and demand. |
| `firebase-hosting-merge.yml` | Current | Protected manual Production deployment. |
| `firebase-hosting-pull-request.yml` | Current | TEST-only PR preview/build validation; separate from the post-merge TEST deployment. |
| `firebase-hosting-test.yml` | Current | Authoritative automatic Firebase TEST deployment for pushes to `main`; required by post-merge assurance. |
| `firestore-backup-freshness.yml` | Current | Scheduled unattended Production backup-freshness assurance. |
| `firestore-backup.yml` | Current | Scheduled/manual Production Firestore backup. |
| `firestore-data-audit.yml` | Requires retention | Manual protected Production data-provenance diagnostic/recovery tool. |
| `firestore-rules.yml` | Current | Rules/storage emulator validation for relevant PRs and `main`. |
| `playwright-e2e.yml` | Current | Authoritative mandatory Playwright E2E suite and aggregate `e2e` check. |
| `post-deploy-smoke.yml` | Requires retention | Manual read-only Production smoke verification; intentionally separate from deployment. |
| `quality.yml` | Current | Authoritative mandatory Quality check. |
| `rebuild-parent-weekly-meetings.yml` | Requires retention | Explicit guarded Production repair/rebuild operation. |
| `rebuild-public-leadership.yml` | Requires retention | Explicit guarded Production Who's Who rebuild operation. |
| `seed-account-drift.yml` | Requires retention | Manual TEST seed-account drift diagnostic. |
| `email-worker-production.yml` | Current | Protected manual Production email Worker deployment. |
| `post-merge-ci-guard.yml` | Current | Exact-SHA post-merge assurance for Quality, E2E and Firebase TEST Deploy. |
| `leader-auth-stability.yml` | Obsolete — removed by SW-291 | Historical targeted stability proof. It repeats unit/email tests and a single Playwright journey. Mandatory `quality.yml` and hardened/sharded `playwright-e2e.yml` now provide the authoritative coverage and flake rejection, so retaining this workflow duplicates CI without providing a distinct operational capability. |

## Removal rule

A workflow is not considered obsolete merely because it runs infrequently. Manual recovery, audit, Production verification and scheduled monitoring workflows are retained where they provide a distinct operational capability.

SW-291 does not rename or remove the required `quality`, `e2e` or `deploy_test` checks, does not change Production deployment automation, and does not weaken Playwright coverage.
