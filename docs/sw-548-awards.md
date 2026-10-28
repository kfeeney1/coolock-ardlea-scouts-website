# SW-548: Awards presentation

The redesigned navigation separates Progress, Record badgework and Awards.
Awards defaults to the ready queue and provides a separate Award history view;
search, section, skill and level filters continue to scope the visible records.
The queue and history use the same canonical original-artwork renderer as Progress.
Full competency completion remains distinct from an explicit award record.

Selective/bulk queue confirmation is retained. Cancel writes nothing. The new
single-stage award action also asks for confirmation; removal retains its existing
confirmation and leaves competency progress unchanged. History shows the actual
award attribution/date and opens existing child history/provenance details.
No server-authoritative eligibility work from deferred SW-24 is added.

The overview loader now explicitly clears fulfilled request-cache entries when
reloading after queue operations. A confirmed award therefore leaves the queue
using freshly loaded saved records. On an award failure, reloading also reflects
any independently persisted awards before retrying remaining candidates.

The complete existing presentation remains available with the independent toggle
off. The Group header, section scope, source context and existing backend checks
remain. This focused branch targets main da6a7bce after SW-546 (#945) and the
artwork/settings/CI foundations were merged. No default enablement is performed.

## Android manual checks

- At 320px, open Awards and filter to a child/skill. Inspect original artwork,
  counts and Ready to award status; incomplete and awarded stages stay out.
- Select one badge, cancel confirmation, verify no award, then confirm. Select
  all remaining ready badges and confirm; only those selected become awarded.
- Inspect Award history and provenance, including older stages while a later
  stage is in progress. Open the exact stage from child details.
- Cancel then confirm removal. The award disappears; saved competencies remain
  complete and the stage returns to Ready to award. No automatic award occurs.
- Repeat off/on, supported themes, keyboard/focus and reduced motion. Test a
  permission failure and verify remaining queue/history reflect saved records.

Local/CI assurance is separate from deployed Firebase TEST and Production Manual
Testing. Authoritative Swimming originals remain unresolved; no visual acceptance
of substitute artwork or Production pass is claimed.

## Development verification

Pinned Chromium 151 desktop/mobile run passed all 22 cases with zero retries:
16 Progress regressions plus six Awards cases, covering rollout off/on, original
ready/history artwork, selective and bulk cancel/confirm, explicit single-stage
confirmation, provenance entry, removal cancellation/confirmation and retained
completion. The removal test scopes its trigger to the award panel so it cannot
accidentally click an exiting dialog's same-named button.

Full local `npm run quality` passed: 936 unit tests plus worker/backend tests,
all contracts, complexity guard and production build. Fresh current-main validation is recorded below before publication.

Fresh current-main validation on da6a7bce passed full Quality (936 units plus
worker/backend/audit/contracts/source guard/build) and all 22 desktop/mobile
Awards/Progress cases, zero retries (1.5 minutes). Swimming source recovery is
separate SW-544/#946; this PR does not duplicate it.
