# SW-563: shared source reservation transaction

Jira: https://kfeeney1.atlassian.net/browse/SW-563
Integration owner: SW-560. Depends on merged SW-562 / PR #956.

Manual Council bookings and trusted source writers now call the same reservation
writer. It reads the union of old/new Dublin day buckets, checks half-open intervals,
and stages the resource lock, private reservation, neutral availability, immutable
history and audit record. Existing recurrence, exceptions, DST validation and bounds
apply to both paths. The source wrapper never checks the rollout switch: source
conflicts must remain effective while Hall Hire is disabled.

## Server adapter contract

`saveSourceHallReservation(store, uid, kind, id, prepare)` is an internal server API,
not an HTTP action. Kinds map explicitly to canonical weeklyMeetings, events and
maintenance/group/appointments. The full source path is hashed into a stable private
reservation ID. A reservation is a resource index owned by the canonical record,
not another editable meeting/event/task. Hall administration rejects source-owned
changes. Wrong ownership fails closed for reconciliation.

Before calling, verify the user identity. On every transaction attempt, `prepare`
must read the current source permission records and enforce its canonical revision,
then return `authorised: true`, an explicit occupancy allowlist and a `persist`
function. It must not accept browser authority, infer occupancy from location text,
or treat Council hall permission as programme permission. The wrapper reads the
current source inside the transaction and supplies it to prepare. The entire
callback reruns after confirmed Firestore ABORTED responses.

Occupancy contains only resourceId=group-hall, kind, state, interval and optional
bounded recurrence/exceptions. Map canonical cancellation/non-hall/removal to null.
Null releases an existing reservation; no reservation is created for an unoccupied
source. Canonical removal is staged using tx.delete in persist. No independent
network writes, external effects or reads belong in persist. Limit canonical writes
to 16: 240 affected days consume at most 484 reservation/audit writes, leaving 16
under Firestore's 500-write ceiling. The REST store enforces the total ceiling.

All source reads and permission/revision checks must complete before persist. A
failed conflict, source check, canonical write or audit precondition aborts the
whole transaction. Private source titles, notes, participants and contacts never
enter this mapping: source reservations use a generic label and empty details.
Public availability contains occupied start/end ranges only.

## Remaining integration and activation

This PR exposes no new workflow and changes no source editor or source rules.
SW-560 still must implement each canonical server adapter, explicit resource/time
fields and editors, close every direct source-write bypass (including delete,
cancellation and rescheduling), and reconcile legacy records with owner-confirmed
resource/time facts. Free-text locations are insufficient evidence. The existing
source permission model must remain authoritative.

Readiness stays false. Neither this internal primitive nor green CI establishes
complete source integration or deployed Firebase TEST acceptance. No service,
scheduler or paid dependency is added. Rollback is reverting this PR while rollout
is off; never delete booking/index/audit records as rollback. Once source adapters
are deployed, any rollback must retain their conflict controls.

## Verification and later Android PMT

Automated coverage includes off-state source lifecycle, ownership, authority
failure, recurrence exception release, private projection filtering, manual/source
conflicts, adjacency, and all-or-nothing persistence. Real Firestore tests exercise
simultaneous source/manual writes, atomic source deletion and failed audit rollback.
Full repository quality and existing hall regression must pass.

After remaining integration and deployed TEST acceptance: on Android at 320px,
create a hall source, try an overlapping manual booking, move/cancel the source,
verify neutral availability, switch off and confirm source conflicts still apply.
Also verify non-Council programme access remains unchanged. These are future PMT
steps, not recorded passes. No Production deployment is authorised.
