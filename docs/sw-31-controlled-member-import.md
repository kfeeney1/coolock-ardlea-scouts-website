# SW-31 — Private member seed

Production member data is private operational data. Real member names, dates of birth and reviewed member manifests must never be committed to GitHub, copied into fixtures, attached to Jira/PRs, or printed into CI logs.

## Reviewed private manifest

The manually reviewed member list is stored locally in the existing private manifest. The seed accepts only the fields already reviewed for SW-31 and uses the existing deterministic member-import planner.

The member schema still derives `firstName` and `lastName` deterministically from the supplied display name, preserves the reviewed `displayName`, sets `status` to active, and leaves guardian/contact/emergency fields blank rather than inventing data. The seed does not create Firebase Auth users or parent accounts.

## Simple local seed workflow

The repository exposes one command:

```text
npm run seed:members -- --manifest=C:\Users\user\scout-private-import\member-import-private-reviewed.json --project=coolock-ardlea-scouts
```

That is a dry run. It authenticates with Google Application Default Credentials through `firebase-admin` directly, reads the current `members` collection, and prints aggregate counts only.

Authentication is configured once with:

```text
gcloud auth application-default login
```

There is no `gcloud` subprocess inside the seed script and no service-account JSON file is required for this local workflow.

## Duplicate and overwrite protection

Duplicate matching remains conservative:

- one exact normalized display-name + DOB match in the same section is treated as an existing member and left unchanged;
- multiple exact matches are a conflict;
- an exact identity in another section is a conflict;
- repeated source identity across sections is a conflict;
- no fuzzy or name-only match causes an overwrite;
- new member IDs are deterministic and never based on spreadsheet row numbers.

Running the same seed again after a successful import should therefore create zero new members and report the imported members as matches.

## Production write

A write is deliberately a separate explicit command:

```text
npm run seed:members -- --manifest=C:\Users\user\scout-private-import\member-import-private-reviewed.json --project=coolock-ardlea-scouts --execute --confirm=SEED-MEMBERS
```

The script refuses to write unless `--execute` and the exact `--confirm=SEED-MEMBERS` value are both present. It also refuses all writes while conflicts or rejected records remain and uses Firestore `create`, never overwrite/update, for new member documents.

Before using the write command, review the dry-run aggregate counts and explicitly approve the production seed. The command is run locally, not through GitHub Actions, so the private member manifest never leaves the administrator machine.

## Verification

Unit tests cover deterministic member mapping, duplicate/conflict behaviour and the command-line write guards. Playwright continues to use synthetic member data only; production member PII must not be introduced into Playwright fixtures or CI.
