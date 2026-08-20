# Branded email setup

All application email uses the shared Coolock Ardlea Scout Group template in `functions/emailBranding.js`.

## Application emails

The first automated flows are:

- Parent Portal access approved
- New Join Us application notification to active Admins and Super Admins

The Firebase Functions backend sends mail through Resend. The API key is stored as a Firebase Functions secret and is never included in the website bundle.

### One-time setup

1. Create/verify the sending domain in Resend.
2. From the repository root run:

```bash
cd functions
npm install
cd ..
firebase functions:secrets:set RESEND_API_KEY
firebase deploy --only functions
```

During deployment set:

- `EMAIL_FROM` to a verified sender, for example `80th 160th Coolock Ardlea Scout Group <website@your-domain.ie>`
- `SITE_URL` to `https://coolock-ardlea-scouts.web.app` (or the final custom domain)

The default `onboarding@resend.dev` sender is suitable only for initial Resend testing, not production.

## Firebase Authentication emails

Password-reset email is intentionally sent by Firebase Authentication. This preserves Firebase's secure reset tokens, expiry, abuse protections and password-change handling.

Firebase Auth templates are configured in the Firebase Console rather than this repository. To keep Forgot Password branded, open:

**Firebase Console → Authentication → Templates → Password reset**

Use the following branding:

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

Do not remove `%LINK%`; Firebase replaces it with the secure one-time password reset link.

Apply the same group name, sender identity and wording style to any other Firebase Authentication templates that are enabled later, including email verification or email-address changes.

## Branding rules for future mail

New application emails should use `brandedEmail(...)` instead of defining their own HTML. This keeps the group name, navy/coral header, button styling and footer consistent across all mail flows.

Never put provider API keys, SMTP passwords, or other email secrets in Vite environment variables or frontend source code.
