# Stage 19 — Operational confidence and lifecycle governance

Stage 18 established the production-hardening baseline. Stage 19 builds on that baseline without weakening provenance, RBAC, emulator-backed testing, deterministic seed data, or the production credential boundary.

The production TEST-data cleanup remains deliberately parked. It is not a Stage 19 dependency and must only be resumed through the guarded dry-run, exact manifest/count confirmation and verified-backup process introduced in Stage 18.16. Stage 19 must not add a production purge workflow or redefine historical TEST records as legitimate to make provenance checks pass.

## Planned sequence

1. **19.1 — Deployed release evidence.** Verify that the live Hosting release exposes valid build metadata and, after a successful production deploy, that the deployed commit exactly matches the workflow-run commit.
2. **19.2 — Operational health/status.** Give super-admins a safe operational view of non-sensitive capability and service status without exposing credentials or sensitive member data.
3. **19.3 — Recovery rehearsal evidence.** Turn the documented restore procedure into a repeatable non-production restore drill with recorded verification.
4. **19.4 — Data-retention and privacy lifecycle.** Define and enforce deliberate retention/archive/delete boundaries for high-risk data domains before adding destructive automation.
5. **19.5 — Export and offboarding safeguards.** Make operational exports and account/member offboarding explicit, permission-scoped and auditable.
6. **19.6 — Reporting/read-budget protection.** Add regression budgets around expensive reports and dashboards so production-read discipline does not erode as features grow.
7. **19.7 — Launch-readiness review.** Re-run the architecture, security, accessibility, recovery and production-readiness review against the completed Stage 19 controls.

## Stage 19.1 — Deployed release evidence

The build already emits `dist/build-info.json`, while the existing live smoke checks the SPA shell build fingerprint. Stage 19.1 makes the JSON build artifact an independently verified release-evidence surface.

`check-live-build-info.mjs` validates that:

- `/build-info.json` is reachable and valid JSON;
- `commit`, `buildTime` and `source` are structurally valid;
- the build time is not unexpectedly in the future;
- a workflow-run production smoke requires `source: github-actions`;
- the deployed commit exactly matches `github.event.workflow_run.head_sha` after a successful production Hosting deployment.

The check is intentionally read-only and requires no Firebase Admin credential. Pull-request smoke executions validate the shape of the currently deployed evidence without claiming that production already contains the unmerged PR build.

Unit tests cover valid evidence, SHA drift, malformed timestamps, future timestamps and non-CI evidence when an expected production SHA is supplied.

## Stage 19.2 — Super-admin operational health

The authenticated admin dashboard now includes an operational-health panel only when the canonical leader profile has system role `super-admin`.

The panel is deliberately narrow and non-sensitive. It reports:

- deployed release evidence from the same `/build-info.json` surface protected by Stage 19.1;
- the fixed production Firestore project identity;
- whether an HTTPS email-service endpoint is configured in the client build;
- whether a Firebase Storage bucket is configured, while explicitly avoiding a claim that Storage is live merely because a bucket name exists.

The panel does not read production collections, enumerate users, expose Firebase API credentials or service-account material, or introduce a privileged backend endpoint. Ordinary admins and leaders do not render the panel. Runtime Firestore authorisation remains unchanged because this UI is operational visibility only, not a new access-control boundary.

Operational-health classification is unit-tested so invalid release evidence and missing capability configuration fail into warning/unavailable states rather than being presented as healthy.

## Stage 19.3 — Recovery rehearsal evidence

The repository now includes a repeatable Firestore recovery rehearsal that is isolated from production by construction.

The **Firestore Recovery Drill** workflow:

- uses the dedicated `demo-coolock-ardlea-recovery` project identifier and the local Firestore Emulator only;
- seeds a small deterministic set of synthetic member/event/parent-link fixtures;
- exports that emulator state with the Firebase emulator export mechanism;
- starts a fresh emulator process, imports the export and verifies the exact fixture count and contents;
- records the commit, fixture count, deterministic manifest SHA-256 and verification timestamp in the GitHub Actions job summary;
- runs when the drill implementation changes, can be run manually, and is rehearsed monthly.

The drill harness refuses the production project ID and any non-local Firestore host. It uses no production credentials, does not read production data, and does not upload database exports as workflow artifacts.

This rehearsal proves that the repository's deterministic recovery verification path can export, restore and compare Firestore state. It deliberately does **not** claim to prove production Cloud Storage IAM, managed Firestore import permissions or cross-project/location compatibility. Those remain part of a real non-production managed-import exercise when a suitable test Firebase project is available.

## Stage 19.4 — Data retention and privacy lifecycle

The repository now has a machine-readable retention contract for every canonical Firestore root collection.

`scripts/data-retention-contract.mjs` classifies each root collection by data sensitivity, lifecycle disposition, review trigger and rationale. The contract deliberately supports only four non-destructive dispositions: manual review before deletion, no routine deletion, source-projection lifecycle and configuration lifecycle. It contains no age-based or automatic-delete policy.

Unit tests compare the retention contract with `scripts/firestore-collection-contract.mjs`, so any new root collection must receive an explicit lifecycle decision as part of the same change. The checks also reject duplicate/unknown collections, invalid classifications and projections that do not identify a canonical source.

High-risk boundaries are explicit:

- medical and consent data requires manual purpose/retention review before any destructive tooling;
- member status changes and section transfers are not deletion events;
- member lifecycle history and Adventure Skills progress remain persistent history;
- parent/member unlinking is deferred to the explicit Stage 19.5 offboarding workflow;
- audit, finance and equipment histories are excluded from generic age-based cleanup;
- public and parent-safe projections follow their canonical source lifecycle.

No Firestore Rules, production data, production credentials or CI mutation paths are changed by Stage 19.4. The parked production TEST-data cleanup remains separate and unchanged.

Detailed policy and follow-on requirements are documented in `docs/data-retention-lifecycle.md`.

## Stage 19.5 — Export and offboarding safeguards

Operational exports now have an explicit governance contract describing their permitted scope, sensitivity and privacy exclusions. Existing leader reports remain permission-scoped and audited; Stage 19.5 does not add a general database dump or a medical-data export.

Parent offboarding now distinguishes a rejected registration request from access that was previously granted and later revoked. Revocation clears the parent account's linked member IDs and section access while preserving the account and historical records. Firebase Auth users, member history and Adventure Skills progress are not automatically deleted.

Detailed boundaries are documented in `docs/export-offboarding-governance.md`.

## Stage 19.6 — Reporting and read-budget protection

`scripts/reporting-read-budget.mjs` defines regression budgets for the three highest-value operational read surfaces: the leader overview, Reports & Exports, and Section Floats reporting.

The contract protects the current architecture rather than inventing a fixed billed-read number:

- the leader overview must retain its 90-second scope cache and Firestore aggregate queries for count-only cards;
- new section-fanned dashboard collections require an explicit budget review;
- Reports & Exports is limited to the existing member/event initial snapshot and event exports must reuse the cached member rows rather than re-querying Firestore;
- Section Floats reporting remains two section-scoped query families per permitted section, with filtering and export performed over the loaded snapshot rather than causing extra Firestore reads.

Unit coverage validates both the machine-readable budgets and the source-level architecture assumptions. This means a future feature that casually adds another report query, removes the overview cache, replaces aggregate counts with document scans, or re-reads members during export will fail Quality until the read cost is deliberately reviewed.

The budget is expressed primarily in query operations/fan-out because actual Firestore document reads depend on matching dataset size. Stage 19.6 deliberately does not add arbitrary report limits that could silently omit operational records. No production data, production credentials, telemetry or Rules changes are introduced.

Detailed rationale and review guidance are in `docs/reporting-read-budgets.md`.
