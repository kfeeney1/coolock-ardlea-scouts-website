# SW-424 — Meeting save and lifecycle

The redesigned footer keeps Save available. Plan/Run use Review & close to move to Review without discarding edits. Review's Save & close opens an explicit confirmation with Keep open and Save & close. Back/Escape dismisses that surface without closing the meeting. A failed save keeps the confirmation and editor data with useful feedback; retry uses the same record. OFF retains immediate Close Meeting.

Closure waits for pending leader-attendance writes before committing closed status. Background saves share the explicit-save write slot, so an older quiet open save cannot finish after closure and reopen the record. A direct save locks editing before waiting for that slot. Share still awaits all writes. Existing audit/refresh warnings remain secondary to acknowledged data writes.

More actions defers equipment, Copy and Create another until its history marker is consumed, matching the established sharing pattern. This prevents a pristine Copy navigation being popped back to the source editor by menu cleanup. Busy actions cannot navigate during a save. Existing canonical copy IDs, destination section/date/roster/equipment semantics, history filters and deliberate reopen service are unchanged.

SW-194's past View/Copy schedule presentation remains separate from SW-424's authorised closed attendance/medical/notes corrections. Existing permissions remain authoritative. Programme/completed badgework locks, canonical source routes and explicit reopening are retained; no permission or schedule action is widened.

## Existing record compatibility

Canonical marked programme/theme and activity saves supersede stale raw legacy fields, including deliberate empty values. Unmarked and malformed historical content retains its existing fallback. No source record is migrated, duplicated or deleted.

Historical Badgework intentionally merges compatible legacy sources, as required by the existing regression contract. Those old records continue to merge. A new complete canonical Badgework save includes `authoritative: true` inside the existing `weekly-badgework-v1` JSON string. That full snapshot contains all imported rows unless deliberately edited/removed, and then supersedes stale legacy Badgework fields. This distinguishes an intentional clear from an old partial mixed record. There are no new top-level fields, Rules changes or migration. Both OFF and ON use the same service and adapter, so toggle rollback preserves the same saved content.

## Assurance and integration

Full quality:checks passed (924 unit tests, backend/worker tests, contracts and build). Unit coverage verifies canonical/legacy compatibility, explicit clearing, historical Badgework union, closure write order, leader/meeting rejection and the background-write barrier. Actual demo Firebase emulator testing passed 39 desktop/mobile journeys with zero retries and five unchanged desktop-only mobile skips. All 14 new lifecycle cases passed, plus shell/setting matrix and existing copy, reopen, roster/history/role regressions. Local diagnostic Chromium153; pinned PR CI remains required.

The lifecycle PR targets current main independently of SW-422 #937 and SW-423 #938. At integration, retain SW-422's `persistWithIncident` in the now boolean-returning close callback, keep its pending-incident condition on background saving, and retain SW-423's saved tracker handoff/Review return. SW-425 must validate the combined tree, including pending-incident closure and tracker navigation; standalone PR assurance does not substitute for this integration gate.

Deployed TEST and owner Production Manual Testing remain separate pending gates. No merge, Done transition, Production deployment or redesign enablement is implied by these checks.

## Exact-head CI repair

PR head 23bb9708 failed the mobile SW-390 journey before its editor test: Create Event awaited loadEvents(), which hydrated unrelated audience memberships solely for an identity-duplicate check that already always returns false. Creation now loads only its permitted member/audience data. Duplicate policy, permissions and existing save/navigation assertions are unchanged. A new desktop/mobile readiness regression rejects unrelated event/audience reads. Full quality:checks passed again; real demo emulators plus the local event backend passed 40 browser cases with zero retries and two unchanged project skips, including the original failed journey. No budgets, waits, assertions or retry settings were weakened. Fresh pinned CI remains required.
