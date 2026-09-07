# Modern Scout theme support

## Current status

Modern Scout remains a supported alternate presentation for the Leader Portal.

The application has one shared route, component, service, authorization and persistence architecture. `ThemeExperienceProvider` reads the optional `adminUsers.uiTheme` preference, normalises it to `default` or `modern`, and selects the corresponding MUI theme. Unsupported or missing values safely fall back to `default`.

The Modern theme changes presentation only: palette, typography, component radius and related MUI styling. It must not introduce theme-specific routes, permissions, Firestore behaviour, validation or domain logic.

## Historical provisioning

PR #210 introduced the shared theme architecture and a dedicated Modern Scout super-admin fixture. PR #212 subsequently added that fixture to the then-current manual live seed/reset workflow so the alternate theme could be viewed in a seeded environment.

That production provisioning path is now obsolete. The repository no longer contains the historical **Seed Firebase Test Data** workflow, and a special Modern Scout TEST account is not required in production to prove theme support.

Do **not** seed or reset production merely to recreate `modernsuperadmin@example.com`.

## Current verification path

The current Playwright workflow starts Firebase Auth, Firestore and Storage emulators, creates emulator-only administration credentials and then runs the canonical deterministic seed chain. `scripts/seed-superadmin-login.mjs` provisions both:

- the default-theme super-admin fixture;
- the Modern Scout super-admin fixture with `uiTheme: modern`.

The workflow also repeats the seed chain without cleanup to prove fixture idempotency before browser testing.

`e2e/theme-parity.spec.ts` uses that emulator-only Modern identity to verify:

- the Modern preference is actually applied by the running application;
- the same super-admin dashboard/operational surface remains available;
- protected leader routes remain accessible under the same RBAC identity;
- leader navigation continues to use the shared route architecture;
- the Modern preference persists while navigating;
- the same experience remains usable at a phone viewport without horizontal overflow.

Existing default-theme Playwright journeys continue to provide the broad functional baseline. The Modern spec deliberately adds parity assertions rather than duplicating every operational journey under a second colour scheme.

## Seed-contract expectation

The Playwright seed-contract validator must treat the Modern E2E identity and `seed-superadmin-login.mjs` invocation as part of the canonical test fixture contract. This prevents the environment variable or provisioning step from silently drifting out of CI while the theme code remains present.

## Production relevance

Modern Scout is reusable product architecture, not a production test account requirement. A legitimate production leader/admin profile can opt into `uiTheme: modern` if that preference is deliberately provisioned through supported administration/data processes. The application still uses exactly the same account role, section scope and backend rules.

There is no requirement to keep a historical TEST user in production to retain this capability.

## Maintenance rules

When changing theme support:

1. Keep theme selection presentation-only.
2. Keep `default` as the safe fallback.
3. Preserve shared route/RBAC behaviour.
4. Update focused theme parity tests when navigation, accessible names or responsive shell behaviour changes.
5. Do not create production seed/reset workflows for visual verification.
6. Use emulator/preview infrastructure for alternate-theme regression testing.
