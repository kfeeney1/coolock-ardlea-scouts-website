# Attendance History & Insights

Attendance insights are derived from existing closed weekly meetings and completed-event rosters and do not introduce a new attendance collection.

Only events with `status: completed` contribute to historical attendance. This prevents draft, open, or closed-but-not-finalised event responses from being presented as attendance history.

For each active member in the signed-in leader's permitted scope, the page shows:

- completed events relevant to the member's section;
- completed events recorded as `attending`;
- completed events recorded as `not-attending`;
- completed events with no final attendance value beyond the default/invited state;
- attendance percentage calculated only from explicit `attending` and `not-attending` values;
- the most recent completed event with an explicit attendance value.

Ordinary leaders use the same section-filtered Firestore query pattern as Reports & Exports. Admin and Super Admin accounts retain group-wide access. No medical, emergency-contact, parent-contact, or consent-answer data is used by this feature.

A low percentage is an operational signal only. It must not be interpreted as a safeguarding, welfare, disciplinary, or eligibility conclusion without appropriate human context.

## Attendance matrix rollout (SW-260 / SW-259)

Superusers: open **Leader Menu → Settings → Attendance Insights experience**. Choose **Attendance matrix** to add a read-only member × closed-meeting table above the existing member summaries. Choose **Existing attendance** to roll back immediately without changing attendance records. Navigation and schedule settings remain independent.

The group-wide choice uses the existing environment-specific Firebase project's `siteSettings/attendanceExperience` document. `version: redesigned` enables it; missing, invalid or failed settings reads default to the existing view. Superuser-only Firestore writes validate the version and the `updatedBy` / server `updatedAt` audit metadata. A transaction detects conflicting settings changes across sessions.

The table reuses the already-loaded, permission-scoped member roster and weekly meetings: no per-cell requests, new attendance collection or attendance writes. Members use the canonical surname comparator (with the established display-name fallback for records lacking name parts); meetings use date then stable ID. Meeting themes supply titles, with “Weekly Meeting” as the fallback. Full numeric dates use DD-MM-YYYY.

Present and Absent require explicit persisted values. Missing entries, explicit Unrecorded or unknown values remain Unrecorded within the member's sections. Not applicable means the meeting is outside the member's current section memberships; it does not infer historical joining/leaving dates. Only closed meetings contribute; completed-event summaries remain available separately. Section/date/search filters scope the matrix. Changing client payloads cannot bypass the underlying Firestore Rules for members, roster projections or weekly meetings.

One table viewport scrolls horizontally and vertically, retaining row identity and meeting headers. Focus it and use arrow keys; Home/End move to the first/last meeting. Text and symbols accompany colours, and semantic row/column headers identify cells.

### Manual acceptance scenarios

| Jira | One PMT scenario (manual result pending) |
| --- | --- |
| SW-372 | With an authorised section leader, compare a known Present, Absent and Unrecorded member/meeting against saved meeting records; include a dual-section member and an out-of-section comparison under an authorised group account. Apply a section and inclusive date range, reload and reapply the filters: identities, states and chronological columns must match. An unrelated section must remain inaccessible. Existing summaries and attendance entry must still work. |
| SW-373 | On desktop and Android, enable Attendance matrix in Superuser Settings, reload and open Attendance Insights in another signed-in session. Check summaries, filters, long names/titles, all legend states and scrolling with retained row/header context, with no page overflow. Change navigation/schedule choices independently. Switch back to Existing attendance and reload: the matrix disappears, summaries/history still work and saved attendance is unchanged. A non-Superuser must have no rollout control. |

Development/CI results, Firebase TEST deployment verification and Production Manual Testing are separate evidence. Neither these scenarios nor a green PR records a Production pass.
