# Existing task scheduling (SW-338)

Calendar → Schedule maintenance task reuses the existing paginated task list.
The source Maintenance task also offers Schedule task / Reschedule task when both
Calendar and Maintenance permit it. These actions never create another task.

The canonical appointment has `taskId` and ID `task-{taskId}`. Its title is empty;
only date/time, optional appointment location/notes, revision and audit metadata
are stored. Rules reserve the task namespace, require the task to exist, prevent
retargeting and reject copied assignment/status/description fields. Concurrent
schedules and reschedules use the same transaction-protected record. Standalone
appointments retain their existing format and cannot become linked task copies.

Month queries remain date-bounded. A single live listener for each referenced
task supplies its current description, responsible leader and status. Titles use
a concise first line with full details available from the individually clickable
entry. The link opens `/maintenance/tasks/{taskId}`, preserving the month/type/
section return context. Documents, assignment and completion remain in the
existing Maintenance workflow. Scheduling never changes task status.

Missing tasks show an explicit unavailable source without stale task text. Task
details and canonical Maintenance membership are observed live, so source changes
and revocation clear cached content. Existing Leader/Parent/member role unions
are revalidated; authentication alone is insufficient. Both independent rollout
options and canonical membership are enforced by routes and underlying Rules.
Disabling Calendar removes schedule actions and return links while preserving
normal authorised Maintenance task access. Disabling Maintenance hides task and
appointment capability; canonical records remain intact.

Development assurance and PR CI are separate from live Firebase TEST and
Production Manual Testing. Calendar must remain off until TEST acceptance is
complete. Verify paginated choices, schedule/save, live source changes, exact
source routes, status/leader display, rescheduling without duplicates, source
removal/recovery, documents, return filters, browser/Android Back, membership
revocation, both toggles, mobile wrapping, keyboard/focus and light/dark themes.
Use the TEST and rollback steps in `group-calendar-rollout.md` and
`maintenance-appointments.md`; no additional API, backend, email service or paid
calendar dependency is introduced. Existing Firebase services do not guarantee
a zero total bill.
