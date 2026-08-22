# Attendance History & Insights

Attendance insights are derived from the existing event rosters and do not introduce a new Firestore collection.

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
