# Playwright suite strategy

SW-65 rationalises the browser suite without weakening the required `e2e` safety gate.

## Functional ownership

Every `e2e/*.spec.ts` file must belong to exactly one functional suite in `scripts/playwright-suites.mjs`. The quality check `npm run check:playwright-suite` fails if a spec is unowned, multiply owned, missing, focused, uses a fixed sleep/network-idle wait, or hard-codes the canonical test password.

The current suites are:

- `smoke-navigation` — leader shell, navigation, loading and logout journeys.
- `authentication-rbac` — admin/access management, organisation roles, permission boundaries and settings access.
- `members-parents-consent` — member records/search, parent journeys and consent.
- `activities-programme` — activities, events, meetings, programme library and weekly planning/tracking.
- `badgework` — Adventure Skills and badgework filtering.
- `equipment` — checkout, leader dashboard and equipment reports.
- `finance-subs` — cashbook, transfers, finance reporting, general reports and subs.
- `public-pages` — public smoke, public-facing communications and tile filtering.
- `platform-ui` — accessibility, mobile interaction, section-aware cards, dropdown behaviour, theme parity and WebKit critical path.
- `domain-deployment` — deployed TEST-environment smoke coverage.

A smaller smoke set (`public-smoke`, `leader-navigation`, `logout`) runs on every ordinary pull request.

## What to run locally

- Complete browser suite: `npm run test:e2e:full` (also available as `npm run test:e2e`).
- One functional suite: `npm run test:e2e:suite -- <suite-name>`.
- PR-style selection: `npm run test:e2e:pr -- --base <base-sha-or-ref>`.

The application build, Firebase Auth/Firestore/Storage emulators and canonical deterministic seed data must be running before local browser execution, matching `.github/workflows/playwright-e2e.yml`.

## CI selection policy

Pull requests run smoke plus the functional suites inferred from changed paths. Selection is intentionally conservative:

- a direct spec edit runs that spec's owning functional suite;
- clearly feature-specific paths select the corresponding suite;
- documentation-only changes still run smoke;
- shared components/hooks/services, Firebase/configuration, dependencies, workflows, Playwright infrastructure, scripts, unknown paths, or any failure to calculate the diff trigger the complete suite.

Do not broaden the path rules merely to make CI faster. When impact cannot be established safely, full-suite fallback is the expected behaviour.

Pushes to `main` always run `npm run test:e2e:full`. The repository ruleset continues to require the `e2e` and `quality` checks.

## Production gate

Production deployment remains manual `workflow_dispatch` only. The production workflow accepts an exact SHA contained in `main` and refuses to deploy unless that SHA has successful `quality` and `e2e` checks. Because `e2e` on `main` is always the complete Playwright suite, the full suite remains a mandatory pre-production deployment gate.

Do not replace this with a reduced PR suite check for production.

## Reliability rules

Prefer deterministic emulator seed data, accessible role/name or stable test-id selectors, and assertions on user-visible application state. Do not add arbitrary sleeps, `networkidle` waits, retries as a substitute for diagnosis, or pixel/geometry assertions unless geometry itself is the user-visible contract. CI artifacts retain trace, screenshot and video evidence for failures; investigate that evidence before rerunning.
