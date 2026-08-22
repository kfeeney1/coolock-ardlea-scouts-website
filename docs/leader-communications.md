# Leader parent communications

The Leader Dashboard includes a protected **Parent Communications** area at `/leader/communications`.

## Scope and authorization

- Ordinary leaders load active members only from their assigned sections.
- Admins and Super Admins can communicate across all sections.
- The browser sends member IDs, subject and message to the email Worker; it does not need to load or expose recipient email addresses for the communications screen.
- The Worker authenticates the leader and re-fetches every requested member through Firestore using that leader's token. A member the leader cannot read is skipped rather than emailed.
- Inactive members and member records without a usable email address are skipped.
- A request is capped at 100 unique member IDs, a 120-character subject and a 2,500-character message.

## Privacy

Communications are intended for routine operational messages only. The UI explicitly warns leaders not to include medical or other sensitive information.

Each recipient receives a separate email, so addresses are never disclosed to other families. The Activity Log records the subject, scope and sent/skipped counts, but deliberately does **not** store the message body.

## Templates

The UI provides editable starting templates for:

- General update
- Meeting reminder
- Action required

Templates are convenience text only. They do not bypass the normal recipient and authorization checks.

## Deployment

The frontend and email Worker must both be deployed for this feature to work. The Worker adds the authenticated `POST /leader-communication` endpoint and continues to use the existing `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`, `FIREBASE_PROJECT_ID`, `ALLOWED_ORIGINS` and optional `TEST_EMAIL_REDIRECT` configuration.

When validating against a non-production environment, keep `TEST_EMAIL_REDIRECT` configured so intended addresses are shown in the subject while delivery is redirected to the test mailbox.
