# Branded email setup

All system email should use the 80th 160th Coolock Ardlea Scout Group identity and wording.

The project uses two email paths:

1. **Firebase Authentication** for secure password-reset emails.
2. **Cloudflare Worker + Resend** for application emails.

This keeps Firebase on the Spark/free plan and does not require Firebase Functions or Blaze billing.

## Implemented application email flows

- New Join Us application → configured admin recipients.
- Parent Access registration received → parent plus configured admin recipients.
- Parent Access approved → parent.
- Parent Access rejected → parent.
- Leader Access registration received → leader applicant plus configured admin recipients.
- Leader Access approved → leader.
- Leader Access rejected → leader.

Email delivery failure never rolls back the corresponding Firestore application, registration, approval or rejection.

## Test mode while no sending domain is owned

Resend's `onboarding@resend.dev` sender can only send to the Resend account owner's email address. To make every flow testable now, `email-worker/wrangler.toml` contains:

```toml
TEST_EMAIL_REDIRECT = "kfeeney1@hotmail.com"
```

While this value is set, every intended recipient is redirected to that mailbox and the original intended recipient is included in the subject, for example:

```text
[TEST for parent@example.com] Parent access approved – Coolock Ardlea Scouts
```

When a sending domain is eventually verified in Resend:

1. Change `EMAIL_FROM` to an address on the verified domain.
2. Set `TEST_EMAIL_REDIRECT = ""`.
3. Redeploy the Worker with `npm run deploy`.

No frontend changes are required at that point.

## Worker security

- `RESEND_API_KEY` is stored only as a Cloudflare Worker secret.
- Join Us notifications can only go to the fixed `ADMIN_EMAILS` configured in Wrangler.
- Parent/leader self-registration endpoints require the signed-in Firebase user and read that user's registration document through Firestore before sending.
- Parent and leader approval/rejection emails require an active `admin` or `super-admin` Firebase account.
- Provider keys must never be placed in Vite environment variables or frontend source code.

## Worker deployment

From the repository root:

```bash
cd email-worker
npm install
npx wrangler login
npx wrangler secret put RESEND_API_KEY
npm run deploy
```

The deployed Worker URL is configured in the GitHub Actions secret:

```text
VITE_EMAIL_API_URL
```

## Firebase Authentication emails

Forgot Password is sent by Firebase Authentication so Firebase retains secure one-time reset tokens, expiry and abuse protection. Both Leader Login and Parent Login use this mechanism.

Configure the template in:

**Firebase Console → Authentication → Templates → Password reset**

Use:

**Sender name**

`80th 160th Coolock Ardlea Scout Group`

**Subject**

`Reset your Coolock Ardlea Scouts password`

**Message**

```text
Hello,

We received a request to reset the password for your 80th 160th Coolock Ardlea Scout Group account.

Use the link below to choose a new password:

%LINK%

If you did not request a password reset, you can ignore this email.

80th 160th Coolock Ardlea Scout Group
```

Do not remove `%LINK%`.

## Testing checklist

After deploying the current Worker:

1. Register a new parent. Two test emails should arrive at `kfeeney1@hotmail.com`: the parent acknowledgement and the admin notification.
2. Approve that parent. A test approval email should arrive showing the parent's intended address in the subject.
3. Reject another pending parent and confirm the rejection/update email.
4. Register a new leader and confirm both applicant and admin test messages.
5. Approve or reject that leader and confirm the access-status message.
6. Submit a Join Us application and confirm the admin notification.
7. Test Forgot Password separately from Leader Login and Parent Login.

## Next application mail

Event notices and consent reminders should use the same Worker and branded template. They need recipient selection tied to event rosters/member access, so they should be implemented as authenticated event-specific endpoints rather than a generic arbitrary-recipient mail API.
