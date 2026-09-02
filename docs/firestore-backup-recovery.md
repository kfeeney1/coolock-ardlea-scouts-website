# Firestore Backup and Recovery

This document describes the production Firestore export workflow and the manual recovery procedure for the Coolock Ardlea Scouts website.

## Purpose

Git history and Firebase Hosting releases do not contain Firestore data. A code rollback cannot undo incorrect writes, deletions or bulk data changes. The repository therefore includes a guarded Firestore export workflow that writes managed Firestore exports to Cloud Storage.

The workflow is intentionally export-only. Restoring data can overwrite existing documents, so production imports remain a deliberate manual operation rather than a one-click GitHub Action.

## Backup workflow

Workflow: **Firestore Backup** (`.github/workflows/firestore-backup.yml`).

It runs:

- automatically every Sunday at 03:17 UTC;
- manually through `workflow_dispatch` when an operator types the production project ID exactly.

Each successful run exports the `(default)` Firestore database to:

```text
<FIRESTORE_BACKUP_BUCKET>/firestore-backups/<UTC timestamp>
```

The workflow waits for the managed export to complete, verifies that files exist at the destination, and records the export URI in the GitHub Actions job summary.

## One-time setup

The backup workflow will fail safely until the destination is configured.

1. Create a Google Cloud Storage bucket suitable for Firestore managed exports. Keep it in the same project where practical and in a location compatible with/near the Firestore database.
2. Confirm billing is enabled for the Firebase/Google Cloud project because managed Firestore export/import requires billing.
3. Add a GitHub repository variable named `FIRESTORE_BACKUP_BUCKET` containing a `gs://` URI, for example:

   ```text
   gs://example-firestore-backups
   ```

4. Confirm the GitHub secret `FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS` represents the intended production service account.
5. Ensure the service account that starts the export has permission to run Firestore export operations. `Cloud Datastore Import Export Admin` (`roles/datastore.importExportAdmin`) is the narrow predefined role intended for this purpose.
6. Confirm the Firestore service agent can write to the selected Cloud Storage bucket. Same-project buckets are normally accessible to the Firestore service agent by default; cross-project buckets require explicit bucket access.
7. Configure a Cloud Storage lifecycle/retention policy appropriate to the group's recovery needs and budget. Do not depend on manual deletion as the retention policy.

Prefer a dedicated backup bucket rather than a bucket also used for public application assets.

## First-run verification

After setup:

1. Open **Actions → Firestore Backup → Run workflow**.
2. Enter exactly:

   ```text
   coolock-ardlea-scouts
   ```

3. Add a note such as `Initial backup verification`.
4. Run the workflow.
5. Confirm the workflow summary shows the expected project and a timestamped `gs://` destination.
6. Confirm the destination contains the Firestore export metadata/files.
7. Record the first verified backup date in operational notes.

If project confirmation, bucket configuration, active gcloud project, authentication, export permissions or bucket access do not match expectations, the workflow stops without attempting an export.

## Before risky data operations

Before a bulk migration, cleanup, import or repair against production:

1. Run a fresh manual Firestore backup.
2. Confirm it completed successfully and record the exact export URI.
3. Confirm the proposed operation's affected collections/documents.
4. Prefer reversible or additive changes over destructive rewrites.
5. Do not proceed if the backup cannot be verified.

## Recovery principles

A Firestore import is not a Git-style rollback. Importing data can overwrite documents that currently exist and can coexist with documents that were created after the export. Decide the recovery scope before importing.

For an incident:

1. Stop the code path, script or operator action causing further bad writes.
2. Identify the approximate incident start/end time and affected collections/documents.
3. Select the last verified export before the incident.
4. Decide whether targeted manual repair is safer than a broad import.
5. If a broad import is required, communicate a maintenance window and stop application/admin writes where practical.
6. Perform the import from a trusted administrator environment (for example Google Cloud Shell), not from an unreviewed local machine.
7. Verify the result before reopening normal write operations.
8. Document exactly which backup was used and any records manually repaired afterward.

## Manual import procedure

Only use this after reviewing the incident scope. Replace the placeholder with the exact `outputUriPrefix` from a completed export.

First verify the active project:

```bash
gcloud config set project coolock-ardlea-scouts
gcloud config get-value project
```

Then start the import:

```bash
gcloud firestore import gs://BUCKET/firestore-backups/EXPORT_PREFIX \
  --project=coolock-ardlea-scouts \
  --database="(default)"
```

The import URI must be the output URI of a completed Firestore export. Do not guess or construct an import path from memory.

After import:

1. Check the Firestore operation completed successfully.
2. Verify representative members, events, parent links, leader/admin access and consent records.
3. Run appropriate application smoke tests.
4. Check audit/operational records for any manual repairs still required.

## Testing recovery safely

A backup process is not considered fully proven until restore has been tested outside production.

### Automated emulator rehearsal

Workflow: **Firestore Recovery Drill** (`.github/workflows/firestore-recovery-drill.yml`).

The automated drill uses only the local Firestore Emulator with project ID `demo-coolock-ardlea-recovery`. It deliberately uses synthetic fixtures rather than the normal Playwright seed or any production export.

The drill performs two separate emulator runs:

1. seed and verify the deterministic synthetic recovery manifest;
2. export the emulator state to a temporary runner directory;
3. start a fresh emulator and import that export;
4. verify the exact recovered fixture set;
5. record the commit, fixture count, manifest SHA-256 and verification time in the Actions job summary.

The harness refuses to run against `coolock-ardlea-scouts` or any non-local Firestore host. No service-account credentials are used, and the temporary database export is not uploaded as an Actions artifact.

The workflow runs on relevant pull requests, can be started manually, and runs monthly so recovery behavior is rehearsed rather than only documented.

This proves the repository's recovery harness and Firebase emulator export/import path. It does not prove Cloud Storage IAM, managed Firestore import permissions, billing, or project/location compatibility.

### Managed non-production import rehearsal

When a suitable non-production Firebase project is available, periodically extend the recovery evidence with a managed Firestore import exercise:

1. create a controlled managed export containing non-sensitive test data;
2. grant the test project access to that export as required;
3. import the export into the test database;
4. compare expected document counts/representative records;
5. run application or Firestore verification against the restored test data;
6. record the test date and any IAM/location issues found.

Never use real member medical/contact data merely to test a restore procedure in a less protected environment.

## Retention and monitoring

Recommended operational policy:

- keep multiple generations rather than only the newest export;
- use Cloud Storage lifecycle rules to enforce retention automatically;
- periodically check that scheduled backups are still succeeding;
- run a manual backup before significant production data changes;
- keep the automated emulator recovery drill green;
- periodically test a managed restore into a non-production Firebase project when one is available;
- review backup bucket IAM and service-account access when credentials or project ownership change.

The exact retention duration should be agreed based on safeguarding/privacy obligations, recovery needs, storage cost and data-retention policy rather than being embedded in application code.

## Security notes

Backups contain the same sensitive data as Firestore. Treat the backup bucket as production data storage.

- do not make the bucket public;
- grant access only to operators/service agents that require it;
- do not download exports to unmanaged personal devices;
- do not put production backup contents in GitHub artifacts;
- rotate credentials if a service-account key is exposed;
- review cross-project bucket grants carefully.
