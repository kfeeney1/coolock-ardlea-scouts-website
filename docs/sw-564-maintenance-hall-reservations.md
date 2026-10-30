# SW-564: canonical maintenance hall reservations

Jira: https://kfeeney1.atlassian.net/browse/SW-564
Epic SW-164; integration owner SW-560. Prerequisite SW-563 / #959 is merged.

## Behaviour and ownership

Existing maintenance appointments and linked task appointments gain an explicit
`hallResource: "group-hall"` choice. Free-text location never implies occupancy.
New choices appear only for current Council when Hall Hire is enabled and ready.
The existing appointment editor, dates, theme tokens and leave guard are reused.

Canonical appointment data remains in maintenance/group/appointments. The shared
reservation is a resource index with a deterministic source owner and generic
label, not another editable maintenance record. Public availability contains only
occupied ranges. Existing hall administration links maintenance reservations to
the canonical appointment/task page, whose existing access controls still apply.
No programme/member read rights are granted by Hall Hire.

Hall saves use maintenance-save through the existing authenticated Worker route.
The transaction re-reads Council authority, active leader account, canonical
Maintenance membership reference, Calendar/Maintenance settings, current source
revision, linked task (if applicable) and resource lock. Council alone is
insufficient when Calendar or Maintenance is disabled. A task appointment cannot
change its owner. Canonical appointment, reservation, indexes, public ranges and
immutable reservation/audit history commit together. Conflicts/stale revisions
retain form values. Identity is verified by Firestore before private writes.

Ordinary non-hall appointments retain their existing SDK persistence and existing
group-member permissions, including approved parents. Both existing and proposed
hall/cancelled source records reject direct SDK writes. Dropping hallResource,
changing dates, restoring cancellation or deleting cannot bypass the server.
After a successful explicit release (uncheck the resource), the canonical source
again becomes an ordinary appointment; future edits follow existing permissions.
A stale ordinary editor cannot overwrite a concurrently hall-marked source.

Existing hall sources may be rescheduled, released or cancelled through this
boundary while Hall Hire is off; all conflicts still apply. Adding a *new* hall
source requires enabled + authoritative readiness. The off switch never deletes
records, indexes or audit history. All-day occupancy spans the actual Dublin
midnight-to-midnight day (23/25 hours at DST); ambiguous/gap local times fail.

Cancel hall appointment has a confirmation and retains the canonical record with
cancelled=true, releases its occupancy and removes it from the monthly calendar.
Saving a cancelled source restores it and checks conflicts. Linked task content
and completion do not own the appointment interval: completing a task does not
silently release its scheduled slot. A task schedule can explicitly release hall
occupancy through its resource choice. Source hard deletion remains prohibited.

## Validation and rollout

Meaningful Worker coverage checks canonical/source revisions, privacy, source task
ownership, revocation/settings/membership, off-state changes and DST. Real Firestore
coverage checks direct-write denial, ordinary parent scheduling preservation,
simultaneous maintenance/manual writes (exactly one commit), cancellation and
revoked source authority. Existing hall privacy/audit/concurrency regression also
runs. Browser coverage forwards requests to the real handler and emulator rather
than stubbing save/conflict outcomes; it checks keyboard controls, retained conflict
edits, confirmed cancellation and Android Chromium at 320px. Browser execution is
pending CI where local Chromium cannot launch under workspace socket policy.

The shared backend already exists; no service, scheduler or paid dependency is
added. Backend deployment/configuration to Firebase TEST's existing Worker and
exact-revision acceptance remain separate work under SW-561. No Production deploy
is authorised. Readiness stays false until meeting/event adapters, source-write
bypass protections, explicit legacy resource/time reconciliation and integrated
TEST acceptance are complete (SW-560/SW-561).

Rollback: keep Hall Hire off and retain the authoritative source writer and the
rules protecting hall-marked records. Do not revert those protections or remove
source/index/audit records while any hall-marked sources remain. Revert presentation
changes separately if necessary; never restore a direct-write bypass as rollback.

## Android PMT after deployed TEST acceptance

- At 320px, enable only on TEST after readiness; keyboard-focus the hall choice.
- As Council with Calendar/Maintenance access, create and reschedule a hall source;
  verify one calendar entry and neutral public occupied ranges.
- Submit overlap/adjacency; reject overlap and retain edits, allow adjacency.
- Cancel, confirm release and retained source; restore and recheck conflicts.
- Switch Hall Hire off: preserve records and continue enforcing source conflicts.
- As a non-Council member/parent, retain ordinary non-hall scheduling; deny hall
  writes and verify no new protected programme/member access.
- Restore original TEST switches and remove only owned synthetic data. Record
  exact revision/results. These are planned checks, not Production passes.
