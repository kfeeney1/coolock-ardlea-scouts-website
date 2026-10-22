# Maintenance service appointments (SW-337)

Service appointments are canonical records at `maintenance/group/appointments`.
They are independent of Maintenance tasks and scouting role appointments. They
contain a title, date, all-day choice or same-day start/end local wall times,
optional location/notes, revision and creator/updater audit fields. Times use
Europe/Dublin; date-only values are never converted through UTC timestamps.
Full numeric dates use the shared DD-MM-YYYY date picker and display formatter.

Calendar and Maintenance must both be enabled, with the current SDK Maintenance
revision, before any appointment read/write is authorised. Authentication alone
is insufficient: Rules revalidate the existing canonical Maintenance membership
reference. Calendar's canonical proof watcher clears UI data and re-registers
Maintenance membership on role/parent/member changes, preserving supported role
unions. Route access, queries and writes all enforce these checks.

The month feed queries one date range for the displayed grid, including spill
cells, and listens for source changes. Entries link to the canonical appointment,
with all-day entries before timed entries. Save uses a transaction with revision
checks and immutable creation metadata. Failed saves retain form details; invalid
fields show inline feedback and focus moves to the first invalid field. Existing
Save / Discard / Stay guards cover Cancel, page links and browser/Android Back.
After saving back to Calendar, the appointment's month is selected with feedback;
compatible filters are retained and incompatible filters are adjusted to reveal it.

Development checks and CI do not establish live TEST or Production acceptance.
Keep Calendar disabled until SW-338 and the epic's TEST acceptance are complete.
For TEST enablement, deploy main, enable Calendar and Maintenance independently,
then verify leader, approved-parent, linked-member and outsider access; validation,
all-day/timed saves, reload, edit/reschedule, Back/Cancel, both option switches,
revocation, mobile wrapping, themes and keyboard/focus. Record TEST evidence
separately from Production Manual Testing. Existing-record Event preparation in
`group-calendar-rollout.md` still applies to SW-336.

Rollback by disabling Calendar removes appointment entry points and blocks source
reads/writes; records remain intact. Disabling Maintenance independently blocks
appointment capability as well. No additional APIs, Functions, paid calendars or
email dependency are introduced. Task linking and task responsibility/status stay
in SW-338 and the existing Maintenance workflow; appointments copy no task details.
