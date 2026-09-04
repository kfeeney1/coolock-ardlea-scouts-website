# Stage 22.1 — Production launch baseline

## Purpose

Establish the production cutover boundary before changing live origins or real-recipient email delivery.

## Current repository posture

The application and email Worker still assume the Firebase Hosting origin `https://coolock-ardlea-scouts.web.app` for generated links and allowed origins. Outbound application email still uses Resend's onboarding sender and redirects all intended recipients to the configured test mailbox.

This remains a deliberately safe pre-production posture: it prevents accidental real-recipient delivery before the sending domain and production origin are verified.

## Repository-controlled changes after external verification

Once the custom production domain and sending domain are verified, the following repository configuration becomes eligible for focused follow-up PRs:

- update the email Worker `SITE_URL` to the canonical custom-domain HTTPS origin;
- add or replace `ALLOWED_ORIGINS` with the verified production origin while preserving any required transition origin explicitly;
- change `EMAIL_FROM` from `onboarding@resend.dev` to a verified-domain mailbox;
- clear `TEST_EMAIL_REDIRECT` only when real-recipient delivery is intentionally enabled;
- update documentation and regression coverage for canonical production links and allowed origins.

These changes should not be bundled before the external verification evidence exists.

## External operator steps

The repository cannot itself complete:

- DNS records at the domain registrar/host;
- Firebase Hosting custom-domain ownership and TLS provisioning;
- Resend sending-domain DNS verification;
- Firebase Authentication authorized-domain configuration;
- provider-side mailbox/forwarder creation where used.

Each external step must be completed and verified before the corresponding repository cutover change is merged.

## Email safety gates

Real-recipient email rollout requires all of the following:

1. the sending domain is verified by Resend;
2. the chosen `EMAIL_FROM` address belongs to that verified domain;
3. the custom application origin is serving successfully over HTTPS;
4. Worker origin allowlisting includes the intended production origin;
5. application emails are validated end to end against controlled real recipients;
6. only then is `TEST_EMAIL_REDIRECT` cleared.

Email failure must continue not to roll back the associated Firestore workflow.

## Initial cutover order

1. Verify and attach the custom website domain to Firebase Hosting.
2. Verify the sending domain with Resend.
3. Align Worker site URL/origin configuration.
4. Move the sender to the verified domain while retaining test redirect for controlled validation.
5. Validate every existing branded email flow.
6. Disable test redirect and enable intended production recipients.
7. Align Firebase Authentication authorized-domain/password-reset presentation.
8. Run cross-role production-domain regression.

## Non-goals

This baseline does not change DNS, hosting, provider secrets, Firebase Authentication settings, production data, Storage capability, RBAC, Rules, audit behavior, provenance controls, deterministic fixtures or read budgets.
