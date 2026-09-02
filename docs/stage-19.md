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
