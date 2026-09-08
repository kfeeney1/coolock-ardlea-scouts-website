# SW-31 — Controlled member import

Production member spreadsheets and reviewed member manifests are private operational inputs. They must never be committed to Git, copied into test fixtures, attached to PR descriptions, or printed into CI logs.

## Current spreadsheet mapping

The reviewed source workbooks map only data that is actually present:

| Section | Worksheet | Spreadsheet name column | Spreadsheet DOB column | Canonical member fields |
| --- | --- | --- | --- | --- |
| Beavers | `Beavers Subs 2526` | A | C | `displayName`, derived `firstName`/`lastName`, `dateOfBirth`, `section` |
| Cubs | `Cubs Subs 2627` | A | B | `displayName`, derived `firstName`/`lastName`, `dateOfBirth`, `section` |
| Scouts | `2026-27` | A | B | `displayName`, derived `firstName`/`lastName`, `dateOfBirth`, `section` |

The current member schema requires separate first and last names while these spreadsheets contain one name cell. The deterministic transformation treats the final whitespace-delimited name component as `lastName` and all preceding components as `firstName`; the original normalized full value is retained as `displayName`. This is a transformation of supplied text, not a lookup or enrichment.

The spreadsheets do not provide canonical guardian/contact/emergency-contact fields in the member-list columns, so those fields are deliberately left empty rather than inferred. Parent access remains a separately reviewed relationship through `parentAccounts.memberIds` and `linkedSections`; the import does not create Firebase Auth or parent accounts.

`status` is `active` only for rows admitted to the reviewed current-section manifest. Beavers rows explicitly annotated `Subs recorded in cubs sheet` or `See cubs` are excluded from the Beavers manifest. Cross-section duplicates in the resulting manifest are conflicts and block execution; the tooling never silently chooses one section.

## Private preparation

Run `scripts/prepare-member-import.py` locally against the private workbooks when spreadsheets are the reviewed source. A manually reviewed authoritative list may instead be converted to the same private manifest contract outside the repository. The generated JSON contains personal data and must remain in a private administrator workspace.

Example spreadsheet mapping arguments:

```text
--mapping "Beavers|Beavers Subs 2526|A|C"
--mapping "Cubs|Cubs Subs 2627|A|B"
--mapping "Scouts|2026-27|A|B"
```

The preparation step prints aggregate counts only. Invalid DOB rows are rejected. Explicit Beavers-to-Cubs annotations are recorded as exclusions without copying names into logs.

## Production dry-run

`scripts/import-members.mjs` compares the private manifest with authoritative Firestore members before any mutation. It supports two authentication paths:

- `FIREBASE_SERVICE_ACCOUNT_JSON` for the existing trusted admin path; or
- Google Application Default Credentials for local **dry-run only**. Configure ADC with `gcloud auth application-default login` and set `PROD_MEMBER_IMPORT_CONFIRM_PROJECT` to the exact reviewed Firebase project ID.

The ADC path requests only `displayName`, `dateOfBirth`, and `section` from the `members` collection, does not log document contents, and never supports `--execute` or `--rollback`. Production mutation continues to require the trusted service-account path and all mutation gates below.

Example Windows Command Prompt dry-run setup:

```text
set PROD_MEMBER_IMPORT_CONFIRM_PROJECT=coolock-ardlea-scouts
node scripts/import-members.mjs --manifest=C:\Users\user\scout-private-import\member-import-private-reviewed.json
```

Duplicate detection uses normalized full display name plus exact ISO date of birth. It is intentionally conservative:

- one exact same-section existing record is an existing match and is left unchanged;
- multiple existing matches are a conflict;
- an exact existing identity in another section is a conflict;
- repeated source identity in more than one section is a conflict;
- no fuzzy/name-only match causes an overwrite.

New IDs are deterministic hashes of normalized identity plus section. Spreadsheet row numbers never become permanent IDs. Proposed records carry `source: spreadsheet-import`, a non-personal `importBatch`, and a source reference for controlled provenance/rollback. They are not marked as TEST data and therefore do not enter the TEST-data purge detector.

## Mutation gates

A production `--execute` run is refused unless conflicts and rejected rows are zero and all reviewed values still match:

- `PROD_MEMBER_IMPORT_CONFIRM_PROJECT`
- `PROD_MEMBER_IMPORT_EXPECTED_CREATE_COUNT`
- `PROD_MEMBER_IMPORT_EXPECTED_MATCH_COUNT`
- `PROD_MEMBER_IMPORT_EXPECTED_MANIFEST_SHA256`
- `PROD_MEMBER_IMPORT_BACKUP_URI`
- `PROD_MEMBER_IMPORT_BACKUP_VERIFIED_AT`

The backup must be a reviewed `gs://.../firestore-backups/...` export verified within 192 hours. There is intentionally no GitHub Actions production-import workflow.

## Rollback

The same reviewed private manifest can be run with `--rollback` after supplying the same project/count/digest/backup gates. Rollback deletes only deterministic IDs from the reviewed create set and refuses any record whose `source`, `importBatch`, or `importSourceRef` provenance no longer matches. Existing legitimate members matched during import are never modified and therefore are never rollback targets.

## Verification layers

Unit tests cover deterministic mapping, rejection, exact-match behavior, cross-section conflicts, and no-overwrite behavior. Firebase/production dry-run is the correct layer for raw member integrity and duplicate comparison.

Playwright remains responsible for representative user-visible behavior using synthetic fixtures only: section-scoped member lists/tiles, filters, leader access, parent scoping and existing navigation. This import does not change the UI/member schema or Playwright fixture contract, so duplicating those scenarios with production data would weaken privacy without adding coverage.
