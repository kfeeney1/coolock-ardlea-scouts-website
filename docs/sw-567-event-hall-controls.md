# SW-567 — event hall controls

Jira: https://kfeeney1.atlassian.net/browse/SW-567
Depends on merged SW-566 (#962) and SW-565.

## Existing source workflow

Open an event's existing protected record, then Edit Event. Hall use uses shared theme tokens, date pickers, confirmed-date display (DD-MM-YYYY), Europe/Dublin intervals, the existing authenticated booking client and Save/Discard/Stay leave guard. No free-text location or event classification implies hall use. Times start blank and must be entered explicitly. Hall time must stay within canonical event dates and the bounded seven-day interval model.

Active Council and current canonical direct event write scope are both necessary. The UI gate is advisory; SW-566 verifies identity, current Council/source permissions, source revision/dates and conflicts transactionally. Hall access never grants programme or member access. Existing source navigation goes to `/leader/events/{id}`, whose current read boundary is unchanged.

Save programme changes before changing hall time. A hall draft temporarily disables programme editing/saving; a pending programme draft disables hall actions. Errors/conflicts retain the hall draft. Discard restores even invalid typed dates; Stay retains edits. A successful hall save consumes its own native Back guard entry before refreshing from the source, preserving a single Back action to the previous page.

Hall-marked event dates and section are locked. Release hall time, save the new source dates/section using the existing event workflow, then reserve again. This does not promise the released time remains free: a competing reservation must be resolved explicitly. All programme, audience, consent, communication and parent projection ownership stays with the existing event workflow. Event copy/programme input explicitly excludes hall ownership, interval and revision.

Completion is not cancellation: existing hall time is retained. Completed-event records offer explicit release with confirmation, including while rollout is off; the completed programme stays read-only. Draft events cannot reserve/move hall time until opened, but existing reservations can be released. Release preserves event and audit history.

## Rollout and rollback

New hall actions require enabled/readiness and Council. Off-state existing source moves/releases remain available and authoritative conflicts stay enforced. An off-state unsaved new draft remains visible for discard; otherwise the existing experience is preserved. Venue facts and source ownership are not inferred or backfilled.

Readiness remains false until legacy resource/time reconciliation and SW-561 deployed Firebase TEST acceptance are completed. No new service or ongoing service dependency is added. For rollback, disable Hall Hire through the existing Superuser switch while keeping SW-566 rules/source writer deployed for marked records. Do not remove conflict protections or delete bookings.

## Assurance and remaining acceptance

Development assurance and CI do not constitute deployed TEST or Production PMT. Browser coverage forwards to the actual booking handler, authenticated identity and Firestore emulator; it does not stub booking outcomes. The desktop/mobile case covers permission-gated controls, invalid-date discard, separated drafts, new off-state draft retention, reserve, neutral availability, protected programme preservation, native Back, off-state move, conflict retention, Stay and completed-event release.

After the actual TEST Worker/configuration is verified, Android PMT at 320px plus desktop:

- Check all existing themes, retained Group header/emblem, keyboard navigation, visible focus and date-picker controls.
- Reserve explicit times; test invalid/clock-change dates, adjacency and competing manual/recurring/source bookings.
- Confirm source dates/section stay locked until release; programme/consent/audience saves and communication flows still work.
- Exercise Stay/Discard/Save and single native Back after in-place save; no lost drafts or stale overlays.
- Complete an event and release its reservation from history; confirm public ranges update without identities/purpose/notes.
- Switch off/on: new actions hide, existing source protection/release works, records/audit persist. Verify out-of-scope and direct unauthorised access remain denied.

Legacy canonical hall/time confirmation, integrated source reconciliation, deployed Firebase TEST acceptance and Production PMT remain outstanding. No Production deployment or Done transition is implied.
