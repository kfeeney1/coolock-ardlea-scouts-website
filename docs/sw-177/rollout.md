# SW-177 schedule experience rollout

The Superuser setting **Weekly Meetings and Events experience** stores one group-wide
`siteSettings/scheduleExperience` document. It is independent of
`siteSettings/leaderNavigation`. Missing, malformed or failed reads retain Existing.
Only an active canonical Superuser may write a valid version with their own UID and
server timestamp; authenticated users read this non-sensitive presentation setting.
The existing settings audit metadata (`updatedBy`, `updatedAt`) records the latest
change. No new historical audit collection is introduced.

Keep Existing selected until SW-197 acceptance is complete. As integration children
land, both schedule pages subscribe to the same server-confirmed choice. No refresh
is needed; the choice persists across sessions. Existing open record editors retain
their lifecycle, unsaved-change and permission behavior.

Rollback: Superuser → Settings → Weekly Meetings and Events experience → Existing
schedules. Confirm the selected state, revisit both list pages and reload to check
persistence. This requires no deployment and writes no meeting/event records.
Do not change the independent navigation setting during rollback.

Development/CI, exact deployed SHA TEST acceptance and Production Manual Testing
are separate gates. A green PR is not permission to enable production.
