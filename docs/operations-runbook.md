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

The repository does not currently define an automated Firestore backup/export workflow. Do not assume Git, Firebase Hosting history or seed scripts are a backup of live Firestore data.

Before introducing bulk edits, destructive migrations or cleanup tools for real data, establish a Firebase/Google Cloud export or backup procedure appropriate to the project and test restoration from it.

Until that exists:

- avoid bulk destructive operations on production data;
- make scripts default to safe/non-destructive behaviour;
- require explicit project and action selection;
- use marker/ownership checks before deletion;
- record the scope of any manual repair.

Adding automated backup/export plus a tested restore procedure should remain an operations backlog item.

## 9. Secrets and configuration

Frontend Firebase configuration is supplied through `VITE_FIREBASE_*` environment values. `VITE_EMAIL_API_URL` configures the email endpoint.

GitHub Actions additionally uses secrets for Firebase deployment/service-account access and E2E credentials.

Rules:

- never commit service-account JSON, passwords or private API credentials;
- do not paste secrets into PR descriptions, workflow logs or screenshots;
- rotate a secret if it is accidentally exposed;
- when adding a required secret/variable, document its **name and purpose**, not its value.

## 10. Incident checklist

For a production incident:

1. Identify whether the impact is availability, authorization/privacy, incorrect data, email, or UI-only.
2. Stop further risky operations (for example seed/cleanup or admin bulk edits).
3. Capture the affected route/action, approximate time and relevant commit/PR.
4. For privacy/authorization issues, prioritize access restriction over feature availability.
5. Revert or patch through a reviewed PR whenever possible.
6. Verify the fix in production.
7. Add an automated regression test if the incident could have been detected by CI.
8. Document any manual data repair performed.

## 11. Routine maintenance

Periodically review:

- dependency/security audit results;
- failing or flaky Playwright tests;
- Firestore rule coverage when new collections are added;
- unused GitHub Actions secrets/variables;
- test seed data and cleanup safeguards;
- Firebase indexes and rules deployed versus repository state;
- email endpoint configuration and test documentation;
- whether a real Firestore backup/restore process has been established.

## 12. Related documentation

- `README.md` — project entry point and local setup
- `docs/playwright-testing.md` — Playwright setup
- `docs/playwright-role-testing.md` — role/permission E2E testing
- `docs/email-branding.md` — email presentation details
- `docs/event-consent-email-testing.md` — event-consent email testing
