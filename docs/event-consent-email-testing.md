# Event and consent email notifications

This increment adds branded parent notifications to **Leader → Parent Event Consent**.

## Available actions

For an Open event that requires consent, leaders can:

- **Send Event Notice** — sends the event details and consent-response link to all active members in the event section.
- **Send Event Update** — sends the current event details again as an update.
- **Send Consent Reminders** — sends only to active members whose event consent is still outstanding and who have not already responded that they are not attending.
- **Sync New Responses / Manual Match** — after a response is matched into the event roster, sends a confirmation showing the recorded attendance and consent status.

The Worker never accepts an email address from these event actions. The browser sends event/member identifiers and the consent token. The Worker uses the signed-in leader's Firebase token to re-read the event, consent link and member records through Firestore security rules, then derives each stored parent email address from the authorised member record.

## Current test mode

Until a sending domain is verified, `TEST_EMAIL_REDIRECT` redirects every intended event/consent recipient to `kfeeney1@hotmail.com`. The intended real recipient remains visible in the subject, for example:

```text
[TEST for parent@example.com] Consent reminder – Beaver Camp
```

## After merge

The website deploys through the normal Firebase Hosting workflow. The Cloudflare Worker must also be redeployed because this change adds Worker endpoints:

```bash
cd email-worker
npm run deploy
```

## Manual test

1. Create or use an Open event with **Consent required** enabled.
2. Ensure the relevant member records have parent email addresses.
3. Open **Leader → Parent Event Consent**.
4. Create/refresh the Parent Link if necessary.
5. Click **Send Event Notice** and confirm redirected test emails arrive.
6. Click **Send Consent Reminders** and confirm only outstanding members generate emails.
7. Submit a response through the parent event-consent link.
8. Sync or manually match that response.
9. Confirm the response-confirmation email arrives.

When a domain is eventually verified, clear `TEST_EMAIL_REDIRECT`, change `EMAIL_FROM` to the verified sender and redeploy the Worker. No event/consent frontend changes are required.
