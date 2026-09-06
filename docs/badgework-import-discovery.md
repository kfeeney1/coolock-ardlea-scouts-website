# Adventure Skills badgework import discovery

## Decision

Do not add a production import writer until a real export from the previous badgework system is available and its meanings can be mapped without guesswork.

The current application can safely receive canonical migration records, but it does not yet have an importer. The existing **Export filtered CSV** file is a leader-facing summary, not a backup or round-trip format: it contains stage totals and status labels but not the completed requirement IDs, award timestamps, source evidence, or stable member IDs needed to reconstruct progress.

## Scout-leader use case

A group moving existing records into this site needs to retain each child's genuine Adventure Skill work without:

- awarding a badge that was only started;
- turning a historical award into newly completed competency evidence;
- matching two children solely because their names are similar;
- losing completion dates or silently inventing dates;
- replacing newer badgework already recorded in this application.

The import must therefore be a reviewed migration rather than a general-purpose spreadsheet upload in the live recorder.

## Current system boundaries

Adventure Skills progress is stored below the stable member document ID in two separate collections:

- `memberAdventureSkillProgress/{memberId}/requirements/{requirementId}` for individual competency completion;
- `memberAdventureSkillProgress/{memberId}/awards/{skillId}-stage-{stage}` for the separate award event.

Requirement IDs, skill IDs, stage numbers, shared-competency keys, and award IDs must match the canonical catalogue. Most skills have Levels 1–9; Swimming has Levels 1–6. The integrity audit rejects orphaned members, unknown requirements, mismatched catalogue metadata, invalid provenance, non-canonical awards, duplicate awards, and awards without complete canonical requirements.

Firestore Rules allow attributed leader writes in the leader's permitted section. `migration` is an accepted requirement source type, but the ordinary badgework UI deliberately cannot create migration handoffs. This is a useful provenance boundary, not an importer.

## Evidence needed before implementation

Obtain a representative, redacted export from the source system containing examples of:

1. no progress;
2. a partly completed level;
3. a completed but not awarded level, if that state exists;
4. an awarded level;
5. progress in two levels at once;
6. Levels 6–9 and Swimming Level 6;
7. a child who changed section;
8. any competency shared between Adventure Skills;
9. corrections, removals, or duplicate rows;
10. the source system's child identifier and available dates.

For every column or state, confirm whether it represents a competency, completion of all requirements, an award, or presentation-only text. A screenshot or video is not sufficient evidence for a data conversion.

## Proposed import contract

The eventual import should accept a versioned, repository-defined intermediate file rather than writing directly from an unknown vendor export. Each input row must include:

| Field | Requirement |
| --- | --- |
| `memberId` | Required canonical member document ID; never inferred from name alone |
| `recordType` | `requirement` or `award` |
| `skillId` | Required canonical Adventure Skill ID |
| `stage` | Required canonical level number |
| `requirementId` | Required for competency rows; blank for award rows |
| `occurredAt` | Original valid timestamp when supplied; otherwise explicitly reported as unavailable |
| `sourceReference` | Bounded reference to the migration batch/source file, without personal notes |

Names and sections may appear in a preview for human verification, but they must not be write keys. The converter for any source system belongs outside the canonical writer and must be covered by fixture-based tests.

## Required workflow

1. Parse locally and reject malformed files without writes.
2. Resolve every row to an existing permitted member and canonical catalogue entry.
3. Produce a dry-run report containing counts, duplicates, conflicts, unknown members, unknown competencies, inferred values, and proposed writes.
4. Require explicit review of the exact dry-run manifest.
5. Verify a recent backup before enabling writes against production.
6. Create only missing canonical records by default. Never delete or downgrade existing progress.
7. Treat conflicts as blockers; do not silently replace newer records.
8. Keep requirements and awards separate. An award may only be proposed when every canonical stage requirement is already present or included in the same reviewed manifest.
9. Stamp imported competency records with `sourceType: migration`, the acting administrator, and the batch reference.
10. Run the Adventure Skills integrity audit after the write and reconcile the written count to the approved manifest.

The write command must be disabled by default and require explicit project, environment, manifest, and confirmation gates. It must not be exposed as a GitHub Actions production migration workflow.

## Suggested implementation PRs after source data is supplied

1. **Format fixtures and converter.** Add redacted source fixtures, deterministic parsing, canonical mapping, and rejection tests; no Firebase access.
2. **Dry-run planner.** Load a scoped member snapshot, generate the exact proposed manifest, and fail closed on ambiguity; still no writes.
3. **Emulator writer.** Apply only an approved manifest in the Firebase Emulator and prove idempotency, conflict handling, shared competencies, Swimming bounds, and completion/award separation.
4. **Guarded operator command.** Add backup and environment gates, explicit execution confirmation, audit evidence, and post-write integrity verification.

Until the source export is available, implementing a generic uploader would create a false sense of safety and could convert presentation states into incorrect Scout records. The safe next action is to obtain the redacted sample export and document its field meanings.
