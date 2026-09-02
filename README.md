# Coolock Ardlea Scouts Website

React + TypeScript web application for Coolock Ardlea Scouts, including the public website, joining flow, parent portal, leader/admin tools, events, consent, member management, role-based access and audit logging.

## Stack

- React 19 + TypeScript + Vite
- Material UI
- Firebase Authentication, Firestore and Hosting
- Playwright for end-to-end testing
- Node test runner for lightweight unit tests
- Firebase Emulator Suite for Firestore security-rule tests
- GitHub Actions for quality checks, previews, E2E tests, Firestore rule tests, scheduled Firestore backups and production hosting deploys

## Project structure

- `src/pages` — routed public, parent and leader/admin pages
- `src/components` — shared UI and authentication/route protection
- `src/services` — Firestore/domain access helpers
- `e2e` — Playwright journeys and role/permission coverage
- `tests/unit` — fast unit tests
- `tests/firestore` — emulator-backed Firestore rules tests
- `scripts` — deterministic test fixtures, validation and guarded operational scripts
- `docs` — testing, security, recovery and operations documentation
- `.github/workflows` — CI, preview, deployment, audit, backup and recovery workflows

## Local development

Requirements:

- Node.js 22
- npm
- Firebase project configuration values

Install dependencies:

```bash
npm ci
```

Create a local `.env` file containing the Firebase web configuration used by `src/firebase.ts`:

```text
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_EMAIL_API_URL=...
```

Do not commit real credentials or service-account JSON.

Start the development server:

```bash
npm run dev
```

## Quality and tests

Run the standard local quality gate:

```bash
npm run quality
```

This runs repository-wide linting, unit tests, policy/contract checks and the production build.

Individual commands include:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Playwright uses deterministic test identities and fixtures described in:

- `docs/playwright-testing.md`
- `docs/playwright-role-testing.md`

Production data must never be used as the source of truth for browser-test fixtures. Firestore security-rule tests run against the Firebase Emulator Suite and the production `firestore.rules` file.

## CI and deployment

Pull requests normally run the repository's merge-critical quality, browser, rules and Hosting-preview checks. Merges to `main` are deployed by the Firebase Hosting merge workflow, followed by exact-release post-deploy verification.

GitHub branch protection/ruleset enforcement is a repository-setting requirement, not something application code can replace. See `docs/stage-19-launch-readiness-review.md` and `docs/operations-runbook.md` before treating a release as production-ready.

## Test data and production provenance

Deterministic seed tooling exists to support automated testing. It is not a general production-data population mechanism, and there is no normal GitHub Actions workflow for seeding TEST fixtures into the live production database.

Production TEST-data cleanup is deliberately separate from normal CI and remains guarded by the Stage 18.16 process. Do not weaken provenance checks, relabel TEST records as legitimate data, or add an automated production purge merely to make an audit pass. Any approved cleanup must follow the documented dry-run, exact project/count/manifest confirmation and verified-backup safeguards from a trusted local environment.

See `docs/operations-runbook.md`, `docs/production-readiness.md` and `docs/stage-19-launch-readiness-review.md` for the current production boundary.

## Backup and recovery

The **Firestore Backup** workflow performs managed production exports and the backup-freshness workflow checks recency. Production restore remains a deliberate operation because imports can replace current documents.

The repository also contains a deterministic emulator recovery drill. That drill proves the repository's export/import verification path; it does not by itself prove managed cloud-import IAM or project/location compatibility. Setup, verification and recovery guidance are in `docs/firestore-backup-recovery.md`.

## Storage-backed attachments

Firebase Storage-backed gallery/receipt attachments are capability-gated. Under the current production configuration Storage is not considered available, so attachment readiness must not be claimed merely because a bucket value exists in client configuration. Do not move sensitive uploads into public Hosting as a workaround.

## Email

Email-related implementation/testing notes are kept in:

- `docs/email-branding.md`
- `docs/event-consent-email-testing.md`

The frontend email endpoint is configured through `VITE_EMAIL_API_URL`; provider credentials remain outside the browser.

## Security

Authorization is enforced in `firestore.rules`; UI checks are for usability and navigation and are not the security boundary. Emulator coverage verifies representative anonymous, section-scoped leader, parent/member, privilege-escalation, audit and default-deny rules.

The application handles child/member information and may contain consent, emergency-contact and medical data. Do not place sensitive values in URLs, general audit descriptions, analytics, client telemetry or unredacted logs.

## Operations

Before a production-affecting change:

- confirm the relevant CI gates are green;
- use the Firebase preview for UI changes;
- verify Firestore Rules tests for authorization changes;
- understand whether the change requires indexes, Rules deployment or a data compatibility audit;
- confirm a recent verified backup before destructive/high-risk production work;
- after deployment, require the post-deploy smoke to match the exact deployed commit;
- follow the rollback/recovery checklist in `docs/operations-runbook.md`.

Before a major launch, also complete the authenticated leader/parent and real-email smoke evidence listed in `docs/stage-19-launch-readiness-review.md`.

## Documentation

Start with `docs/operations-runbook.md` for administration and recovery, `docs/production-readiness.md` for the production-hardening baseline, and `docs/stage-19-launch-readiness-review.md` for the current launch blockers/evidence. More focused documentation under `docs/` should be updated alongside the feature or workflow it describes.
