# Stage 23.8 — Guarded production TEST-data cleanup readiness

## Scope

This stage revalidates the guarded production TEST-data cleanup introduced in Stage 18.16 against the current Stage 23 repository state. It does not delete, relabel, repair or otherwise mutate production data.

Actual production TEST-data deletion remains parked until it is explicitly resumed from a trusted administrator environment using the guarded process below.

## Current-state findings

The existing cleanup design remains valid after the later schema and product changes:

- `scripts/purge-test-data.mjs` is still read-only unless `--execute` is supplied.
- A destructive run still fails closed unless the exact production project, Firestore candidate count, Auth candidate count and SHA-256 target manifest all match the reviewed dry run.
- A reviewed Firestore backup URI and a verification timestamp no more than 192 hours old are still mandatory before execution.
- `scripts/purge-test-data.mjs` and `scripts/inventory-live-test-data.mjs` still share `classifyTestDocument` from `scripts/test-data-detection.mjs`, so the reviewed inventory and the guarded purge use the same narrow target definition.
- Both scripts use Firestore `listCollections()` at runtime. They therefore discover the current root collection set dynamically rather than depending on the older Stage 18 collection list.
- The detector remains intentionally narrow: stable `TEST_` identifiers/references and explicit canonical seed markers. Names or email addresses containing the word “test” are not deletion criteria.
- Current Playwright persistence fixtures remain explicitly marked with `testData: true`, `testSeed: "playwright-persistence-v1"` and `createdBySeed: "TEST_SEED"`. The Stage 23 schema expansion therefore does not require broadening the purge detector merely to recognise current deterministic E2E records.
- The production-credential workflow guard still forbids production workflows from invoking `scripts/purge-test-data.mjs`; no production purge GitHub Actions workflow is introduced.

No evidence-backed safety or schema gap was found that justifies changing the purge target semantics while deletion is parked. Broadening the detector without a concrete missed-record case would increase destructive risk and is deliberately avoided.

## Guarded procedure when cleanup is explicitly resumed

1. Verify a fresh production Firestore backup and record the exact `gs://.../firestore-backups/...` URI plus verification timestamp.
2. In a trusted administrator environment, provide the production service-account JSON and run `node scripts/purge-test-data.mjs` without `--execute`.
3. Review every Firestore path and Firebase Auth UID printed by that dry run.
4. Copy the exact Firestore count, Auth count and manifest SHA-256 from the same reviewed run.
5. Execute only with `--execute` and every `PROD_PURGE_*` confirmation variable set to those exact reviewed values.
6. Abort if any count, manifest, project or backup gate differs. Do not compensate for drift by weakening provenance rules or relabelling historical data.
7. Immediately rerun the read-only Firestore Data Provenance Audit after any eventual cleanup.

## Explicitly prohibited in Stage 23.8

- deleting any production TEST record or Firebase Auth user;
- weakening the provenance audit to make historical TEST data appear legitimate;
- adding display-name or email-based deletion heuristics;
- creating a GitHub Actions production purge workflow;
- bypassing the manifest/count/project/backup execution gates.

## Validation contract

Unit coverage now reasserts that inventory and purge share the same detector, dynamically enumerate the live root schema, retain all destructive execution gates, keep current Playwright persistence fixtures explicitly marked, and preserve the production-workflow credential boundary.

Quality and Playwright remain required PR gates before this revalidation can merge.
