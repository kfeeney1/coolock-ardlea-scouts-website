# Stage 18.11 — Time-stable E2E fixtures

The canonical full-system flow seed previously used fixed 2026 dates. That meant the meaning of important fixtures would change as the real calendar advanced: the Beavers event used by the mandatory parent event-consent gate would eventually become a past event, active consent windows would expire, and historical meeting/event fixtures would stop representing the intended relative states.

Stage 18.11 keeps the existing deterministic IDs, titles, statuses and relationships, but derives calendar-sensitive fields from a UTC seed date. By default the seed date is the current UTC date; `E2E_SEED_DATE=YYYY-MM-DD` can be supplied when a caller needs an explicit anchor.

Canonical relative states are now intentional: the Beavers consent event is 14 days ahead, the Cubs draft camp is 35–37 days ahead, other open events are 60/90 days ahead, closed/completed events are 30/45 days behind, the youth consent window spans from 10 days behind to 330 days ahead, and canonical meeting records remain in the recent past.

`verify-flow-data.mjs` now validates those date relationships as part of the seed contract, including public-event and event-consent-link date projections. This ensures the browser suite continues to exercise upcoming-event, past-event and active-consent behaviour instead of silently ageing into different states.

This changes TEST fixtures only. Production records, application clock behaviour, Firestore rules and runtime permissions are unchanged.
