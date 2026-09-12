# Firebase environments and release policy

## Environment contract

| Context | Firebase target | Data | Deployment |
| --- | --- | --- | --- |
| Local development | `demo-coolock-ardlea-scouts` Firebase emulators | synthetic only | none |
| Normal CI / required Playwright | `demo-coolock-ardlea-scouts` Firebase emulators | deterministic synthetic fixtures | none |
| Pull-request Hosting previews | `coolock-ardlea-scouts-test` | TEST-only synthetic data | temporary TEST Hosting preview channel |
| Stable TEST | `coolock-ardlea-scouts-test` | TEST-only synthetic data | automatic after `main` |
| PRODUCTION | `coolock-ardlea-scouts` | authoritative production data | explicit manual release only |

TEST and PRODUCTION must use separate Firebase projects, Auth users, Firestore data, Storage objects, service accounts/deployment credentials, email configuration and GitHub environment values. Real child, guardian, medical, consent or other production personal data must never be copied to TEST.

`.firebaserc` intentionally makes TEST the default CLI alias. Production operations must still supply the production project explicitly; a missing project selection must never silently choose production.

## GitHub environments

Create two GitHub environments before merging SW-34.

### `test`

This environment is used by stable TEST deployment and TEST PR previews. It must not contain any production credential or production email endpoint.

Configure these environment values directly in GitHub. Do not copy them into repository files or chat/log output:

- secret: `FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_TEST`
- variable: `VITE_FIREBASE_API_KEY`
- variable: `VITE_FIREBASE_AUTH_DOMAIN`
- variable: `VITE_FIREBASE_PROJECT_ID` = `coolock-ardlea-scouts-test`
- variable: `VITE_FIREBASE_STORAGE_BUCKET`
- variable: `VITE_FIREBASE_MESSAGING_SENDER_ID`
- variable: `VITE_FIREBASE_APP_ID`
- variable: `VITE_FIREBASE_MEASUREMENT_ID` when used
- variable: `VITE_EMAIL_API_URL` pointing only to a TEST/sandbox/disabled-delivery endpoint
- variable: `FIREBASE_HOSTING_URL` containing the stable TEST HTTPS URL
- variable: `FIREBASE_STORAGE_ENABLED` matching the TEST service state

TEST must permit the automatic `main` deployment. If deployment-branch restrictions are enabled, account for the PR-preview job as well or use a separate non-production preview environment with the same isolation guarantees.

### `production`

Protect this environment with required human reviewer approval and restrict deployment branches to `main` where supported. Production values must never be copied into the `test` environment or repository-level normal-CI secrets.

Use separate least-privilege credentials for separate production purposes. Do not reuse the deployment credential for maintenance, audit or backup work:

- `FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION` — manual Firebase Hosting/Rules release only.
- `FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION_OPERATIONS` — explicitly confirmed manual operational mutations such as approved rebuilds/equipment seed only.
- `FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION_AUDIT` — manual read-only production integrity/provenance audit only.
- `FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION_BACKUP` — scheduled/manual Firestore export and backup-freshness access only.

The production deployment workflow also uses the same public Firebase variable names listed for TEST, but every production value must belong to `coolock-ardlea-scouts`; `VITE_FIREBASE_PROJECT_ID` must equal that exact project ID.

The production workflow is deliberately one-click but remains manual. A maintainer starts `Firebase PRODUCTION Manual Deploy` with `workflow_dispatch` on `main`; no project ID or commit SHA is typed. The workflow pins the production project, checks out current `main`, resolves and records its exact SHA, proves the checkout still matches `origin/main`, requires successful protected CI evidence for that SHA, reruns security/unit/Rules checks, validates the service-account `project_id`, and only then deploys the reviewed Rules/indexes/Storage rules/Hosting bundle.

A green merge never triggers production deployment.

Normal PR/push Quality and Playwright workflows receive no production service-account credential and no production email-delivery configuration. Quality uses the local/demo Firebase identity; Playwright uses Firebase emulators and deterministic synthetic data.

## Firebase TEST project owner setup

Browser access is intentionally not assumed by this runbook. In Firebase Console, using the owner account:

1. Inspect `coolock-ardlea-scouts` first and make no production changes.
2. Create the separate Firebase project `coolock-ardlea-scouts-test` if the project ID is available. If Firebase/Google requires billing approval, stop for owner approval rather than enabling billing implicitly.
3. Enable the services the application actually uses: Authentication, Firestore, Storage when required, and Hosting.
4. Register a TEST web app and place its public web configuration directly into the GitHub `test` environment variables above.
5. Configure TEST Hosting and record its stable HTTPS URL in `FIREBASE_HOSTING_URL`.
6. Configure only the authentication providers required for representative TEST journeys. TEST users must be synthetic and independent of production Auth.
7. Add only TEST Hosting/preview hostnames required by those Auth providers to TEST authorised domains.
8. Configure a TEST-only email endpoint that cannot deliver as the live production sender. Do not point TEST at the production email worker/configuration.
9. Create a TEST-only deployment service account using the least privileges necessary for the reviewed Firebase deploy command. Store its credential only in the GitHub `test` environment secret.
10. Do not export or copy production Firestore, Storage, Auth or personal data into TEST.

## Production project invariants

The existing `coolock-ardlea-scouts` project remains authoritative production unless an owner inspection proves otherwise. SW-34 does not change its custom domain or data. The manual production workflow must not be invoked merely to test the workflow.

Before any approved release, confirm:

- target project resolves exactly to `coolock-ardlea-scouts`;
- production deployment service-account `project_id` is exactly `coolock-ardlea-scouts`;
- current `main` is the intended reviewed release and its exact SHA is recorded automatically;
- protected Quality and Playwright checks are successful for that SHA;
- Firestore and Storage Rules tests pass against emulators;
- production build contains `VITE_APP_ENV=production` and production-only public Firebase config;
- post-deployment checks are read-only.

Production maintenance credentials must be restricted to the resources/actions required for their documented purpose. Scheduled backup is a resilience control, not a deployment trigger; it must never gain Hosting/Rules release authority.

## Operational mutation policy

Operational scripts must never infer production from a default Firebase project. New or modified mutators must use `scripts/firebase-operation-guard.mjs` or equivalent fail-closed validation.

For scripts that support local automation, local writes require emulator hosts. TEST writes require the explicit TEST project and TEST-only credential. Production writes are unsupported by default; an approved production-capable script must explicitly opt in and require exact project confirmation plus `ALLOW_PRODUCTION_MUTATION=I_UNDERSTAND` and its script-specific confirmation/evidence.

Canonical synthetic seed data is TEST/local data. It must never contain real child, guardian, medical, consent or other personal data and must never be restored into production.

## Rollback

Do not roll back by force-pushing or bypassing the production environment. Restore or revert the desired known-good application state onto reviewed `main`, wait for the required Quality and Playwright checks to pass, then use the same manual production workflow. The workflow resolves and records that new reviewed `main` SHA automatically, preserving actor/SHA/target audit evidence and keeping rollback subject to the same deployment boundary as a forward release.

If rollback would require restoring Firestore data or another destructive production mutation, follow the separate backup/recovery procedure and obtain owner approval before mutation.

## SW-13 custom-domain dependency

Do not begin production custom-domain mutation until SW-34 is merged and proven: stable TEST deploy works, TEST Auth/data are isolated, and a merge to `main` does not deploy production.

For `coolockardleascouts.ie`, obtain DNS records from Firebase Hosting during the production-domain connection flow. Never invent or substitute records. Snapshot and preserve existing MX, SPF, DKIM, DMARC and other mail-related DNS records before changing web records. Configure deliberate apex/`www` canonical behaviour, wait for Firebase verification and managed TLS provisioning, then add the production hostname to production Firebase Auth authorised domains and review OAuth callbacks, CORS/API allow-lists, CSP, public/email links, sitemap, robots and canonical metadata.

Once the reviewed release is on `main` with required checks green, production still changes only when an authorised maintainer deliberately starts `Firebase PRODUCTION Manual Deploy` and any protected-environment approval is satisfied.
