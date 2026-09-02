# Stage 18.10 — mandatory parent event-consent release gate

Stage 18.10 removes the optional switch around the canonical parent event-consent Playwright journey.

The deterministic flow seed already creates an open Beavers event (`TEST_flow_event_beavers_open`), its public projection and an active consent link. The canonical approved Beavers parent is linked to the seeded Beavers members, so the browser journey has stable emulator data and does not need an opt-in repository variable.

The Playwright suite now always verifies, on Chromium, that an approved parent:

- sees the canonical linked event as the next consent action;
- sees the event in Upcoming Events & Event Consent;
- can follow Complete Event Consent to the Event Consent page; and
- sees the expected canonical event on that page.

`E2E_PARENT_EVENT_CONSENT_ENABLED` has therefore been removed from the Playwright workflow. A regression in this parent event-consent path now fails the normal Playwright release gate instead of silently skipping the test.

This remains emulator-backed release evidence. Production email delivery and live Worker configuration still require the production smoke/manual checks documented in `docs/production-readiness.md`.
