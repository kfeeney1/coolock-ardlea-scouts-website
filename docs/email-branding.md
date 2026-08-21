# Branded email setup

All email sent by the system should use the 80th 160th Coolock Ardlea Scout Group identity and wording.

The project deliberately uses two email paths:

1. **Firebase Authentication** for secure password-reset emails.
2. **Cloudflare Worker + Resend** for application emails such as Parent Access approval and Join Us notifications.

This design keeps the Firebase project on the Spark/free plan. It does not require Firebase Functions, Secret Manager or Blaze billing.

## Application emails

The first automated flows are:

- Parent Portal access approved
- New Join Us application notification to configured administrators

The Worker code is in `email-worker/`. The Resend API key is stored as a Cloudflare Worker secret and is never included in the Vite/browser bundle.

### Security model

- The public Join Us endpoint can only send to the fixed `ADMIN_EMAILS` configured on the Worker. A website visitor cannot choose the recipient.
- Parent Access approval mail requires a Firebase ID token. The Worker uses that token against the existing Firestore `adminUsers` rules and only permits active `admin` or `super-admin` accounts.
- Application records are saved to Firestore before email is attempted. A temporary email-provider problem therefore does not lose or duplicate a parent application or access decision.
- `RESEND_API_KEY` must never be stored in GitHub Vite secrets, `.env` files used by the frontend, or frontend source code.

## One-time Cloudflare Worker setup

### 1. Create the accounts

Create a free Cloudflare account and a Resend account if you do not already have them.

For initial testing, Resend's `onboarding@resend.dev` sender can be used subject to Resend's testing restrictions. For production, verify a domain in Resend and replace `EMAIL_FROM` in `email-worker/wrangler.toml` with a verified sender such as:

```text
80th 160th Coolock Ardlea Scout Group <website@your-domain.ie>
```

### 2. Configure recipients

Edit `email-worker/wrangler.toml` and set `ADMIN_EMAILS` to the email address or comma-separated addresses that should receive new Join Us notifications, for example:

```toml
ADMIN_EMAILS = "group.admin@example.ie,group.leader@example.ie"
```

`ALLOWED_ORIGINS` should contain the production website origin. Add `http://localhost:5173` temporarily if local email testing is required.

### 3. Install and log in to Wrangler

From the repository root:

```bash
cd email-worker
npm install
npx wrangler login
```

### 4. Store the Resend API key securely

Still inside `email-worker` run:

```bash
npx wrangler secret put RESEND_API_KEY
```

Paste the Resend API key only when Wrangler prompts for it. Do not commit the key.

### 5. Deploy the Worker

```bash
npm run deploy
```

Wrangler will display a URL similar to:

```text
https://coolock-ardlea-scouts-email.<your-subdomain>.workers.dev
```

Keep this URL; it is the public API address, not a secret.

### 6. Connect Firebase Hosting builds to the Worker

In GitHub open:

**Repository → Settings → Secrets and variables → Actions → New repository secret**

Create:

```text
Name: VITE_EMAIL_API_URL
Value: https://coolock-ardlea-scouts-email.<your-subdomain>.workers.dev
```

Both Firebase Hosting workflows already pass this value into the Vite build.

For local development, add the same value to your local `.env.local` if needed:

```text
VITE_EMAIL_API_URL=https://coolock-ardlea-scouts-email.<your-subdomain>.workers.dev
```

Do not add the Resend API key to `.env.local`.

## Firebase Authentication emails

Password-reset email is intentionally sent by Firebase Authentication. This preserves Firebase's secure reset tokens, expiry, abuse protections and password-change handling. Both **Leader Login** and **Parent Login** expose Forgot Password using this same Firebase mechanism.

Firebase Auth templates are configured in the Firebase Console rather than this repository. To keep Forgot Password branded, open:

**Firebase Console → Authentication → Templates → Password reset**

Use the following branding.

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

Apply the same group name, sender identity and wording style to any other Firebase Authentication templates enabled later, including email verification or email-address changes.

## Testing checklist

After deploying the Worker and adding `VITE_EMAIL_API_URL`:

1. Submit a test Join Us application and confirm the configured admin mailbox receives the branded notification.
2. Create a pending Parent Access record, sign in as an Admin/Super Admin and approve it. Confirm the parent receives the branded approval email.
3. On Leader Login, enter an existing account email and use Forgot Password. Confirm the Firebase Auth email uses the branded template.
4. On Parent Login, repeat the Forgot Password test.
5. Confirm application submissions and approvals still succeed if the email Worker is temporarily unavailable.

## Future mail

Event notices, consent reminders and other application emails should be added as narrow Worker endpoints using the same branded HTML template and the same principle: the browser must never receive the Resend API key, and sensitive operations must validate the signed-in Firebase role before sending.
