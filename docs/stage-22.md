# Stage 22 — Production launch and communications rollout

Stage 21 closed the evidence-led field-use refinement cycle with representative public, parent, leader and Pixel 7 regressions green and no newly reproduced P0/P1 adoption defect remaining.

Stage 22 moves the product from mature pre-production operation into its custom-domain and real-email launch posture. It is not a reason to weaken the Stage 18–21 controls around RBAC, Rules, provenance, deterministic fixtures, auditability, read budgets, accessibility, mobile coverage or Quality.

## Planned sequence

1. **22.1 — Production launch baseline.** Record the current hosting, custom-domain and outbound-email posture; identify which changes are repository-controlled versus external provider/DNS steps; keep test-email redirection active until the sending domain is verified.
2. **22.2 — Custom-domain application rollout.** Make the production site origin authoritative across hosting, application links and allowlists once DNS/hosting verification is complete, while retaining the Firebase-hosted origin as an explicit transition/fallback where required.
3. **22.3 — Real outbound email rollout.** Verify a sending domain with the email provider, move `EMAIL_FROM` to the verified domain, expand production recipients appropriately and disable `TEST_EMAIL_REDIRECT` only after provider verification and end-to-end validation.
4. **22.4 — Production communications completeness.** Review application emails, event notices, consent reminders and leader communications for real-recipient routing and safe authorization. Do not introduce a generic arbitrary-recipient mail endpoint.
5. **22.5 — Authentication/domain alignment.** Align Firebase Authentication authorized domains and branded password-reset behavior with the custom production domain without changing token/security semantics.
6. **22.6 — Launch regression and cutover review.** Re-run representative public, parent and leader journeys against the production-domain configuration, confirm real-email routing, preserve Pixel 7 coverage, and record any external operational dependencies separately.

## Boundaries

- Production TEST-data deletion remains parked until explicitly resumed using the guarded dry-run/manifest/backup process.
- Production Storage availability remains a separate capability dependency.
- No provider secret, API key or credential is committed to the repository.
- DNS, Resend domain verification, Firebase Console authorized-domain changes and Hosting custom-domain verification are external operator steps and must be recorded as such.
- `TEST_EMAIL_REDIRECT` remains enabled until the sending domain is actually verified and real-recipient validation is ready.

## Stage 22.1 starting evidence

The current email Worker is still configured for the Firebase Hosting origin and Resend test mode: `SITE_URL` and `ALLOWED_ORIGINS` use `https://coolock-ardlea-scouts.web.app`, `EMAIL_FROM` uses `onboarding@resend.dev`, and `TEST_EMAIL_REDIRECT` redirects every intended recipient to the test mailbox. The existing email documentation also describes this as a temporary no-domain posture.

That state is safe for pre-production testing but is no longer the intended launch configuration now that the project has moved into custom-domain rollout. Stage 22.1 therefore establishes the cutover plan before changing production-facing configuration.
