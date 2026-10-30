# SW-566 — authoritative event hall reservation foundation

Jira: https://kfeeney1.atlassian.net/browse/SW-566

## Ownership and permissions

`events/{id}` remains the canonical programme, consent and audience record. A hall reservation is an explicit resource index owned by that source, using the shared digest identity and lock from SW-563. Never infer hall use from a location string, event type or section. No additional calendar/event or member record is created.

The existing authenticated Worker `/hall-bookings` action `event-hall` accepts only source ID, expected hall revision, expected source start/end dates, and either a local interval or `release: true`. Identity is verified before the transaction. Active Council membership and the canonical direct event `hasSection` write scope are both required; a group appointment alone does not grant programme rights. Admin/Superuser still need Council membership. Appointment-only event read access does not become a new direct programme write grant.

The transaction rereads authority and the current event. It checks dates/revision, then uses the same manual/meeting/maintenance conflict lock, neutral public projection and immutable audit. Private title, audience, attendance, consent and leader notes never enter the reservation. Only hall metadata, revision and actor/timestamp are patched, with an exists precondition. Parent programme, memberships, notifications and communication are untouched.

## Schedule and lifecycle

An open or closed event can reserve an explicit Dublin interval within its canonical inclusive date range. Shared validation enforces valid unambiguous local times, at most seven date boundaries and half-open `[start,end)` semantics. An event may span longer, but a single hall interval remains bounded. No recurring event records are generated.

Existing hall use can move within the event dates even with rollout switched off. Release also works off-state and for completed/draft events. Release retains the event and reservation/audit history; it removes hall resource/interval metadata and empties its occupied time. Event completion/closure is not cancellation and retains occupancy until explicitly released, including historical time. New hall reservations require rollout and readiness.

Release hall use before changing an event's dates or section through the existing editor, then reserve the new time. A competing booking may take the released time; a subsequent conflict must be resolved explicitly. This foundation deliberately does not mutate source dates, audience membership dates or parent programme projections.

Both direct Firestore event updates and the existing shared backend event writer prohibit date/section changes while marked. Direct creates cannot manufacture hall metadata. The backend keeps its existing source `updateTime` precondition, so a concurrent reserve invalidates an ordinary edit that read an unmarked source. Conversely the hall transaction rereads and rejects stale source dates. Ordinary programme/consent/status updates retain their existing rules and behavior.

## Delivery and rollback

This is an independently testable backend foundation; event editor controls and source navigation follow separately. Keep readiness false until those controls, legacy resource/time reconciliation and SW-561 acceptance are complete. No UI action is exposed by this PR. Do not manually mark existing records or import free-text locations. Confirm which sources occupy the hall before activation.

Use the existing concise Superuser Hall Hire switch to turn the feature off; keep the source writer and rules deployed while marked records exist. Removing only the write protections would allow stale occupied time. Removing the writer would strand off-state release. No new infrastructure or ongoing service charge is introduced; existing transaction/read/write usage applies. The separate TEST-specific event backend remains TEST-specific.

## Acceptance boundaries and Android PMT

Local unit/Worker/backend and Firestore emulator results are development assurance. GitHub Actions, deployed Firebase TEST and Production PMT are separate evidence. No Production deployment is authorised and no issue is Done based on this implementation.

After the event controls are delivered and Firebase TEST is configured, verify on Android at 320px and desktop:

- Council with source scope can reserve/move/release; Council without programme scope cannot read or mutate the source.
- Explicit Dublin dates/times display DD-MM-YYYY; keyboard/focus and accessible controls work in all themes.
- Source/manual conflicts reject, adjacent times succeed, and concurrent submissions produce one winner.
- Event rescheduling requires release; programme/consent/audience and communications continue normally.
- Public slots remain neutral; release updates availability; off/on preserves records and off-state conflict protection.
