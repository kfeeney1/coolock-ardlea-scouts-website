# SW-549: Parent Portal parity

The same independent badgework setting selects existing or redesigned Parent
Portal badgework. Missing/failed configuration uses the existing presentation;
a live change is pinned until the next visit/reload. Approved-child selection,
parent portal child query links and Badgework section anchors remain unchanged.
All progress is loaded through the existing linked-member and saved-progress
services and rechecked by Firestore Rules.

The redesigned overview uses the exact shared BadgeworkSkillGrid / progressive
badge component, canonical saved counts, order, stage limits and current-stage
selection as leader Progress. Detail uses the same flowing grid for current/all
stages and opens the selected stage's read-only competencies with keyboard focus.
Historical awards remain visible; 100% completion still reads Ready to award.
Swimming remains six stages; failed original artwork has an explicit unavailable state.

The Parent Portal imports no draft projection or recording/save/award/configuration
service. It has no leader export or management actions. Unsaved leader changes
cannot become parent progress. The complete legacy skill/detail presentation is
retained behind the default-off independent toggle.

## Android manual checks

1. At 320px, open a linked child via `/parent?child=…#parent-adventure-skills`.
   Compare original art, counts, state and current stage with the leader view.
2. Open a stage with touch/keyboard, inspect competencies, show all stages and
   open a different stage. Verify focus, historical awards and Swimming's limit.
3. Change the linked child with Viewing information for; confirm all displayed
   progress changes to that child and direct links retain the selected child.
4. Leave unsaved leader edits open in another session and reload the parent view:
   saved counts/artwork remain unchanged. Save/reload should then match.
5. Try an unrelated child query and revoked linked access. Verify no unrelated
   progress and a clear denied/retry state; parent writes/configuration stay denied.
6. Verify no recording, saving, awarding, removal, management or export controls
   in badgework. Repeat with rollout off/on, all supported themes and reduced motion.

Development emulator/CI evidence is separate from deployed Firebase TEST
acceptance and Production Manual Testing. Original Swimming artwork is supplied
separately by SW-544/#946; the remaining epic acceptance gates are not waived.

## Development verification

All six pinned Chromium 151 desktop/mobile cases passed with zero retries
(process exit 0; Playwright last-run status passed with no failed tests). Covers
rollout off/on, saved caption/count/original asset parity while a leader draft is
open, current/all-stage keyboard navigation, historical awards, Swimming's limit,
320px child switching/direct links, unrelated-child read denial, parent progress
mutation denial and protected configuration denial. Loaded artwork is awaited
after the figure is visible; comparisons use the stable skill/stage/count/status
caption rather than transient artwork-loading text.

Full local `npm run quality` passed (936 unit tests plus worker/backend tests,
all contracts, source-complexity guard and production build). This focused change targets main da6a7bce after merged SW-546/#945 and the
settings/artwork/CI foundations.

The parent failure-state assertion explicitly intercepts the original Swimming
source with a 404, retaining fallback coverage across the SW-544 asset recovery.
Camping source/count parity remains a real successful-load comparison. Child
switching additionally verifies that the second child shows zero saved progress.

Fresh validation on main da6a7bce passed full Quality (936 units plus
worker/backend/audit/contracts/source guard/build) and all six desktop/mobile
parent cases with zero retries (29.3 seconds), including the strengthened
second-child zero-progress check and explicit artwork-failure fixture.
