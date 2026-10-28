# SW-546: leader Progress integration

## Scope

The independent badgework setting selects the complete existing leader views or
the new Progress presentation. Missing/failed configuration falls back to existing.
The choice is pinned for the visit: a live rollout change shows a notice, retains
focus/selected members/skill/stage and unsaved recording edits, and applies on the
next visit. The setting is read through SW-545's server-confirmed service; this
feature never writes configuration or changes another rollout choice.

The redesigned overview uses SW-544's original stage artwork and canonical
progress renderer. Compact search/section controls remain visible, with advanced
skill/level filters behind the accessible Filters action. Exact stage selection
opens that exact member/skill/stage; unsupported stages are omitted. Existing
status/level filters, clear actions, matrix progress sorting, scoped member/skill
CSV export, ready-to-award queue, history/provenance and recording entry remain.

Member detail shows the current stage, retains explicit highest-awarded/history
information, and can expand each skill to all its original stage badges. Existing
awards stay full colour; complete-unawarded stages remain Ready to award. The
shared presentation has no automatic award or persistence path.

Both presentations retain the Group header/emblem, role/section scope, canonical
records and operational loading/empty/error/retry states. The six original
Swimming images remain unavailable; explicit text and working stage navigation
are preserved rather than substituting invented artwork or unsupported stages.

## Structural preservation

Extracted the existing recording presentation and persisted-meeting-attendance
loading into cohesive components/hooks without changing save, award or source
services. `BadgeworkTracking.tsx` remains under 20,000 bytes, with new files
comfortably below the standard ceiling. The existing recording skill selector
now has an explicit accessible label/id association. No source ceiling, retry,
timeout, backend permission or attendance/closed-meeting protection was relaxed.

SW-547 owns the remaining redesigned recording/draft experience; SW-548 owns
Awards navigation/presentation; SW-549 owns parent parity. Parent pages currently
retain their existing read-only presentation. Keep the rollout off for normal
use until that complete experience and acceptance are delivered. This increment
does not complete the whole Progress → Record → Awards epic.

## Android checks

- At 320px in the default and modern themes, open Progress, search/select a
  section, expand Filters and inspect one skill/stage/status. Clear filters.
- Open a stage directly with keyboard or touch. Confirm the selected child,
  skill and stage; inspect awarded/current/ready/untouched stages in member detail.
- Compare via Level matrix, verify sorting and open the same stage from a cell.
  Export filtered CSV and verify only the selected member/skill scope is included.
- Change the rollout while editing in each direction. The active layout/draft
  stays in place; Keep editing retains it, Discard restores persisted state,
  and the next visit adopts the configured presentation.
- Check Programme Scouter section scope and the existing meeting present-member,
  closed-meeting, source-return and linked-parent read-only regressions.

## Acceptance boundaries

PRs #942, #943 and #944 are merged. This focused SW-546 change targets main
61a982e2 and contains only this child’s integration; none of the foundation
changes are duplicated in its review. CI/development
assurance is separate from deployed Firebase TEST acceptance and PMT. No Done,
Production pass, artwork completion or default rollout enablement is claimed.

## Development verification

The final pinned Chromium 151 desktop/mobile run passed all 16 new cases with
zero retries, including 320px layouts, both themes, keyboard entry/focus, scoped
CSV, matrix entry, section scoping and draft preservation in both toggle
directions. Existing badgework/skill-filter/meeting-review regressions passed
15 cases with five pre-existing project-specific skips. These are local emulator
results, not deployed Firebase TEST or Production acceptance.

Rebased validation on current main 61a982e2: full `npm run quality` passed
(936 units, worker/backend tests, audit, all contracts, source guard and build).
Fresh pinned desktop/mobile Progress run passed all 16 cases with zero retries.
The application files match the previous validated checkpoint; only the
main-targeting acceptance documentation changed.

The original Swimming-artwork gap above describes the SW-546 checkpoint. The
SW-544 source follow-up now supplies verified original Swimming photo viewports;
see docs/sw-544-badge-artwork-audit.md for provenance and the six-stage boundary.
