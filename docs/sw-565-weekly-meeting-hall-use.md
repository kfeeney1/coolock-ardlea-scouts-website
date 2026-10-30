# SW-565: scoped weekly meeting hall use

Jira: https://kfeeney1.atlassian.net/browse/SW-565
Epic SW-164; integration owner SW-560. Follows merged SW-563/#959 and SW-564/#960.

## Explicit resource and source ownership

A saved weekly meeting can explicitly reserve the Group hall using the Hall use
panel. The date comes from the canonical meeting; start/end times must be entered.
Neither location text, section name nor planned programme duration infers occupancy.
Creation/copy retains its existing programme workflow; reserving hall time is an
explicit action after saving the canonical meeting. No source records are generated
by a recurrence job. Existing bounded manual booking series remain supported.

The canonical weeklyMeetings record owns meetingDate, hallResource=group-hall,
hallStartTime, hallEndTime and hallRevision. The shared reservation is an internal
resource index, with generic labels and no programme/member/incident details.
Public availability contains only occupied time ranges. Source links open the
existing protected meeting route and confer no programme access.

The authenticated meeting-hall action accepts only source ID, expected source
hall revision/date, proposed date/times or an explicit release. It verifies the
identity, current Council authority and the existing canonical weekly section/
group write scope. A Council appointment alone never grants another section's
programme access. Active canonical Admin/Superuser programme scope remains as it
was, but those roles alone still do not confer Council membership.

Every native transaction attempt re-reads the current programme source and
permissions. It patches only explicitly owned schedule fields, preserving current attendance,
badges, incidents, private notes, creator, timestamp types and unrelated fields
rather than accepting a browser programme snapshot. Native update masks require
the source to exist, so a removed source cannot be recreated by a stale save.
A date move updates the canonical meeting and existing safe parent programme
projection atomically with private occupancy, neutral public ranges and audit.
Missing/stale/unsafe legacy parent projections block date moves for reconciliation;
private programme notes are never used to invent a replacement public projection.

New reservations require enabled + authoritative readiness and an open meeting.
Existing source moves/releases retain conflict protection while Hall Hire is off.
Meetings use an explicit same-day Dublin interval; gap/fold times are rejected,
end must follow start, and adjacent reservations remain allowed.

## Programme preservation and cancellation/deletion

Ordinary scoped programme, attendance, notes, closure and reopening writes continue
through their existing SDK paths. Those writes cannot change a hall-marked date or
protected hall metadata. The ordinary date picker is disabled for marked sources;
use Hall use for a conflict-checked date change. Source and parent date tampering
are denied by Firestore, including direct SDK requests.

A hall schedule draft blocks simultaneous programme edits, and pending programme
edits must be saved before changing hall use. Existing Save/Discard/Stay is reused;
conflicts retain the proposed schedule. Successful in-place saves consume the guard’s
owned Back entry before refreshing, avoiding an extra Android Back stop. If rollout is disabled during a draft, the
draft remains visible and can be discarded without trapping the meeting editor.
All existing themes/header/emblem/date mechanisms are retained.

Release hall has an explicit confirmation. It cancels only the resource reservation,
retains the meeting/programme and frees the slot. Closing a meeting records its
programme lifecycle and does not imply that the physical reservation was cancelled.
Reopen a closed meeting before moving its reserved time; release remains available
with current source/Council rights.

Marked closed meetings and their parent projections cannot be deleted directly.
Future-closed cleanup warns about reserved hall time and checks again before any
child deletion. Release the hall explicitly first, then ordinary authorised cleanup
can remove the unoccupied source. Reservation/audit history is retained. Existing
ordinary source creation, copying, dates and cleanup retain their original paths.

## Verification and remaining work

Worker tests cover scoped Council authority, programme preservation, stale date/
revision rejection, off-state changes, release, legacy projection reconciliation
and DST ambiguity. Real Firestore tests cover ordinary non-Council programme edits,
closure/reopen preservation, direct schedule/metadata/delete bypass denial, protected
section reads, actual source/manual concurrent conflict, and atomic parent dates.
Browser coverage forwards requests to the real handler/emulator for scoped Council,
320px/keyboard, rollout-off draft retention/discard, conflict retention and confirmed
release. Local browser execution remains unavailable under the workspace Chromium
socket policy; CI execution is separate from local test discovery.

SW-560 still owns event integration, legacy resource/time confirmation and overall
reconciliation. An existing manual section series and an explicit meeting source
must not both reserve the same occurrence: resolve the manual occurrence before
linking its canonical meeting. Do not assume all meetings use the hall. No legacy
bulk migration or venue facts are invented here.

Readiness stays false. SW-561 must verify the deployed TEST Worker/configuration,
exact revision, integrated permission/privacy regression and Android PMT separately.
No Production deployment, activation, Done or Production pass is claimed. No new
service, scheduler or paid dependency is added.

Rollback: disable Hall Hire and retain the authoritative writer, source metadata
and rules protecting marked dates/deletes. Do not restore a direct-write bypass or
delete reservation/audit history. Presentation may be reverted independently.

## Planned Android PMT after TEST acceptance

- At 320px, reserve a saved own-section meeting using explicit times; check focus
  and one canonical calendar entry with neutral public availability.
- Move its date/time, verify parent programme date, conflicts and adjacency.
- Verify private attendance, injuries, badgework and notes remain unchanged.
- Try another section's source as Council and own-section writes as non-Council;
  enforce the distinct programme and hall permissions.
- Disable during a hall draft, retain/discard it, then confirm off-state source
  conflicts and explicit release. Confirm cleanup retains marked sources.
- Restore TEST settings and remove only owned synthetic data; record revision and
  outcomes. These are planned checks, not recorded Production passes.
