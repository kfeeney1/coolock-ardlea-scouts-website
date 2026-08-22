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
- `scripts` — test-data and operational scripts
- `docs` — testing, email and operations documentation
- `.github/workflows` — CI, preview, deploy, seed, backup and security-rule workflows

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

This runs repository-wide linting, unit tests and the production build.

Individual commands:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Playwright requires the test identities/data described in:

- `docs/playwright-testing.md`
- `docs/playwright-role-testing.md`

Firestore security-rule tests run against the Firebase emulator and the production `firestore.rules` file. CI runs them through `.github/workflows/firestore-rules.yml`.

## CI and deployment

Pull requests normally run:

1. **Quality** — lint, unit tests and production build.
2. **Playwright E2E** — authenticated/public browser journeys.
3. **Firebase Hosting preview** — preview deployment after the quality gate.
4. **Firestore Rules** — when rules, emulator config or rules tests change.

Merges to `main` are deployed by the Firebase Hosting merge workflow.

Operational procedures, test-data seeding, recovery checks and deployment guidance are documented in `docs/operations-runbook.md`.

## Test data

The repository includes deterministic Firebase seed/cleanup scripts and a manual GitHub Actions workflow named **Seed Firebase Test Data**. Test data is marked so cleanup routines can avoid deleting ordinary records.

Use seed/cleanup actions only against the intended Firebase project and review the workflow inputs before running them. See `docs/operations-runbook.md` for the procedure.

## Backup and recovery

The **Firestore Backup** workflow performs a managed export of the production `(default)` Firestore database every Sunday and can also be run manually with an explicit production-project confirmation. It requires the `FIRESTORE_BACKUP_BUCKET` repository variable to be configured before it can succeed.

Production restore remains a deliberate manual operation because imports can overwrite current documents. Setup, first-run verification, retention guidance and the recovery procedure are documented in `docs/firestore-backup-recovery.md`.

## Email

Email-related implementation/testing notes are kept in:

- `docs/email-branding.md`
- `docs/event-consent-email-testing.md`

The frontend email endpoint is configured through `VITE_EMAIL_API_URL`.

## Security

Authorization is enforced both in the UI and in `firestore.rules`. The emulator test suite verifies key boundaries including anonymous access denial, section-scoped leader access, parent/child linking, privilege escalation protection, append-only audit records and default-deny behaviour.

Changes to authentication, Firestore rules, public write flows or sensitive member/parent data should include corresponding automated coverage.

## Operations

Before a production-affecting change:

- confirm CI is green;
- use the Firebase preview for UI changes;
- verify Firestore rules tests for authorization changes;
- understand whether the change requires seed data, indexes or rules deployment;
- run and verify a fresh backup before significant/destructive production data changes;
- follow the rollback/recovery checklist in `docs/operations-runbook.md`.

## Documentation

Start with `docs/operations-runbook.md` for administration and recovery. Use `docs/firestore-backup-recovery.md` for Firestore backup setup and restore guidance. More focused documentation lives under `docs/` and should be updated alongside the feature or workflow it describes.
