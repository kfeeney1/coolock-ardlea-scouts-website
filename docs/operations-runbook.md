# Operations Runbook

This runbook describes the current operational procedures for the Coolock Ardlea Scouts website. It documents what is automated today and calls out recovery steps that still require a human decision.

## 1. Production architecture

The application is a Vite-built React frontend deployed to Firebase Hosting. It uses Firebase Authentication and Firestore. Firestore authorization is enforced by `firestore.rules`. Email calls are made through the endpoint configured by `VITE_EMAIL_API_URL`.

The canonical production branch is `main`.

## 2. Pull-request release flow

For normal changes:

1. Create a branch from current `main`.
2. Open a pull request.
3. Confirm the **Quality** workflow passes.
4. Confirm the Firebase Hosting preview is successful and manually inspect it when the change affects UI or routing.
5. Confirm **Playwright E2E** passes for application changes.
6. When Firestore rules or rule tests change, confirm **Firestore Rules** passes.
7. Merge only after the relevant checks are green.

The Firebase Hosting PR workflow builds a preview. A merge to `main` triggers the production Firebase Hosting deployment workflow.

Do not use a successful preview as evidence that Firestore authorization changes are safe; use the emulator-backed rules test workflow for that boundary.

## 3. Standard local validation

Before pushing a significant change, run:

```bash
npm ci
npm run quality
```

`npm run quality` executes linting, unit tests and the production build.

For browser-level changes, also run Playwright when the required test accounts/data are available:

```bash
npm run test:e2e
```

See `docs/playwright-testing.md` and `docs/playwright-role-testing.md` for test-user prerequisites.

## 4. Firestore rules changes

`firestore.rules` is a production security boundary. Treat a rules change as a security-sensitive change.

Required procedure:

1. Change the production rules file; do not maintain a separate test-only copy.
2. Add or update a case in `tests/firestore/firestore.rules.test.mjs` that demonstrates the intended allow/deny behaviour.
3. Open a PR and confirm the **Firestore Rules** workflow passes.
4. Review queries used by the application to ensure they are compatible with the new rule conditions.
5. Merge only after the rule test and normal quality checks pass.

High-value regression cases include anonymous access, section-scoped leaders, approved parent/member links, administrator privileges, public form writes, audit-log immutability and default-deny behaviour.

## 5. Firebase test data

The manual GitHub Actions workflow **Seed Firebase Test Data** runs deterministic scripts in `scripts/`.

Before running it:

1. Verify the workflow is using the intended Firebase project/service-account secret.
2. Select the required action deliberately (`seed` or `cleanup`).
3. Avoid running cleanup while someone is actively using the shared test population.

The seed scripts use explicit test markers/known IDs so cleanup can identify records created by the test seed. If a cleanup script refuses to delete a record because its marker is missing, investigate it rather than weakening the guard.

After `seed`:

- verify the expected test identities can sign in;
- confirm seeded section/member counts if the change depends on population size;
- run the relevant Playwright journey.

After `cleanup`:

- confirm ordinary/non-test records remain intact;
- seed again before E2E runs that require persistent test identities/data.

Never point seed scripts at a different Firebase project without reviewing every write/delete path first.

## 6. Production deployment verification

After a merge that affects production behaviour:

1. Confirm the Firebase Hosting merge workflow completed successfully.
2. Load the production home page and one changed route.
3. For authenticated changes, verify the affected role can sign in and reach the expected screen.
4. For Firestore/rules changes, perform one positive and one negative authorization sanity check where practical.
5. For email changes, use a controlled recipient/test path and confirm the message content/link before broad use.

Avoid creating real member or consent data solely for smoke testing when seeded/test paths can prove the same behaviour.

## 7. Rollback procedure

There is no application-level automated rollback button in this repository. Recovery is currently Git/GitHub + Firebase deployment based.

For a bad application deployment:

1. Identify the merge/commit that introduced the issue.
2. Prefer a GitHub revert PR rather than rewriting `main` history.
3. Let normal CI validate the revert.
4. Merge the revert so the Firebase Hosting merge workflow redeploys the known-good code.
5. Verify production again after deployment.

For a Firestore rules regression:

1. Treat unauthorized data exposure as urgent.
2. Revert/fix the rules to the last known-good policy.
3. Add a regression test that reproduces the issue.
4. Run the emulator rules workflow before deploying the corrected rules.

For bad data writes, reverting frontend code does **not** undo Firestore mutations. Assess the affected records separately before changing or deleting data.

## 8. Backup and data recovery

The repository includes a **Firestore Backup** GitHub Actions workflow that performs a managed export of the production `(default)` Firestore database to Cloud Storage.

The workflow:

- runs automatically every Sunday at 03:17 UTC;
- can be run manually after typing the production project ID exactly;
- refuses to run if `FIRESTORE_BACKUP_BUCKET` is missing or is not a `gs://` URI;
- verifies the active Google Cloud project before exporting;
- verifies bucket access before the export;
- waits for the export to complete and checks that output files exist;
- records the resulting export path in the GitHub Actions job summary.

The backup workflow reuses the existing `FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS` secret. The service account that starts the export must have permission to run Firestore import/export operations, and the Firestore service agent must be able to access the backup bucket.

Production restore is intentionally **not** automated as a one-click workflow. Firestore imports can overwrite existing documents, so an incident must be scoped and reviewed before an import is started.

Before significant bulk edits, destructive migrations, cleanup tools or manual production repair:

1. run a fresh manual **Firestore Backup**;
2. confirm the run completed successfully;
3. record the exact export URI;
4. do not proceed if the backup cannot be verified.

See `docs/firestore-backup-recovery.md` for one-time bucket/IAM setup, first-run verification, retention guidance, the manual import procedure and restore-testing guidance.

## 9. Event gallery access and lifecycle

Parent gallery access has two projections with different purposes: `eventGalleryAccess/{eventId}/parents/{parentUid}` is the trusted authorization pointer used by Storage Rules, while `parentGalleryEvents/{eventId}` contains only parent-safe event metadata so Closed and Completed event galleries remain discoverable without exposing the full leader event document.

The trusted commands require `FIREBASE_SERVICE_ACCOUNT_JSON`. They are dry-run by default:

```bash
npm run backfill:parent-gallery-events
npm run audit:event-gallery-access
```

Use `EVENT_ID=<id>` to scope either command to one event. The access audit also accepts `SECTION=<section>`. Review all output before adding `APPLY=true`.

For the Stage 16.5 rollout, run the parent-gallery-event backfill once after the new rules are deployed. It materializes retained event metadata only for events that already have at least one active gallery-access projection, and skips Draft/missing/incomplete events. New gallery grants and normal event updates maintain the retained projection automatically after that.

The access audit checks the current event, parent, member, attendance and source photo-consent contract. In apply mode it deactivates an active projection only when those current facts no longer support access; it does not delete gallery objects. Review unexpected stale reasons before applying. Consent withdrawal is already enforced immediately by Storage Rules, so the audit is cleanup/visibility rather than the primary privacy boundary.

Before running either command with `APPLY=true` against production, take and verify a fresh Firestore backup when the scope is broad or the output is unexpected. For a single reviewed access revocation, use `scripts/set-event-gallery-access.mjs` with `REVOKE=true` and dry-run it first.

## 10. Secrets and configuration

Frontend Firebase configuration is supplied through `VITE_FIREBASE_*` environment values. `VITE_EMAIL_API_URL` configures the email endpoint.

GitHub Actions additionally uses secrets for Firebase deployment/service-account access and E2E credentials. Firestore backup configuration uses the `FIRESTORE_BACKUP_BUCKET` repository variable plus the existing Firebase service-account secret.

Rules:

- never commit service-account JSON, passwords or private API credentials;
- do not paste secrets into PR descriptions, workflow logs or screenshots;
- rotate a secret if it is accidentally exposed;
- when adding a required secret/variable, document its **name and purpose**, not its value.

## 11. Incident checklist

For a production incident:

1. Identify whether the impact is availability, authorization/privacy, incorrect data, email, or UI-only.
2. Stop further risky operations (for example seed/cleanup or admin bulk edits).
3. Capture the affected route/action, approximate time and relevant commit/PR.
4. For privacy/authorization issues, prioritize access restriction over feature availability.
5. For bad data writes, identify the last verified Firestore backup before the incident.
6. Revert or patch application code through a reviewed PR whenever possible.
7. If data repair/import is required, follow `docs/firestore-backup-recovery.md` rather than treating a code revert as data recovery.
8. Verify the fix in production.
9. Add an automated regression test if the incident could have been detected by CI.
10. Document any manual data repair performed.

## 12. Routine maintenance

Periodically review:

- dependency/security audit results;
- failing or flaky Playwright tests;
- Firestore rule coverage when new collections are added;
- stale event-gallery access projections with `npm run audit:event-gallery-access`;
- retained gallery event metadata after lifecycle/backfill changes;
- unused GitHub Actions secrets/variables;
- test seed data and cleanup safeguards;
- Firebase indexes and rules deployed versus repository state;
- email endpoint configuration and test documentation;
- scheduled Firestore backup success;
- backup bucket IAM/lifecycle rules;
- whether restore has been tested recently in a suitable non-production environment.

## 13. Related documentation

- `README.md` — project entry point and local setup
- `docs/firestore-backup-recovery.md` — Firestore backup setup and recovery procedure
- `docs/playwright-testing.md` — Playwright setup
- `docs/playwright-role-testing.md` — role/permission E2E testing
- `docs/stage-16-event-gallery.md` — event-gallery authorization, lifecycle and rollout
- `docs/email-branding.md` — email presentation details
- `docs/event-consent-email-testing.md` — event-consent email testing
