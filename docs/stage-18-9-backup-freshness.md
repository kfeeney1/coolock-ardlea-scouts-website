# Stage 18.9 — Firestore backup freshness

Stage 18.9 turns the production-readiness requirement for a recent backup into a recurring read-only audit.

## What the audit checks

`.github/workflows/firestore-backup-freshness.yml` runs daily and can also be started manually. It authenticates to the production Google Cloud project, lists the existing Firestore export destinations under `FIRESTORE_BACKUP_BUCKET`, identifies the latest timestamped export created by the canonical `Firestore Backup` workflow, and fails when that export is older than 192 hours (8 days).

The eight-day threshold is intentionally slightly wider than the weekly backup cadence so normal scheduler drift does not generate false failures while still detecting a missed weekly backup promptly.

## Safety boundaries

- The workflow is not triggered by pull requests.
- It has only `contents: read` GitHub permissions.
- It does not create, delete, restore or modify Firestore data or backup objects.
- It uses the canonical production Firebase service-account secret and immutable-pinned Google authentication/setup actions.
- No transient npm packages are installed.

## Release use

A stale or missing backup should block high-risk production work such as data migrations, bulk repairs or schema changes until a fresh `Firestore Backup` workflow succeeds.

This audit complements the existing backup workflow; it does not replace restore testing. Recovery procedures remain documented separately in `docs/firestore-backup-recovery.md`.

## Remaining repository setting gap

Stage 18.7 drift detection remains active, but GitHub still reports `main` as unprotected with no active repository rulesets. Required checks and pull-request-only changes therefore still need to be enabled in GitHub repository settings before that control is considered enforced.
