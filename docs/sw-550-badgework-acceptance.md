# SW-550: badgework verification and acceptance

The integration candidate combines the independent default-off rollout, original
badge artwork, Progress, atomic draft Recording, Awards and read-only Parent
Portal parity. It preserves the shared Group header/emblem and theme tokens,
canonical records, existing roles/sections, provenance and source-return paths.
The final assurance PR contains tests, registrations and evidence only; it must
not duplicate implementation changes from #942–#949.

## Evidence gates

| Gate | Evidence | State |
| --- | --- | --- |
| Local development | 944 unit, 51 worker, two maintenance and eight event backend tests; audit/contracts/unchanged guards/build | Passed on integration candidate |
| Browser regression | 110 cross-role cases plus 19 legacy cases; five existing project-specific skips; zero retries | Passed on integration candidate |
| GitHub CI | Exact-head implementation and final assurance checks are recorded in Jira | Merge gates apply to each current head |
| Deployed Firebase TEST acceptance | Actual deployed build, authenticated roles and persisted records | Pending |
| Production Manual Testing | Separate deployment and real-device testing | Pending |

The two fresh browser runs passed 110/110 (8.5m) and 19/24 (2.0m, five existing
project-specific skips). Case names, durations, source hashes, Rules hashes and
exact candidate/implementation references are in
`sw-550-local-browser-evidence.json`. No timeout, retry, skip policy, assertion
requirement, complexity ceiling or shard budget was weakened. All six estimated
full-suite shards remain below the existing 900-second browser budget.

Coverage includes all sixteen combinations of Badgework, Navigation, Schedule and
Meeting toggles in both leader and linked-parent views, on desktop and 320px
Chromium. Saved captions/counts match across roles; parents have no recording,
awarding, saving, management or export controls. Separate cases cover backend
configuration denial/revalidation, unrelated-child/section denial and multiple
linked children.

Original sources cover all 87 supported skill/stage mappings. Pixel checks retain
coloured frames while canonical completion reveals interior colour bottom to top;
all six Swimming source regions are checked and stages 7–9 remain unsupported.
All five actual themes, status contrast, reduced motion, original-image failure
and Retry are covered. Progress filters/matrix/sorting/CSV/direct stage entry,
mixed group/individual drafts, equivalence, Save/reload/Discard, zero-write failed
save/retry, offline pending-save navigation and 416/520-change atomic saves pass.
Awards remain explicit and separately confirmed; history/provenance/removal retain
competency records. Reaching 100% never auto-awards.

Source tests cover attending-only meeting selection, closed-meeting rejection,
retry after reopening, meeting/event provenance and return to the same source.
Legacy tests preserve existing recording, slow-read navigation, Review note-save
handoff/retry, closed/read-only locks, authorised note corrections and compact
attendance/uniform. SW-417 remains In Progress; SW-420 and SW-423 remain In Review.
This work reuses their contracts and does not duplicate Plan/Run/Review or resume
SW-24's deferred server-authoritative award enforcement.

## Rollout and rollback

Only an active Superuser may save the existing configuration switch labelled
**Badgework redesign**. The independent setting defaults off. Off retains the
complete existing leader/parent experience; on selects the redesigned experience
using the same records. No enablement is performed by these PRs or merges.

A live switch retains the leader's current layout and draft until the next visit,
with a notice to save/discard before reload. Parents receive a reload notice.
Rollback: switch Badgework redesign off, finish/discard current leader drafts,
and reload both roles. No deployment, migration, second progress store or award
rewriting is needed. Navigation, Schedule and Meeting switches are independent.

## Android-focused TEST and manual plan

Use authorised synthetic TEST members and record the deployed build SHA, account
role/section, browser/device, theme and observed results. Keep TEST and Production
results separate; do not use real production records for failure simulations.

1. Start off as Superuser, ordinary leader and parent. Check configuration access
   and backend denial. Turn on, revisit both roles and confirm Group identity,
   all five themes, 320px/desktop wrapping, keyboard/focus/labels, 44px targets,
   contrast and reduced motion.
2. In Progress inspect zero, partial, ready, awarded and later-stage cases. Earlier
   awards stay visible. Filter member/section/skill/status/level; sort the matrix,
   inspect scoped CSV and open the exact member/skill/stage. Swimming stops at six.
3. Record members with mixed progress. Check names/sections and Change members,
   shared/equivalent points and individual exceptions. Confirm Unsaved previews.
   Discard/reload restores saved values; Save/reload matches parent counts/artwork.
4. Keep a leader draft open while reloading the parent: only saved progress shows.
   Simulate denied target access or closed source; verify no partial saved records,
   retained draft and successful retry after restoring access. Repeat a large
   authorised group Save against real TEST request-size/Rules limits.
5. While dirty or Save is offline/pending, exercise all three tabs, member/skill/
   stage changes, menu links, sign-out, reload and Android Back. Check Stay/Save/
   Discard and focus; Back closes an open menu/select before leaving the editor.
6. Cancel/confirm selective, bulk and single-stage awards. Inspect history and
   provenance; cancel/confirm removal. Saved competencies remain and completion
   never creates an award automatically.
7. Switch linked children and open child/section direct links. Check overview/detail
   parity and read-only controls; unrelated-child reads and parent progress/config
   writes remain denied. Confirm image failure, Retry, loading and empty states.
8. Enter from an open meeting Review with attending members only. Save and return
   to that same Review; verify closed-meeting locks and existing authorised note
   corrections. Repeat event provenance/return. Roll back and repeat supported
   switch combinations; verify canonical progress and awards are retained.

A green PR, merge, preview deployment or local emulator run is not deployed TEST
acceptance or a Production pass. Keep SW-428 In Progress until its separate
acceptance requirements are satisfied.
