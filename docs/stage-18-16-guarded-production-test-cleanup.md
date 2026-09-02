# Stage 18.16 — Guarded production TEST-data cleanup

Stage 18.13 identified the remaining synthetic records in live Firebase without modifying them. The latest audit after Stage 18.15 reports 165 Firestore TEST-data candidates and 40 Firebase Auth users whose UID begins with `TEST_`; all compatibility checks pass and the only failing gate is the two legacy leadership projections that have TEST IDs without canonical provenance markers.

This stage hardens the existing `scripts/purge-test-data.mjs` so it cannot delete anything by default. Running the script without `--execute` is now a read-only inventory. It prints the exact Firestore paths, Auth UIDs, counts and a SHA-256 digest over the reviewed target manifest.

A destructive run requires every one of these independent gates to match the live inventory at execution time:

- `--execute` is present.
- `PROD_PURGE_CONFIRM_PROJECT` exactly matches the service account `project_id`.
- `PROD_PURGE_EXPECTED_FIRESTORE_COUNT` exactly matches the current candidate count.
- `PROD_PURGE_EXPECTED_AUTH_COUNT` exactly matches the current TEST_ Auth-user count.
- `PROD_PURGE_EXPECTED_MANIFEST_SHA256` exactly matches the current manifest digest.
- `PROD_PURGE_BACKUP_URI` points to the reviewed `gs://.../firestore-backups/...` export.
- `PROD_PURGE_BACKUP_VERIFIED_AT` is a valid ISO timestamp no more than 192 hours old.

If any target changes between review and execution, the manifest hash or counts change and the script refuses the deletion.

## Production procedure

1. Run the Firestore backup/freshness controls and record the exact verified backup URI and verification time. Do not proceed if the backup cannot be verified.
2. In a trusted administrator environment, provide the production service-account JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` and run `node scripts/purge-test-data.mjs` without `--execute`.
3. Review every printed Firestore path and Auth UID. The current expected scope is synthetic TEST records only; names or email addresses are never used to select records.
4. Copy the exact counts and manifest SHA-256 from that same dry run into the confirmation variables listed above, set the reviewed backup URI/time, and rerun with `--execute`.
5. Immediately rerun Firestore Data Provenance Audit. Expected post-condition: zero Firestore TEST candidates, zero TEST_ Auth users, and the provenance failure for the legacy Beavers assistant section leader projections disappears.

## Deliberate CI boundary

There is intentionally no GitHub Actions production purge workflow. Stage 18.12 prevents production credentials from being combined with TEST-data mutation scripts. This cleanup remains an explicit trusted-administrator operation rather than reintroducing a generic live seeding/purge path.

The script only uses the shared narrow detector in `scripts/test-data-detection.mjs`: stable TEST IDs/references and explicit seed markers. It does not classify or delete records because a display name or email happens to contain the word “test”.
