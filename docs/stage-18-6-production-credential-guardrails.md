# Stage 18.6 — Production credential guardrails

Stage 18.6 reduces the amount of pull-request code that can execute with live Firebase credentials and makes transient CI tooling deterministic.

## Findings

The workflow review found four pull-request paths that could execute repository-controlled Node scripts while a production Firebase Admin service-account credential was present:

- `parent-account-data-repair.yml` was a one-off compatibility repair tied to an old branch name.
- `test-data-reset-pr89.yml` was a one-off full live test-data reset tied to an old branch name.
- `seed-account-drift.yml` ran a live account audit automatically for selected pull requests.
- `playwright-e2e.yml` passed the production service-account secret into deterministic seed scripts even though those scripts were targeting local Firestore/Auth/Storage emulators.

The first two workflows duplicated newer manual maintenance paths and have been removed. The seed-account drift audit remains available, but is now manual-only. Playwright still exercises the same emulator seed and re-seed path, but it now creates a fresh, unregistered emulator-only service-account-shaped credential on the runner instead of receiving the production Firebase service account.

## Credential boundary

Production Firebase Admin scripts must not run from `pull_request` workflows. Live audit, seed, repair and projection-maintenance work is triggered explicitly instead of allowing PR branch code to receive the Admin SDK credential.

Playwright is deliberately different: its Admin SDK scripts are pointed exclusively at the local Firestore and Auth emulators. Some existing seed scripts initialise Firebase Admin through `cert()`, so the workflow generates a new RSA key and service-account-shaped JSON for each run. That key is not stored in GitHub, is not registered with Google IAM, has no production authority and exists only for the lifetime of the CI runner.

The Firebase Hosting preview is the narrow production-credential exception. It remains pull-request-triggered because it deploys an isolated Hosting preview channel, but:

- it runs only for branches from this repository;
- repository build/quality commands do not receive the Firebase service-account JSON;
- the credential is passed only to the immutable-SHA-pinned Firebase Hosting action through its `firebaseServiceAccount` input.

## Canonical secret

All repository workflows that genuinely need the production service account use the single secret name:

`FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS`

The older generic `FIREBASE_SERVICE_ACCOUNT_JSON` GitHub secret reference is rejected by the quality gate. Scripts may still receive credentials through the `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable; in Playwright that value is generated locally for emulator use rather than sourced from GitHub Secrets.

## Transient npm tooling

Workflow-only package installs bypass the application lockfile, so every package installed with `npm install` in a workflow must carry an exact version. Firebase Admin is pinned to `14.3.0`, Firebase CLI to `15.28.1`, and the Playwright runner to `1.62.1` in the E2E workflow. The Firebase Rules workflow retains its existing exact versions for Rules Unit Testing and Firebase CLI tooling.

## Automated contract

`npm run check:workflow-production-credentials` scans every workflow and fails when:

- a pull-request workflow exposes the Firebase Admin credential to repository code;
- a pull-request workflow other than the guarded Hosting preview references the production service account;
- the Hosting preview loses its same-repository guard or dedicated action input;
- a legacy Firebase service-account GitHub secret name is reintroduced;
- a transient `npm install` package is not pinned to an exact version;
- the repository unexpectedly has no production credential workflows left, which would make the check meaningless.

The contract runs as part of `npm run quality` alongside the Stage 18.4 permission guard and Stage 18.5 immutable action-pinning guard.
