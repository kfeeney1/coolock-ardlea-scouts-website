# SW-572 — Hall Hire regression and Android acceptance

[SW-572](https://kfeeney1.atlassian.net/browse/SW-572) contributes to [SW-561](https://kfeeney1.atlassian.net/browse/SW-561). Automated emulator checks are development assurance. They are not deployed Firebase TEST acceptance or Production Manual Testing (PMT).

## Current boundary

Reuse the existing Firebase projects, authoritative Worker booking handler, configuration switches, audit records and site themes. TEST email stays disabled. No new token, subscription or paid service is requested by this change. The earlier new-token wizard is superseded by the owner's instruction to reuse existing infrastructure. The isolated TEST Worker currently lacks TEST service-account bindings; its frontend URL or health metadata alone cannot establish a functioning booking workflow. Do not enable Hall Hire against that incomplete backend. Production deployment still requires explicit authorisation.

## Before testing on Android

Use TEST first, with a verified working backend at the same reviewed revision as Hosting. Record the frontend and Worker commit IDs, date, Android/Chrome versions, viewport, tester and account roles in SW-561. Use synthetic hirer/contact/notes only. Never paste identity tokens, credentials or member information into evidence.

The operator must confirm source hall use, reconcile existing records, and use the existing [rehearsal plan/start procedure](sw-571-hall-test-rehearsal.md). Do not guess hall location/resource use, bypass readiness, seed real member data, or label emulator fixtures as live acceptance. Keep the switch off until the controlled session is ready. Prepare Council, Section Scouter and Superuser accounts. Council means active appointments above Section Scouter; a system administrator role alone is insufficient.

## Android checklist

Run in Chrome on the actual phone, portrait then landscape. For a 320 CSS-pixel check, use Chrome desktop responsive mode as additional evidence; that does not replace an actual Android pass. Where an external keyboard is unavailable, record keyboard steps as pending and test them on desktop.

| Step | Action | Expected result |
| --- | --- | --- |
| 1. Off state | With Hall Hire off, open the public site and `/hall-hire`; sign in and open `/leader/hall`. | Existing navigation works; Hall Hire links/private booking workspace are absent. Direct routes explain unavailability. Retained bookings still exist. |
| 2. Rollout permission | As Section Scouter, attempt management and configuration routes; repeat as Council, then Superuser. | Scouter cannot manage hall bookings; Council can manage bookings but cannot change rollout unless also Superuser. Unauthorised direct requests fail. Hall access grants no programme/member access. |
| 3. Appearance | During the authorised TEST session, enable Hall Hire. Open public availability and leader booking pages in all five existing themes: Current, Modern Scout, Irish Adventure, Bold Campaign and Programme Explorer. | Group header/emblem and shared styling remain. No horizontal scrolling, clipped controls or overlapping text at 320px, phone width or desktop. All actions remain reachable. |
| 4. Calendar controls | Activate Check availability; use Tab/Shift+Tab and Enter/Space on a date and previous/next month; return with Today. | Visible focus; selected date is announced; date selection focuses its time details. Month controls retain focus after live availability loads. Month/date labels follow DD-MM-YYYY and Europe/Dublin. |
| 5. One-off lifecycle | As Council create a confirmed synthetic booking, edit its time/details, then cancel it. Also save a draft and a blocked period. | Save/history confirms each change. Draft reserves nothing; confirmed/blocked periods reserve time; cancellation releases it. Public availability updates without refresh and audit records remain. |
| 6. Recurrence | Create a bounded weekly series; move one occurrence, cancel another, then edit/cancel the entire series using the explicitly labelled action. | Only the selected occurrence changes; other dates remain intact. Series actions are distinct. Exceptions and audit history survive subsequent edits. |
| 7. Conflicts | In two signed-in sessions submit overlapping times simultaneously; test a recurring occurrence, exception, blocked period and an explicitly hall-linked meeting/event/maintenance appointment. Then book exactly at a preceding end time. | At most one overlapping submission succeeds; rejected edits are retained. Relevant sources share conflict checks. Adjacent bookings succeed using `[start,end)` boundaries. Non-hall activities do not reserve the hall. |
| 8. Dublin clocks | Use synthetic weekly series spanning the next March/October clock change; try a nonexistent or ambiguous local clock time. | Ordinary weekly local times stay fixed through the offset change. Invalid/ambiguous clock times fail clearly. No unlimited occurrence generation. Record chosen dates and observed UTC offsets. |
| 9. Privacy and enquiry | Open an anonymous browser with two occupied slots on one date, select it, then open the email enquiry action. | Only neutral occupied time ranges and remaining unreserved ranges appear. No purpose, hirer/contact, notes or programme/member data in page or responses. Email draft contains requested times; no booking confirmation is implied. Cancel the draft unless sending is separately intended. Unconfirmed venue facts stay absent. |
| 10. Linked records | Create/reschedule/cancel an explicitly hall-linked source through its original editor; attempt a conflicting change and repeat with a non-hall source. | Availability remains consistent; protected source scope is enforced. Hall list links back to the owning editor. No duplicate manual booking is created. Existing programme and parent flows work. |
| 11. Navigation and errors | Edit a booking, use Back, exercise Stay/Discard/Save, and interrupt a save or cause a conflict. | Unsaved changes are guarded, error feedback is accessible, edits remain after failure and a success message appears only after a successful write. |
| 12. Shutdown | Switch Hall Hire off, then stop the controlled TEST rehearsal through the existing operator procedure. Recheck public and direct management routes. | Feature/readiness shut down; bookings, source links, day indexes and audit history remain. Existing reserved source edits/releases remain protected by authoritative conflicts. |

## Evidence and cleanup

Record each row as Pass, Fail or Blocked with actual observations and screenshots where useful. Add booking/source IDs and revision numbers without private content. Automated backend/security tests remain necessary: UI observations alone do not prove direct-request privacy, scoped permissions or concurrent-write safety. Record backend and browser evidence separately.

The authorised operator cancels synthetic reservations through their owning workflow, stops the TEST rehearsal, verifies both rollout/readiness are off and runs the existing read-only reconciliation audit. Preserve booking/audit history; do not delete indexes or relax rules as cleanup. Record any source changes and unresolved blockers. Restore temporary theme preferences. See [rollout rollback](sw-557-hall-hire-rollout.md) and [source ownership/reconciliation](sw-568-hall-reconciliation.md).

A TEST pass requires completed deployed checks and genuine SW-561 evidence. Production PMT is a separate run after an explicitly authorised Production deployment; copy this checklist with actual Production revision/device evidence. No pass or Done status follows solely from this document, emulator results, merges or green CI.
