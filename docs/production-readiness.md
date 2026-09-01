# Production readiness

## Stage 18.1 deployment integrity

The live Hosting workflow is the single authoritative production deployment. Before Hosting is published, it deploys Firestore rules and Firestore indexes as a fail-closed data-plane step. A failure stops the release; the site is never reported as successfully deployed while a required Firestore ruleset or index was skipped.

Firebase Storage is controlled by the repository variable `FIREBASE_STORAGE_ENABLED`. When it is `true`, Storage rules deployment and the live availability/security probe are strict release gates. When it is absent or false, workflows report Storage as explicitly unavailable and do not claim gallery or receipt-attachment readiness. The current production probe returned `404 Not Found`, so Storage remains disabled while the project retains its no-Blaze constraint; attachment storage requires a free-tier-compatible replacement before those features can be considered production-ready.

The separate Firebase Rules workflow is a validation gate only. It runs the Firestore and Storage emulator suites, but does not race the live workflow by deploying the same rules independently. `npm run check:firebase-deploy-config` enforces this ownership and coverage contract in every quality run.

When Storage is enabled, the post-deployment smoke gate checks that the configured bucket is reachable and that anonymous bucket listing is denied, alongside the existing Hosting, Firestore and email Worker checks.

## Stage 18.2 data-integrity audit

The live Firestore audit workflow is read-only. It may identify safe migrations, stale documents and compatibility blockers, but it must not apply repairs in the same run that discovers them. Every run uploads its available findings as a 30-day `firestore-integrity-dry-run-*` artifact. Any approved migration is run separately, followed by a fresh read-only audit.

`scripts/firestore-collection-contract.mjs` is the authoritative root-collection inventory shared by the compatibility and provenance audits. `npm run check:firestore-audit-coverage` compares that inventory with `firestore.rules`, requires both audits to consume it, and rejects mutating reconciliation commands in the audit workflow. This closes the gap where newer Adventure Skills, equipment, finance, programme library, parent gallery and settings collections were absent from older audit allowlists.

The compatibility pass also applies fixture-tested operational invariants to finance and equipment data. It rejects invalid whole-cent amounts and reconciliation arithmetic, unresolved transfer/reversal links, duplicate equipment options, impossible stock totals, malformed loans, unresolved incident/history item references and broken programme-equipment links. These checks report exact document paths and remain read-only.

This checklist captures the production-hardening baseline for the Coolock Ardlea Scouts website. Stage 8 is complete; future changes should preserve these controls and extend them when new functionality introduces new risk.

## Automated gates

The Quality workflow must pass before merge. It verifies:

- production npm dependencies have no known high/critical vulnerabilities reported by `npm audit`
- required Firebase and email-service environment variables are present
- `VITE_EMAIL_API_URL` is a valid HTTPS URL
- lint, unit tests, seed-contract checks, smoke-checker syntax and the production build pass
- Firebase Hosting still publishes `dist`, retains the SPA rewrite, preserves the baseline browser security/privacy headers, keeps `/index.html` non-cacheable and keeps hashed assets immutable for one year

The Hosting configuration contract is enforced by `npm run check:hosting-config` and is also part of `npm run quality`. This makes accidental weakening of the production Hosting baseline a merge-blocking regression instead of relying on manual review of `firebase.json`.

After a successful live Firebase Hosting deployment, the **Post-deploy smoke** workflow automatically verifies the deployed system rather than only the build artifact. It can also be run manually from GitHub Actions.

The live smoke check verifies:

- `/`, `/about`, `/join`, `/leader/login` and `/parent` return the SPA shell successfully
- the production response includes the expected CSP, clickjacking, MIME-sniffing, referrer and browser-permission protections
- `/index.html` remains non-cacheable
- a deployed Vite asset is reachable and has one-year immutable caching
- the production email Worker answers CORS preflight successfully
- the email Worker explicitly allows the live Firebase Hosting origin

## Stage 8 hardening baseline

Stage 8 established the following controls as the production baseline:

- Hosting security/privacy headers and cache behaviour are both statically checked and live-smoke verified.
- Audit-log writes are constrained so actor identity and audit categories cannot be freely forged by an authenticated client.
- Live Firestore provenance and compatibility audits cover non-meeting collections, Weekly Meetings and Meeting Records, with dedicated safe reconcilers for known legacy shapes.
- Pull-request live-data audits probe Firestore availability first; quota exhaustion or temporary unavailability can defer the PR-only live portion, while pushes to `main` and manual audits continue to fail closed.
- Canonical test seed data and explicit seed-contract checks remain the source of truth for Playwright and emulator-based regression coverage.
- Representative public, parent and leader routes have an accessibility resilience baseline covering semantic structure, primary headings, image alternatives, named interactive controls and keyboard focus entry.
- Route-level code splitting keeps authenticated leader features out of the initial public-site bundle until needed.
- A root React error boundary provides an accessible recovery screen instead of a blank application after unexpected render failures.
- Production dependency maintenance is continuous through a high/critical production vulnerability gate and recurring Dependabot updates.
- CI avoids exposing repository secrets to Dependabot code and skips only checks that cannot legitimately run without those secrets.
- Obsolete one-off CI automation and deprecated Java setup actions were removed/upgraded during Stage 8.
- Admin dashboard Firestore reads are constrained to active members and current/upcoming events instead of reading full historical collections.
- Firestore backup/export and documented recovery procedures are part of normal production operations.

## Hosting hardening

Firebase Hosting applies these headers to all responses:

- `Content-Security-Policy: base-uri 'self'; object-src 'none'; frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

The SPA shell (`/index.html`) is not cached so releases become visible immediately. Vite hashed assets under `/assets/**` are cached for one year with `immutable`.

The CSP is intentionally limited to directives that do not constrain Firebase network/auth endpoints. A stricter script/connect CSP should only be introduced after validating all authentication, Firestore and email flows in a production-like environment.

## Pre-release verification

Before treating a release as production-ready:

1. Confirm Quality, Firestore Rules, Firebase Hosting preview and Playwright workflows are green.
2. Confirm the live Firestore provenance/compatibility audit is green when production Firestore is available; do not treat a PR-only quota deferral as a substitute for the required `main`/manual production audit.
3. Exercise leader, admin and parent authentication on the Firebase preview.
4. Verify an ordinary leader cannot read or act on another section's members.
5. Verify parent access exposes only linked member records.
6. Verify event consent links, parent communications and email delivery use the intended production email Worker.
7. Confirm the email Worker has the current `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, `FIREBASE_PROJECT_ID` and `ALLOWED_ORIGINS` configuration.
8. Confirm Firestore backups are running and a recent backup exists before a major release or data migration.
9. After production deploy, require the Post-deploy smoke workflow to pass, then perform one authenticated leader/parent and real email-delivery smoke test before a major launch.

## Running the live smoke check manually

Set `SITE_URL` and `EMAIL_API_URL`, then run `npm run smoke:live`. Both values must be HTTPS URLs. The GitHub workflow uses `https://coolock-ardlea-scouts.web.app` for the production site and the existing `VITE_EMAIL_API_URL` repository secret for the Worker.

## Backup and recovery

Managed Firestore export/backup operations and recovery instructions are documented in `docs/firestore-backup-recovery.md`. Confirm a recent successful backup before destructive migrations or other high-risk production changes, and follow the runbook rather than improvising a restore.

## Read/quota discipline

Prefer server-side counts and Firestore query constraints over loading full collections and filtering them in the browser. The leader overview already uses a short-lived cache, server-side count queries, active-member filtering and current/upcoming-event filtering. New dashboards and reports should follow the same pattern and avoid adding live-data CI reads without a clear production-integrity reason.

## Sensitive-data boundary

Do not put medical information, consent answers, emergency-contact details or message bodies into analytics, general audit descriptions, URLs or client-side error reporting. Operational exports and communication recipient lists should remain constrained by Firestore section permissions.

## Ongoing maintenance

Stage 8 being complete does not mean hardening stops. New features should preserve or extend the established baseline for security, privacy, accessibility, data compatibility, stable test seeds, dependency maintenance, recovery, quota efficiency and regression coverage. If a future change weakens one of these controls, that should be treated as a production-readiness regression rather than normal feature drift.
