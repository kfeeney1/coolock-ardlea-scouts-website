# SW-550: integrated badgework assurance and acceptance boundaries

## Development checkpoints

| Child | Pushed checkpoint | Local assurance |
| --- | --- | --- |
| SW-544 | #942 merged; #946 original Swimming recovery | 937 units; 34 artwork/Progress desktop/mobile cases; all #946 CI green |
| SW-545 | #943 merged | Default-off independent configuration and backend permissions |
| SW-546 | #945 merged | Full Quality; 16 Progress cases; exact-head CI green |
| SW-547 | #949 | 943 units; 12 recording regressions plus four 416/520-change atomic-save cases |
| SW-548 | #947 | 936 units; 22 Progress/Awards cases |
| SW-549 | #948 | 936 units; six parent/parity/denial cases |
| SW-550 | #944 merged; final integration in development | Six-shard CI foundations; refreshed combined verification below |

Each implementation PR targets main and contains its own Jira scope. The user
retains merge control. The local integration combines these exact PR checkpoints
for advance verification; it does not duplicate their changes in an assurance PR
or authorise enabling rollout. Source/nav/dialog merge resolutions preserve all
functionality, including disabling all three tabs during a pending Save.

## Rollout and rollback

The independent Superuser setting defaults off. Off retains the complete existing
leader/parent presentation using the same canonical records. On selects the new
views after a fresh visit. A live leader flip retains layout and draft, warns of
the changed setting and applies on the next visit/reload; save/discard first.
Parents receive only a reload notice. Backend configuration Rules continue to
require the active Superuser and existing audit fields.

Rollback: switch Badgework redesign off, finish/discard any current leader draft,
and reload both roles. No migration, second progress store, duplicate awards or
deployment is required. Navigation, Schedule and Meeting switches are independent.
The matrix covers all sixteen combinations of their four on/off values for both
leader and linked parent views, on desktop and 320px Chromium. Each new-mode case
compares saved badge captions/counts across roles and checks parent read-only
controls. Configuration permission tests remain separate.

## Android-focused manual acceptance

1. Use a fresh Android Chrome session at 320px and a desktop. Check Group emblem,
   header, menu, all five supported themes, keyboard focus, readable status text,
   44px targets, contrast, wrapping and reduced-motion behaviour.
2. In Progress, filter member/section/skill/status/level, compare/sort the matrix,
   open the exact stage and inspect scoped CSV. Check zero, partial, ready,
   awarded and later-stage progress; earlier awards remain visible. Swimming
   stops at six. Check the original supplier photograph viewports and handbook
   artwork, including exact outlines, symbols and stage numerals.
3. Select children with different progress. Verify named members, Change members,
   skill/stage selection, shared competencies and individual exceptions. Check
   Unsaved previews and mixed controls. Discard/reload restores saved progress.
4. Save/reload and verify matching leader/parent artwork and counts. While a leader
   draft is open, parent reload stays at saved progress. Reject one child's save
   permission, verify no writes to another child, restore access and retry.
5. Try Progress, Change members, skill/stage, menu links, Sign Out, browser reload
   and Android Back while dirty. Stay restores focus/draft; Discard writes nothing;
   Save leaves only after commit. Back closes a menu/select overlay first.
6. From an open meeting's Review, enter badgework with attending children only.
   Save and return to that same Review. Close the source before save and verify
   rejection/retained draft/no writes; authorised correction paths remain intact.
   Repeat event handoff and confirm source provenance and return context.
7. In Awards, cancel/confirm selective and bulk awards, inspect history/provenance,
   then cancel/confirm removal. Completion remains separate from awarding.
8. As a parent, switch linked children and use child/section direct links. No
   recording, saving, awarding, removal, management or leader export actions may
   appear. Unrelated-child reads and progress/configuration writes stay denied.
9. Repeat rollback and all supported switch combinations. Inspect loading, empty,
   denied, failed-save/retry, offline/failed artwork and unsaved navigation states.

## Gates that are not waived

- Original Swimming recovery is provided by SW-544/#946, using unchanged bytes
  from the official supplier photograph. The mapping supports exactly six stages;
  nine handbook skills retain their 81 original assets. Deployed visual acceptance
  remains necessary; do not claim approval from local screenshots alone.
- SW-547/#949 removes the artificial 400-write prototype restriction. Local tests
  verify atomic 416/520-change saves under unchanged Rules, denial/retry and no
  awards. Deployed TEST must separately check supported group sizes against real
  request-size and Rules access limits; no automatic partial-save fallback exists.
- Deployed Firebase TEST acceptance must use the actual integrated deployed head,
  authenticated roles, configuration and persisted records. PR Preview deployment
  or local emulators are not that acceptance pass.
- Production Manual Testing follows separately after deployment and user testing.
  No Done/Production pass is inferred from branches, merges or green CI.

## Integrated verification

Earlier checkpoints passed 75 cases with five pre-existing project-specific skips
and zero retries, followed by 48/48 matrix/recording/source cases. Those results
belong to their earlier source hashes and are superseded for final acceptance by
the refreshed exact-source run below. The historical evidence is retained in Jira;
no old result is described as testing the current combined head.

Refreshed pinned Chromium 151 desktop/mobile verification covers **129 unique
passing cases and five pre-existing project-specific skips, zero retries**.
The first 110-case run passed 78 non-matrix cases and 16 rollout-off matrix cases;
16 rollout-on matrix assertions failed because rendered leader `innerText` was
compared with raw parent `textContent`. No product defect was involved. The
corrected matrix uses rendered text on both sides, retaining exact caption parity.
A fresh 56-case matrix/legacy run passed 51 cases with five existing skips (3.7m),
including all 32 desktop/mobile leader-and-parent toggle cases. All first-run
matrix results are superseded; their passes are not counted twice.

The 129-case set includes Progress, draft/save/discard/retry and pending Awards
navigation, 416/520-change atomic saves, Awards/history, linked-parent saved parity
and denials, all sixteen leader/parent toggle combinations, configuration
permission revalidation, original Swimming artwork, bottom-up fills, reduced
motion, all five actual theme contrasts and meeting/event locks/return/provenance.
Existing legacy badgework, slow-read navigation, Review failed-save retry,
attending-only and closed-meeting locks, authorised note corrections and compact
attendance/uniform regressions passed. Case names, durations, source hashes and
superseded-run details are in `sw-550-local-browser-evidence.json`.

No retries, timeouts, assertion requirements or source-complexity ceilings were
weakened. This is local development assurance, not deployed TEST or Production
Manual Testing. The final assurance PR remains dependent on implementation PRs
#946–#949 landing in main; it must not duplicate their application changes.

Full current integrated `npm run quality` passed: 944 unit tests, 51 email-worker,
two maintenance and eight event backend tests, production dependency audit, all
contracts, unchanged source-complexity/budget guards and build. All six full-suite
shard estimates remain below the existing 900-second browser budget (858.3–860s).
