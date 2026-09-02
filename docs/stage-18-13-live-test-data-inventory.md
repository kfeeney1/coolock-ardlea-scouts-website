# Stage 18.13 — Live TEST-data inventory

Stage 18.12 removed the GitHub Actions path that could seed or purge canonical TEST fixtures against production. It deliberately did not delete any existing production records.

Stage 18.13 adds a read-only inventory so remaining production TEST data can be identified before any cleanup is considered.

## What changes

- `scripts/test-data-detection.mjs` is the single detector for marked and legacy TEST records.
- `scripts/inventory-live-test-data.mjs` scans Firestore root collections plus Firebase Auth without writing or deleting anything.
- The manual `Firestore Data Provenance Audit` now stores `00-test-data-inventory.txt` in its existing private dry-run artifact.
- `scripts/purge-test-data.mjs` uses the same detector, so any future trusted-admin cleanup targets the exact same Firestore candidate set that was reviewed in the inventory.
- Unit and repository quality checks prevent broad name/email matching and prevent the read-only audit workflow from invoking the purge script.

## Safety boundary

The inventory reports only Firestore document paths, detection reasons, collection counts and `TEST_` Firebase Auth UIDs. It does not print record payloads, names, emails, medical information or contact details.

The workflow remains manual and read-only. It does **not** restore a production purge workflow and does not delete live data.

Any later production cleanup must be a separate, explicitly reviewed operation performed only after a fresh verified backup and review of the inventory output. Cleanup must continue to ignore ordinary records that merely contain words such as `Test` in names or email addresses.
