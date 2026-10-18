# SW-187 direct-route authorization and deep-link coverage

## Reconciled baseline

Main is `f092ba51` after SW-184 / #858. The persistent SW-179 version
switch, canonical permission filter, navigation map and active-state resolver
are already merged through #854–858. SW-185 / #859 is green at `fd8fc845`.
SW-186 / #860 remains a separate stacked persona-test PR; its latest merged
baseline is `6b2ed8da`, including all SW-185 follow-ups. No AGENTS.md was found
in the repository or workspace ancestry.

The new spec closes SW-187 gaps without replacing the recovery suites from
SW-158/176/178/198/199–204, or the all-destination and persona journeys from
SW-182/186. The application route guards, data rules, canonical effective
permissions and version persistence are unchanged.

## Real-browser matrix

`e2e/leader-navigation-direct-routes.spec.ts` runs each journey in both saved
navigation modes on desktop Chromium and Pixel 7 Chromium: twelve cases.
Every case selects the mode through the real Superuser settings UI, signs
out through the real menu, and signs in as the representative account.
Cleanup restores existing navigation through a separate Superuser session.

| Account | Authorized direct link | Unauthorized direct link | Assertions |
| --- | --- | --- | --- |
| Scouts Programme | Assigned Scout member record | Beaver member outside assigned sections | Exact URL, named record and Member Details; loaded denial and absence of protected record identity, including after reload |
| Bo’sun | Filtered Quartermaster settings | Same settings route with Treasurer view | Correct workspace identity and active parent, hidden version selector; guard redirects to Dashboard, protected workspace absent; reload and Back retain the authorized filtered URL |
| Secretary | Supported `/leader/member-history` saved link | System Information | Canonical Members redirect, page identity and active parent after reload; guard redirects to Dashboard, protected heading absent; Back returns to canonical Members |

The test does not manually expand the active category. It requires the route
to restore the appropriate parent and exactly one active destination. Closed
menus are dismissed through Escape before direct navigation or browser Back.
Unauthorised settings/System Information follow the existing Dashboard redirect;
member records retain their existing explicit unavailable/out-of-section state.
The test does not invent a new access-denied screen.

## Acceptance boundaries

Local emulator/browser assurance and PR CI are separate from live Firebase TEST
acceptance under SW-189. Physical Android Back, TalkBack, manual accessibility
and PMT remain pending. SW-188 remains a separate mobile/Back reconciliation
story. No Jira is marked Done and no Production pass is claimed by this work.

## Development assurance

All twelve browser cases passed on seeded Firebase emulators and Chromium
151.0.7922.34 in 109.6 seconds: zero retries, skips or flaky outcomes.
The first launch attempt was blocked by missing Playwright video tooling;
no assertion or timeout was changed to obtain the completed run. The local
run used the matching Chrome Headless Shell and system FFmpeg.

Full quality checks passed: 842 unit, 51 email-worker and eight event-backend
tests, lint/static/RBAC/seed/navigation documentation/suite checks and build.
The focused navigation contract/permission/state suite also passed all 16 tests.
The complete browser duration supplies the new spec’s shard estimate; allocation,
coverage, timeout and retry policies remain unchanged. Main-targeted PR CI is
still required after the stacked dependencies land.
