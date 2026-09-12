# Production deployment

Production deployment is deliberately manual and targets only the `coolock-ardlea-scouts` Firebase project.

## Deploy

1. Merge reviewed code to `main` and wait for required CI to pass.
2. In GitHub Actions, open **Firebase PRODUCTION Manual Deploy**.
3. Select **Run workflow** on `main`.
4. Approve the protected `production` environment if GitHub requests approval.

No project ID or commit SHA needs to be typed. The workflow checks out the current `main` commit, records its exact SHA, verifies successful `quality` and `e2e` checks for that SHA, reruns the release security/unit/Rules checks, validates the production Firebase credential and public configuration, builds with `VITE_APP_ENV=production`, and deploys Rules, indexes, Storage rules and Hosting to PRODUCTION.

An ordinary push, merge, pull request, schedule, release or successful CI run cannot trigger this workflow.

The workflow summary records the actor, deployed SHA, Firebase project and production URL. Post-deployment checks are read-only.

## Rollback

Rollback is also a deliberate production release. Restore/revert the desired application state onto reviewed `main`, let required CI pass, and manually run **Firebase PRODUCTION Manual Deploy** again. Data restoration is a separate production operation and must follow the backup/recovery procedure; do not use a Hosting rollback to mutate production data.
