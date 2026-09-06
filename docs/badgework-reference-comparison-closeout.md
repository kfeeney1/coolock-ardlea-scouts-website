# Adventure Skills reference comparison closeout

## Outcome

The refinement sequence prompted by the ScoutProgress.ie reference video is complete through PR #378. The current implementation now retains the reference system's strongest operational characteristic—rapid cohort scanning—while preserving this application's stronger competency, provenance, permission, parent, and meeting-integration model.

No additional unblocked P0 or P1 user-interface work was identified at closeout. Two deliberate constraints remain: server-authoritative award-completion enforcement was deferred, and migration implementation is blocked until a representative source-system export is supplied.

## What now matches the reference well

- Leaders can move from a group overview to one child's skill and exact level.
- A compact child-by-level matrix exposes Not started, Started, Awaiting award, and Awarded states together.
- Exact level and state filters answer cohort questions without opening each child.
- Full-level completion is available alongside individual competency recording.
- The awarding queue supports selective and bulk awards while keeping completion separate from awarding.
- Source-linked meeting recording preselects attendees and provides a short save-and-return route.
- The recording interface can focus on outstanding competencies instead of repeatedly scanning completed points.

## What this implementation does better

- One action can update several children, with explicit exceptions for individuals.
- Shared equivalent competencies propagate through a canonical mapping rather than duplicated manual entry.
- Badgework remains attached to the member across section changes.
- Parents receive read-only competency and award visibility.
- Completion, awaiting-award, and awarded states are separate and visible.
- Completion provenance can link back to a meeting, event, or activity.
- Award history is visible and removals preserve competency progress.
- CSV export is permission-scoped, audited, and excludes sensitive member fields.
- Swimming is bounded to Level 6 while other skills retain Levels 1–9.
- Mobile exception editing shows the full competency beside each selected child rather than forcing a wide matrix.

## Leader questions at closeout

| Operational question | Current answer |
| --- | --- |
| Who has started this level? | Select the skill and exact level, then use **Started**; the level matrix shows the same cohort in one scan. |
| Who has completed this level? | Use **Awaiting award** for completed requirements not yet awarded. |
| Who is awaiting an award? | Use the **Awaiting award** filter and queue, optionally scoped by section, skill, achieved level, or exact level. |
| Who has already been awarded it? | Select the skill and level, then use **Awarded**; award history remains visible in child progress. |
| Which competencies are missing for each child? | Open the selected level. Per-child summaries show counts and the exception matrix identifies each unchecked child/competency combination. **Outstanding only** removes points complete for everyone. |
| Can I update several children together but make exceptions? | Yes. Group controls create the common change; the per-child matrix/cards create explicit individual overrides before one save. |

## Refinement sequence

| PR | Result |
| --- | --- |
| #352–#353 | Group overview and dedicated child progress |
| #354–#355 | Compact stage navigation and operational filters |
| #356 | Permission-scoped CSV export |
| #357–#362 | Multi-child summaries, awarding queue, competency matrix, history, and individual exceptions |
| #363–#365 | Section ordering, filter ordering, and colour clarity |
| #366–#369 | Adventure Skill grid, canonical competencies, achieved-level filtering, and started-level lifecycle labels |
| #370 | Correct awaiting-award tile lifecycle label |
| #371 | Canonical award identities and Swimming bounds |
| #372 | Exact level/state cohort filters |
| #373 | Compact cross-child level matrix |
| #374 | Meeting/activity fast recording route |
| #375 | Mobile per-child exception cards |
| #376 | Outstanding-only recording focus |
| #377 | Filter reset, result count, and high-level filtering polish |
| #378 | Safe import discovery and migration contract |

## Remaining constraints

### Deferred: server-authoritative award completion validation

The client prevents an award until all canonical competencies are saved, canonical award identities are enforced, and the integrity audit reports premature awards. Firestore Rules do not themselves prove completion of every requirement before accepting an award document. Moving that invariant to a trusted backend remains the strongest long-term data-integrity improvement, but it was deliberately deferred rather than hidden inside this UI sequence.

This should be reconsidered before allowing untrusted clients, external integrations, or an import writer to create awards directly.

### Blocked: historical import

The existing CSV is a summary export and cannot reconstruct individual competency evidence. Import implementation must wait for a representative redacted export from the source system. The required format evidence, dry-run manifest, non-destructive write rules, backup gate, and implementation breakdown are recorded in `docs/badgework-import-discovery.md`.

## Regression watch list

- Keep the tile rule deterministic: the earliest incomplete started level takes precedence; otherwise show the earliest awaiting-award level, then the highest awarded level.
- Keep **Level Achieved** based on awaiting-award or awarded stages, with **Level 6+** covering Levels 6–9.
- Never infer an award from competency completion or vice versa.
- Never clear individual draft exceptions silently when changing unrelated competencies.
- Keep meeting-linked saves attributed to their source and manual recording attributed as manual.
- Preserve the mobile and desktop presentations of the same draft state.
- Continue emulator-backed coverage for group writes, individual exceptions, awarding, parent read-only access, and canonical catalogue bounds.

## Closeout recommendation

Treat the video-comparison UI programme as complete. Do not add more controls solely to imitate the reference system: the current workflow is necessarily richer because it supports multi-child exceptions, provenance, shared competencies, and separate awards. Resume badgework development only for a confirmed field-use defect, a supplied migration export, or an approved server-authoritative validation design.
