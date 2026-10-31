# SW-164 Hall Hire delivery contract

Reconciled against main `dabd334b` on 29 October 2026. The current owner instruction supersedes the September deferment. No applicable AGENTS.md, epic attachments, linked issues or pre-existing children were found initially. Owner subsequently approved the layout, neutral availability display and enquiry-not-confirmation workflow. Council membership derives from active appointments above Section Scouter, with the explicit mapping below agreed. Missing factual venue content remains unpublished.

## Delivery and gates

| Ticket | Focus | Dependency |
| --- | --- | --- |
| SW-554 | Approved layout/workflow and Council mapping; outstanding venue facts | Unknown factual content stays unpublished |
| SW-555 | Pure bounded booking/time domain | Independent, this PR |
| SW-556 | Authoritative reservation boundary, privacy rules and audit | SW-555 and agreed permission scope |
| SW-557 | Independent Superuser switch | SW-556; keep activation gated until complete |
| SW-558 | Scoped leader administration | SW-554, SW-556, SW-557 |
| SW-559 | Public availability and enquiry | SW-554, SW-556, SW-557 |
| SW-560 | Canonical source integration and calendar navigation | SW-556, explicit source resource/time contract |
| SW-561 | Integrated regression, TEST acceptance and Android PMT | All implementation children |

SW-555 adds no routes, writes, rules, deployment or feature activation. Its overlap helper is not an authoritative conflict control. The public allowlist function does not itself create a privacy boundary: SW-556 must protect private collections and persist/read only the restricted representation for anonymous access.

## Implemented domain policy (SW-555)

- Resource: explicit `group-hall`; no free-text location matching.
- States: draft (no occupancy), confirmed (occupied), cancelled (no occupancy). Blocked periods use confirmed state with blocked kind. Enquiries are separate requests and cannot confirm bookings. Persistence revisions, actor metadata, source ownership and audit belong to SW-556.
- Dates: canonical ISO date-only storage, years 2000–2099. Display through existing DD-MM-YYYY formatting. Local times: strict HH:mm in Europe/Dublin.
- Intervals: half-open `[start,end)`. Adjacent bookings are allowed. Overnight intervals use an explicit end date; maximum seven local calendar days per occurrence. Real elapsed duration follows DST.
- Weekly recurrence: start occurrence plus every seven days, inclusive until date, at most 366 days / 53 occurrences. No rolling infinite materialisation. Each occurrence resolves its local times separately, retaining wall time across DST.
- Ambiguous autumn and missing spring local times fail validation; the user must select an unambiguous time or cancel/replace that occurrence. No silent offset selection.
- Exceptions: keyed by original occurrence date, unique and within the series. Cancel or replace a single interval without changing the original occurrence identity. A replacement may move at most 366 days from its original date. Reject self-overlapping series.
- Public output: exact start/end ISO instant fields only, with no booking ID, source ID, kind, section, title, purpose, contact, notes or member data. Public display must convert these instants to Dublin date/time and split overnight intervals by local day.

## Existing integration points and proposed ownership

`calendarSourceLogic.ts` explicitly adapts date-only weekly meetings and events. `eventAdmin.ts` uses a free-text location; maintenance appointments have free-text location and local date/time. None is a reliable declaration of hall occupancy. Unknown locations must not silently become hall reservations or all-day blocks.

Add explicit hall resource and interval fields to canonical source records through SW-560. Canonical meetings/events/maintenance own their schedule and cancellation state. Their reservation projection must have a deterministic source reference and cannot be edited independently through hall administration. Standalone hires own their booking and recurrence. A series has one bounded rule plus exceptions, rather than an unrelated set of editable bookings.

All relevant source write paths, including direct/legacy saves and removals, must join the same conflict protocol before enablement. Reconciliation should compare deterministic source references and revisions, repair derived occupancy only from canonical records, and report unresolved missing times or historical clashes. It must not copy protected programme content into public availability.

Reuse `CalendarPageLayout`, `CalendarMonthToolbar`, shared calendar date/grid utilities, theme tokens, Header/emblem and Footer. The existing group grid contains protected source links, so public occupancy requires a restricted renderer rather than passing private entries to it. Hall navigation must reuse group calendar state conventions.

## Authoritative backend (SW-556)

The existing Worker now exposes authenticated POST `/hall-bookings` for save, paged list and paged history. Firestore validates the user's ID token on a user-scoped profile read before any private read or write. The transaction independently re-reads the current account and organisation appointments, so stale browser claims and revoked Council assignments cannot authorise an action. Client access to all private `hall` data is denied, including for Council members: use the Worker boundary.

The REST transaction reads `hall/group`, authoritative account/appointments, rollout setting and expected booking revision. It reads the union of old/new Dublin-day reservation buckets, detects overlaps against other bookings, and atomically writes booking, indexes, neutral public daily availability, immutable private history and the existing auditLog representation. Updating the shared resource revision serialises concurrent writes. Confirmed provider ABORTED responses use at most five native transaction attempts with retryTransaction priority; each attempt re-reads authority, revision and occupancy. Other failures, including ambiguous commit outcomes and audit preconditions, are not replayed. Exhausted contention or a detected overlap returns a conflict for explicit user review. Read-only paged private reads use snapshot transactions without taking the write lock.

Transactions touch at most 240 unique day buckets, with two writes per day plus four metadata/audit writes (484 maximum, below Firestore's 500-write boundary). Each day is bounded to 300 occupied intervals; requests are streamed with a 32KiB cap. Index corruption fails closed. Public day projections split overnight intervals at Dublin midnight and contain only `occupied: [{start,end}]`; document IDs are dates, not source/booking identities. Public reads require both rollout enabled and readiness true, and lists are limited to 31 documents per request.

No new service, API provisioning, scheduled job or subscription is introduced. The existing Worker and Firestore incur their normal per-request/read/write usage; this does not promise unlimited free usage on the existing Blaze projects. Nothing has been deployed by this work.

`hall/group.ready` remains absent/false until SW-560 integration and integrated acceptance. No client can write this field. The rollout switch alone cannot expose incomplete workflows. Source-owned reservations cannot be independently edited through hall management. Authoritative source reservation integration itself remains SW-560 and is not implemented by SW-556.

The following source-integration protocol remains required:

Use the existing Firestore infrastructure and authenticated application boundary. A transaction must read authoritative actor profile/scope, expected revision, the shared resource lock and bounded occupancy before writing canonical changes, reservations, restricted availability and immutable audit together. Every successful mutation updates the same resource lock so concurrent overlapping submissions retry and re-evaluate against committed occupancy. Deny alternative direct writes unless rules can prove the complete invariant. Client overlap previews are advisory.

The existing maintenance appointment transaction controls record revision, not cross-source resource overlap. `recordAuditEvent` is best-effort client logging and is insufficient for an atomic booking audit requirement. Extend/reuse the audit representation with an authoritative transactional write. Existing `functions/src/handler.js` is TEST-specific; do not repurpose or deploy it as a production hall backend. Choose a compatible existing boundary after reviewing environment deployment and no-new-charges constraints. No new service, API, scheduled job or paid dependency is introduced here. Any unavoidable incremental cost dependency must be surfaced before implementing it.

Agreed permission scope: current Section Leaders, Assistant Section Leaders, Group Leader, Deputy Group Leader, Group Secretary, Group Treasurer, Group Quartermaster / Bo'sun, Group Chairperson, Group Youth Champion and Group Trainer manage all hall bookings group-wide. Scouters and Programme Scouters do not. System Admin/Superuser alone does not imply Council membership. Inactive, future, expired, malformed and revoked assignments fail closed. No separate Council assignment is introduced. Superuser alone controls rollout. Programme/member permissions remain independent.

## Approved public design and outstanding factual content

The reviewable layout is the six-part epic proposal: existing public header; hall introduction/image with Check availability; confirmed facilities; monthly time-slot availability with enquiry panel beside it on desktop/below on mobile; location/contact; existing footer. Occupied markers show times only; blank time is available subject to enquiry and subsequent confirmed reservation.

Owner approved the layout and enquiry-not-confirmation workflow. Approval did not supply an image, venue facts or a named enquiry recipient. Use only verified existing contact configuration where appropriate; unknown facilities, capacity, accessibility, prices and policies stay unpublished. The Ballinteer page is a functional reference only and has not been used as evidence of this venue's facts. No sample claims are published. An acknowledgement must explicitly state that availability/enquiry is not booking confirmation.

## Rollout and rollback (SW-557)

Independent existing-configuration switch labelled **Hall Hire**, no explanatory blurb. Missing/malformed/unavailable setting defaults off. Only authoritative Superuser access can change it. Do not expose a partially working enabled flow. Off removes feature navigation/access while preserving bookings and audit; reservation conflict controls for existing bookings remain active. Rollback switches presentation off, never deletes reservations or restores unsafe legacy source writes. TEST acceptance must exercise rollback with live test reservations.

## Assurance status

SW-555 tests cover spring/autumn DST, gap/fold rejection, inclusive recurrence bounds, bad dates/times, cancellation/replacement, self-overlap, adjacent intervals, overnight elapsed duration and exact public field allowlisting. These are domain tests only; they do not establish deployed privacy, permission enforcement or concurrent write safety.

SW-556/SW-560 must add rules/emulator and transaction integration coverage for concurrent overlapping submissions (exactly one commits), stale edits, atomic failure/audit, cross-source races, one-off/series/exception/blocked conflicts, unauthorized direct access and scoped lifecycle. SW-558/SW-559 must add responsive accessible E2E and both rollout states. Keep normal complexity ceilings and existing regression assurance.

### Android PMT plan — pending deployed TEST, not ready to execute

1. At 320px and normal Android width, verify Group emblem, theme, month controls, visible focus, keyboard access and no horizontal overflow.
2. Signed out, check multiple occupied slots and remaining time; ensure no private details in page, network responses or direct Firestore access.
3. As permitted leader, create/edit/move/cancel a one-off and weekly series; cancel/move one occurrence and verify the rest remain intact.
4. Submit overlapping bookings in two sessions; verify one fails clearly and adjacency succeeds. Include blocked time and explicit hall meetings/events/maintenance.
5. Verify updates/cancellations immediately affect public availability; an enquiry never confirms a reservation.
6. Verify section/private read limits and denied parent/unauthorized writes. Switch off/on as Superuser; existing pages remain usable and records/conflict protection survive.
7. Record exact deployed TEST revision, results and cleanup. Production PMT and production deployment remain separate and require their own authorisation.

## TEST transport reconciliation (SW-570)

After #965, deployed TEST frontend metadata matched merged main, but TEST intentionally disables the email API also previously required by the booking client. [SW-570](sw-570-test-hall-transport.md) separates TEST booking transport using an isolated booking-only Worker entry and guarded manual deployment. Firebase Functions remain blocked; Production Worker configuration stays unchanged. Account Free-plan/quota verification, actual endpoint/TEST credentials and controlled deployed acceptance remain outstanding. Missing configuration and readiness retain the existing disabled experience. No real source classification, feature activation or Production acceptance is inferred from merged implementation.

## Controlled TEST acceptance setup (SW-571)

[SW-571](sw-571-hall-test-rehearsal.md) adds a distinct private TEST rehearsal plan/start/stop after source reconciliation and exact frontend/Worker preflight. It leaves rollout off, records no acceptance/baseline, and blocks final publication until explicitly stopped. Shutdown turns readiness/rollout off while preserving records. Account/backend configuration, actual source-owner facts, executed deployed TEST checks and Android/Production PMT remain separate outstanding work. No live activation or acceptance is inferred.
