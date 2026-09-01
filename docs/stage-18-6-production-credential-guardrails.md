# Stage 18.6 — Production credential guardrails

Stage 18.6 reduces the amount of pull-request code that can execute with live Firebase credentials and makes transient CI tooling deterministic.

## Findings

The workflow review found three legacy pull-request paths that could execute repository-controlled Node scripts while a production Firebase Admin service-account credential was present:

- `parent-account-data-repair.yml` was a one-off compatibility repair tied to an old branch name.
- `test-data-reset-pr89.yml` was a one-off full live test-data reset tied to an old branch name.
- `seed-account-drift.yml` ran a live account audit automatically for selected pull requests.

The first two workflows duplicated newer manual maintenance paths and have been removed. The seed-account drift audit remains available, but is now manual-only.

## Credential boundary

Production Firebase Admin scripts must not run from `pull_request` workflows. Live audit, seed, repair and projection-maintenance work is triggered explicitly instead of allowing PR branch code to receive the Admin SDK credential.

The Firebase Hosting preview is the narrow exception. It remains pull-request-triggered because it deploys an isolated Hosting preview channel, but:

- it runs only for branches from this repository;
- repository build/quality commands do not receive the Firebase service-account JSON;
- the credential is passed only to the immutable-SHA-pinned Firebase Hosting action through its `firebaseServiceAccount` input.

## Canonical secret

All repository workflows use the single production service-account secret name:

`FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS`

The older generic `FIREBASE_SERVICE_ACCOUNT_JSON` GitHub secret reference is rejected by the quality gate. Scripts may still receive the credential through the `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable; only the GitHub secret source is standardised.

## Transient npm tooling

Workflow-only package installs bypass the application lockfile, so every package installed with `npm install` in a workflow must carry an exact version. Firebase Admin is currently pinned to `14.3.0`, while the Firebase Rules workflow retains its existing exact versions for Rules Unit Testing and Firebase CLI tooling.

## Automated contract

`npm run check:workflow-production-credentials` scans every workflow and fails when:

- a pull-request workflow exposes the Firebase Admin credential to repository code;
- a pull-request workflow other than the guarded Hosting preview references the production service account;
- the Hosting preview loses its same-repository guard or dedicated action input;
- a legacy Firebase service-account GitHub secret name is reintroduced;
- a transient `npm install` package is not pinned to an exact version;
- the repository unexpectedly has no production credential workflows left, which would make the check meaningless.

The contract runs as part of `npm run quality` alongside the Stage 18.4 permission guard and Stage 18.5 immutable action-pinning guard.
