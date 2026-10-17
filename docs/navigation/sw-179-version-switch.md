# SW-179 Leader navigation version switch

Baseline: main `143683cd` (PR #853). No AGENTS.md exists in the checkout or workspace ancestry. No open PRs were returned during reconciliation. SW-158, SW-176, SW-178, SW-198 and SW-199–204 are Done. SW-180–189 are separate To Do stories; this PR is attributed only to SW-179 and does not transition those stories.

The epic reconciliation comment directs gap-closing against the merged recovery foundations. The existing runtime contract remains `src/navigation/leaderNavigation.ts`: stable destination IDs, canonical routes including query/hash context, and page identity. Both versions consume it and `leaderNavigationPermissions.ts`. Existing recovery, identity and Back tests remain applicable. Neither route guards nor data access rules are changed by the version selection.

## Persistence and authorization

Each Firebase project represents this group in one environment. `siteSettings/leaderNavigation` stores `version` (`existing` or `redesigned`), `updatedAt` and `updatedBy`. This document does not contain other configuration. Only an active Super Admin can write; the rules validate the exact schema and audit fields. Authenticated users can get this document, but cannot list settings. Unauthenticated reads and all deletes are denied. No private Parent Login/Consent settings are exposed.

The existing Settings page exposes the selector through the canonical `settings.leader-navigation.manage` permission. Transactions reject a stale expected value. Server-confirmed snapshot updates apply across signed-in sessions. Unset, invalid or failed initial reads render existing navigation. The default never selects the redesign from browser storage.

## Parity and design

The existing mobile disclosure and desktop columns remain the fallback. The redesign uses one expanded card on both viewports, icons, short descriptions, 44px minimum destination targets, explicit regions/expanded state, focus outlines and subtle active indicators. The Group header and branding are unchanged. Secretary and Quartermaster remain separate. Treasurer, Insights & Records and Administration are retained because current main includes these supported functions beyond the original proposed order. System Information is placed under Super Admin in the redesign.

Account & Help, Parent Portal, theme selection and Sign Out remain available under their existing rules. All destination IDs, paths, query/hash contexts and page identities are unchanged.

The canonical registry currently grants ordinary `leader` accounts section capabilities regardless of their appointment label. Consequently Bo’sun-only and Secretary-only accounts retain common destinations authorized by that model, as well as their appointment-specific menu. Restricting those accounts to only two categories would conflict with the current effective grants and remove existing navigation functionality. This PR does not change the authorization model to enforce the epic’s illustrative narrower examples.

## Return navigation

| Action | Both versions |
| --- | --- |
| Open Leader Menu | Existing transient history marker |
| Expand/collapse a category | Local state, no history entry |
| Select destination | Replace menu marker with canonical destination |
| Browser/Android Back with menu open | Dismiss menu, stay on current page |
| Browser/Android Back after destination | Return to previous meaningful route |
| Refresh/deep link | Derive active destination and parent category from URL |
| Detail/edit in-app Back | Existing route-specific return/unsaved-change behavior |

## Assurance

`leader-navigation-version.spec.ts` exercises the real selector, fresh authenticated browser contexts, both modes, representative appointments, route/page identity, active state after reload, minimum touch height, keyboard expansion, category history stability, menu Back dismissal and protected System Information denial. Firestore emulator tests reject Admin, Leader, inactive Super Admin and parent writes, malformed versions, forged audit fields and extra fields.

Run the existing navigation recovery/identity/mobile Back suites alongside the new spec. Live Firebase TEST acceptance (including physical Android Back), all-destination manual parity, and PMT remain separate. SW-189 is the linked TEST acceptance story; SW-180–188 remain separate tracked work and are not declared complete by this PR.

Local validation: all 821 unit tests and all 10 tests in `public-admin-permissions.rules.test.mjs` passed. The full quality gate passed. Local Playwright execution was attempted against seeded emulators, but Chromium failed before test bodies because the runtime denies its required Unix socket (`process_singleton_posix.cc: socket() failed: Operation not permitted`). Subsequent local runs use Chromium headless-shell, which avoids that startup requirement. Browser assurance remains pending successful final runs; this is not a TEST/PMT result.

The first PR browser run detected that Weekly Meetings and Member Management declared navigation page IDs without rendering their corresponding markers. Both visible page roots now render those stable IDs. The new tests retain explicit URL and visible destination-identity assertions, and also cover returning to Dashboard with browser Back and the QM in-app return link.

The browser coverage separates switch/parity from per-mode role journeys while retaining the same assertions and per-action budgets. Escape now closes the shared menu when focus remains on its main toggle as well as when focus is inside navigation.

CI follow-up (17 October 2026): run 38983149055 passed shard 1, Quality,
Rules and preview, but shard 2 stopped at the mobile explicit Save Event
regression (263 passes before the stop). Its trace shows Edit Event routing
completed in about 60ms; the editor then waited on `loadEvents()` audience
hydration for unrelated events. Thirteen audience queries were started; four
had not completed when the 30-second case budget expired. The editor now passes
its event ID to the existing permission-filtered loader, restricting audience
hydration to that event. Profile checks, section queries, route guards, writes
and Firestore rules are unchanged. List callers still load all events.

The explicit-save browser case now asserts that opening the editor queries
only the selected event's audience, then retains all save, dirty-guard and
navigation assertions. Focused desktop/mobile checks pass in both navigation
versions (four cases, 4–5 seconds each, normal 30-second budgets, zero retries).
They use the canonical Firebase emulator seeds and the actual worker entry
handler served through a temporary Node HTTP adapter because Wrangler cannot
enumerate network interfaces in this sandbox. Unit tests (821), lint, build
and the source-complexity guard pass. These are development checks; a new full
CI run, live Firebase TEST acceptance and PMT remain separate.
The new audience-read assertion was also run against unmodified head
`0b4cbaa4`: it fails because the editor reads the unrelated seeded consent
event's audience. The same assertion passes with the fix in all four cases.
