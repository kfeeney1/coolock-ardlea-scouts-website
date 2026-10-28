# SW-547: draft-aware recording (development)

The redesigned Record view uses the shared original-artwork renderer for each
selected child and stage. Preview counts expand the canonical equivalent
competencies, apply group changes first and individual exceptions second, and
retain historical awards. Changed previews explicitly say **Unsaved preview**.
Group mixed indicators reflect those exceptions. Neither the preview nor its
synthetic records are supplied to saved overview/parent loaders or award checks.

Change members, skill/stage changes and Progress retain the existing discard
confirmation. The redesigned view also reuses the source editors' overlay-aware
Save/Discard/Stay guard for navigation links, Sign Out, reload and Android Back.
An open select/menu overlay must close before Back attempts to leave the editor.
All dialog actions have 44px targets. The existing experience remains available
when the independent badgework rollout is off.

## Save integrity

A redesigned Save plans one canonical write per member/competency, expands shared
competencies, applies individual exceptions last, and commits one atomic batch.
No draft reaches persisted overview/parent progress before commit. A rejected
batch leaves the draft visible for retry; no automatic award is created. Source
provenance and all existing Firestore member/source permission checks remain.
Legacy callers and the rollout-off Save keep their existing service path.

The earlier prototype's 400-write restriction was unnecessary: 400 is the old
helper's chunk size, not a current Firestore commit limit. Google Cloud's
[29 March 2023 release notes](https://docs.cloud.google.com/firestore/docs/release-notes)
removed the write-count cap for Commit and transactions. The current SDK forwards
all mutations in one commit. The redesigned service imposes no artificial count
cap and never splits a draft. Request-size and existing Rules access limits still
apply; a backend rejection keeps the entire draft available for retry. No Rules
or server-side eligibility enforcement were changed.

## Android acceptance checklist

1. At 320px, select children with different saved progress. Confirm names,
   sections, skill/stage, exact individual counts, mixed controls and visible status.
2. Complete a stage for the group, then untick one child's point. Only that
   child's preview becomes incomplete. Confirm both Unsaved labels and no award.
3. Discard and reload: saved counts/artwork and historical awards remain intact.
4. Save, reload and compare saved leader/parent progress. Confirm equivalent
   competencies and provenance; completion alone never creates an award.
5. Reject one target's backend permission, attempt a multi-member save, and verify
   no member's records change. Restore access and retry the same retained draft.
6. While dirty, try Change members, skill/stage, Progress, menu navigation,
   Sign Out and Android Back. Stay retains draft/focus; Discard leaves without
   writes; Save leaves only after commit. Repeat with a menu/select overlay open.
7. Repeat with the toggle off, all supported themes, keyboard and reduced motion.

Development tests/emulators are separate from deployed Firebase TEST and
Production Manual Testing. Swimming source recovery is tracked in separate SW-544/#946.

## Development evidence

The pinned Chromium 151 desktop/mobile run passed 26/26 cases with zero retries:
16 existing SW-546 Progress cases and ten recording cases. It covers mixed
per-child previews, Discard, a real section-permission rejection of one target
with no writes to the other, retry/reload without auto-awarding, navigation Stay,
Save/Discard-and-leave, and Android Back closing the menu before leaving.
The navigation prompt uses an alert dialog that owns its Back entry; this avoids
a second transient-dialog history entry reopening it after Stay. No shared
source-editor or meeting navigation guard was modified. Full local
`npm run quality` passed (942 unit tests plus worker/backend tests, all contracts,
complexity guard and build). Those are checkpoint results; fresh current-main
verification is recorded below.

Pending saves disable context changes (Progress/Record navigation, members,
skill/stage and discard confirmation) until the backend acknowledges the commit.
An offline-save regression checks the pending state, unchanged backend records
and eventual acknowledged completion without an award. All twelve recording cases
passed on pinned desktop/mobile Chromium with zero retries (1.2 minutes),
including the pending-offline-save check in both projects.

## Current-main verification

Reconciled onto main da6a7bce after merged SW-546/#945. All twelve recording
regressions passed again with zero retries. Four additional pinned Chromium 151
desktop/mobile cases passed with zero retries (42.2s): one 520-document manual
Save for 20 children and one 416-document meeting Save for 16 children, including
320px layouts without horizontal overflow, unchanged Rules, a closed-meeting
rejection with zero writes, retry after reopening, exact canonical equivalent
records, reload, source provenance and no awards. The scoped meeting case uses
a Programme Scouter; the manual case uses a Super Admin. The initial large
manual test had an incorrect checkbox locator; the corrected test exercises
Select all shown and passes without increased timeouts or retries.

The earlier proposed save-group design is unnecessary and is not implemented.
The artificial 400-write prototype restriction is removed. These local emulator
results do not substitute for deployed Firebase TEST checks of request-size and
Rules access limits. Android acceptance should repeat the large group Save and
closed-meeting retry using authorised TEST data before rollout.

Fresh full `npm run quality` passed on this current-main implementation: 943 unit
tests, 51 email-worker, two maintenance and eight event backend tests, production
dependency audit, suite/control/RBAC/deployment contracts, unchanged complexity
guard and production build. Backend dependency links were restored in the new
worktree before the successful full run; no test or guard was weakened.

## Reconciliation after merged Swimming recovery

Rebased onto main 5269634e after #946. All ten SW-547 application files remain
byte-identical to previously green 5bd1713b. Resolves only suite/timing registration
conflicts and moves Recording entries away from Awards/Parent insertion points;
no test coverage is removed. The suite contract and five shard-balance/budget
tests pass with unchanged ceilings. All 16 fresh pinned desktop/mobile cases
passed with zero retries (1.9m): mixed previews, Discard, section rejection/retry,
safe navigation/Android Back/offline pending Save and 416/520-change atomic saves
with source locks/provenance/reload/no awards. Original Swimming artwork is now
part of main, while the six-stage boundary remains unchanged. Full Quality passed
944 units plus worker/backend/audit/contracts/guards/build both before and after
the registration relocation. No assertions, retries, timeouts or ceilings changed.
