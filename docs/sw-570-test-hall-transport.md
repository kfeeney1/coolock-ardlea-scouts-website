# SW-570 — isolated booking transport for Firebase TEST

## Observed deployment gap

After #965 merged, the public TEST build metadata identified main `291bdfddeaa2c5a61418adb5ec74c9c9a0b641e8` (31 October 2026). Fetching `/hall-hire` returned the SPA shell; neither observation proves an enabled booking workflow. Anonymous direct REST probes of `hall/group` and a private booking path returned 403; the public rollout/readiness projections were absent (404). These sampled checks do not prove authenticated lifecycle acceptance. TEST deliberately builds `VITE_EMAIL_API_URL` empty. The previous booking client required that URL, so authenticated hall operations could not work there. Firebase Functions deployment remains explicitly blocked by the repository's zero-cost policy. Do not revive it or enable TEST communication to solve this gap.

The optional `VITE_HALL_BOOKING_API_URL` now supplies TEST booking transport independently. It accepts only `https://coolock-ardlea-scouts-hall-test.<actual-account-subdomain>.workers.dev` with the exact TEST Firebase project. No endpoint is invented or configured by this change. Missing configuration fails closed. Production and local development continue using their existing Worker URL; they ignore this TEST variable. Both TEST and preview build workflows keep email disabled.

## Separate entry and configuration

`email-worker/wrangler.hall-test.toml` names **coolock-ardlea-scouts-hall-test**, targets **coolock-ardlea-scouts-test**, and bundles `src/testHallEntry.js`. Never use the default or Production Wrangler configuration for TEST: both currently name the existing Production email Worker.

The entry exports only `fetch`, exposes `/hall-bookings` and neutral `/health` revision metadata, and reuses the existing authoritative booking/source handler. It has no mail dispatcher, scheduled handler, scheduled trigger, storage binding or custom route. It rejects non-TEST project/service-account bindings, emulator bindings and missing revision metadata before network access. Allowed browser origins are the exact TEST Hosting domains and their TEST preview channels. Token audience/issuer hints reject cross-project requests early; Firestore still verifies signature/identity before private access, followed by the existing transactional Council/source scope checks. Neither origin nor unsigned hints grant authority.

Direct client access to private hall records remains denied. Public availability remains the deliberately restricted Rules-protected projection. The TEST Worker adds no public booking feed and cannot set readiness or the rollout switch.

## Cost dependency and deployment prerequisites

No paid service, new subscription, Firebase Function, paid Worker binding or plan upgrade is introduced. A separate deployment consumes the existing Cloudflare account's quota and existing Firestore usage. The actual account plan and available quota have **not** been verified in this session. The [official Workers pricing documentation](https://developers.cloudflare.com/workers/platform/pricing/) lists Free limits of 100,000 requests/day shared across the account and 10ms CPU/request. These are limits, not evidence that this account or this workload qualifies. Confirm the existing account is on Free, has capacity, and uses no paid resources before deploying. Actual CPU/subrequest suitability, including OAuth signing and bounded recurrence, must be measured during controlled TEST acceptance. Stop if limits prevent the workflow; do not upgrade or create charges. Existing Firestore usage also remains subject to its existing project quotas/billing.

An account owner must configure the protected GitHub **test** environment with:

- `VITE_HALL_BOOKING_API_URL`: the actual dedicated Worker origin, matching the fixed Worker name and account subdomain.
- `HALL_FREE_PLAN_CONFIRMED=true`: set only after checking existing Free plan and shared quota; remove it when that finding no longer holds. The guard does not inspect account billing itself.
- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` secrets scoped to the intended account/deployment. No Production credential or domain is needed.
- The existing `FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_TEST` secret. This is validated as TEST before use; only its TEST email/private key are installed in the isolated Worker. Do not copy Production credentials or expose credential values in logs, Jira or PRs.

Use a TEST service account with only the Firestore access needed by the existing authoritative handler. Repository variables/secrets are deployment configuration, not a Council permission source. No credentials or billing configuration were changed in this session.

## Manual TEST deployment and evidence

After this PR merges, allow normal TEST Hosting deployment and current-main CI to complete. The TEST frontend must be rebuilt with the configured dedicated origin. Then manually dispatch **Hall Booking TEST Manual Deploy** on main. This does not deploy Hosting, Rules, Firebase Functions or Production.

The workflow checks out current main, requires its successful quality, E2E, Rules and dependency-audit check runs, validates the exact TEST target/configuration and owner Free-plan confirmation, validates the existing TEST credential, and verifies Hosting metadata matches that revision. It runs Worker tests, packages the separate config with `--dry-run`, installs only TEST credentials, and deploys only the fixed TEST Worker. Its deployment uses the same concurrency group as TEST Hosting. It never invokes default/Production Wrangler configuration. The workflow is not automatically dispatched by this PR.

`X-Hall-Backend-Commit` and `/health` identify the actual Worker revision. The postdeploy script verifies matching project/revision and denied anonymous, Production-origin and email-route requests, plus TEST CORS. It sends no valid identity, booking mutation or enquiry. Its result explicitly says `functionalAcceptance:false`; metadata and negative probes are insufficient for SW-561. If a step fails, treat the workflow as failed and inspect the actual deployment state before continuing; there is no claim of atomic deployment/secret rollback.

After deployment configuration, use the separate [SW-571 rehearsal plan/start/stop](sw-571-hall-test-rehearsal.md) for controlled TEST readiness. SW-561 must prepare controlled synthetic TEST records, execute authenticated lifecycle/source/conflict/privacy acceptance, and stop/clean up. Rehearsal does not publish final readiness or assert acceptance. No fixture setup, enabling, reconciliation, readiness publication, deployed authenticated acceptance or Production deployment has occurred here. The SW-569 publication gate still requires genuine acceptance evidence. Legacy source owners must confirm hall use and times before reconciliation; unknown venue facts stay unpublished.

## Rollback and PMT

Switch **Hall Hire** off using the existing authorised Superuser configuration. This hides the feature while retaining booking/source/audit records and authoritative conflict controls for existing reservations. Remove the TEST endpoint variable and rebuild TEST Hosting to disconnect the TEST transport if necessary; keep the Worker available for authoritative off-state source releases/reschedules. Do not delete reservations/indexes, relax Rules, revert protected source writes or replace the Production Worker as rollback. Coordinate restoring a prior tested TEST Worker revision and frontend revision; record both and rerun boundary checks.

Development coverage exercises isolated routing/configuration, denied origins/audiences, no communication routes, exact revision/cost guards, and real-handler create/read/edit/cancel/history plus source scope and public privacy against a loopback Firestore emulator. Emulator tests use the TEST project name only inside an explicit local emulator namespace and forward only the fixed Firestore host to loopback; no live service account or cloud write is used.

Android PMT remains pending: 320px/all themes/header, calendar keyboard/focus/month controls; Council booking and single-occurrence/series lifecycle; source permissions and concurrent conflicts/adjacency; neutral public slots/enquiry wording; Back/draft preservation; off/on/revoked-readiness record retention. Record device/browser, actual frontend and Worker revisions, results and cleanup in SW-561. Production PMT is separate; no Production pass is claimed.
