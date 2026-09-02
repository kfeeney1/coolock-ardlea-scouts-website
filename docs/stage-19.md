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

`check-live-build-info.mjs` validates that `/build-info.json` is reachable and structurally valid, rejects unexpectedly future build times, requires CI provenance for workflow-run production smoke, and requires the deployed commit to match the successful Hosting workflow commit exactly.

The check is read-only and requires no Firebase Admin credential.

## Stage 19.2 — Super-admin operational health

The authenticated admin dashboard includes an operational-health panel only for the canonical `super-admin` system role. It reports non-sensitive deployed-release evidence and capability configuration without reading production collections, enumerating users or exposing credentials.

## Stage 19.3 — Recovery rehearsal evidence

The Firestore Recovery Drill uses only the dedicated `demo-coolock-ardlea-recovery` project identifier and local Firestore Emulator. It seeds deterministic synthetic fixtures, exports them, imports into a fresh emulator process and verifies exact restored contents.

This proves the repository recovery-verification path but deliberately does not claim to prove cloud IAM, managed Firestore import permissions or project/location compatibility. A real managed non-production restore remains follow-up evidence when a suitable project is available.

## Stage 19.4 — Data retention and privacy lifecycle

`scripts/data-retention-contract.mjs` gives every canonical root collection an explicit sensitivity and non-destructive lifecycle disposition. Medical/consent data requires manual review; section transfers are not deletion events; member history, Adventure Skills, audit, finance and equipment history are excluded from generic automatic cleanup.

Detailed policy is in `docs/data-retention-lifecycle.md`.

## Stage 19.5 — Export and offboarding safeguards

Operational exports have an explicit governance contract. Parent offboarding distinguishes rejection from revocation, clears active member/section access when revoking an approved parent, and preserves historical records. Firebase Auth users and member history are not automatically deleted.

Detailed boundaries are in `docs/export-offboarding-governance.md`.

## Stage 19.6 — Reporting and read-budget protection

`scripts/reporting-read-budget.mjs` protects the leader overview, Reports & Exports and Section Floats read architecture. It preserves aggregate counts, the overview cache, bounded section fan-out and reuse of already-authorized snapshots for filtering/exporting without introducing arbitrary report truncation.

Detailed rationale is in `docs/reporting-read-budgets.md`.

## Stage 19.7 — Launch-readiness review

The final review is recorded in `docs/stage-19-launch-readiness-review.md`.

The result is deliberately split into two states:

- **Stage 19 engineering controls:** complete once the review is merged.
- **Production launch-ready:** not yet declared, because operational/repository-setting evidence remains outstanding.

The principal launch blockers are GitHub merge governance and the deliberately parked production TEST-data cleanup. GitHub currently reports `main` as unprotected with no active/evaluating repository ruleset, so merge-critical CI is not yet repository-enforced. The TEST-data cleanup must continue to use the guarded Stage 18.16 local process rather than weakening provenance or adding a CI purge.

Production Storage also remains explicitly unavailable under the current no-Blaze constraint, so gallery/receipt attachment readiness must not be claimed. This is capability-gated rather than a reason to weaken file security.

Before a major launch, retain green release checks, enable and verify branch protection/ruleset enforcement, complete the guarded TEST-data cleanup and production audit, require exact-commit post-deploy smoke, perform ordinary-leader and parent authenticated smoke checks, perform a real email-delivery smoke, and confirm a recent verified backup.

The full scorecard, blocker rationale and release-evidence checklist are in `docs/stage-19-launch-readiness-review.md`.