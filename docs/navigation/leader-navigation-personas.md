# SW-186: permission-derived navigation personas

SW-186 extends the SW-181 permission model, SW-182 destination contract,
SW-183 active identity, SW-184 Back behavior and SW-185 accessibility work.
It does not change appointment grants, route guards or Firestore rules.

`e2e/leader-navigation-personas.spec.ts` exercises actual authenticated UI in
both persisted navigation versions on desktop and mobile Chromium. Independent
expected destination sets live in `e2e/support/leader-navigation-personas.ts`;
the application's visibility filter is not used to calculate the assertions.
The canonical destination registry supplies paths and page identities only.

| Persona | Additional appointment-specific coverage |
| --- | --- |
| Programme Scouter | Shared Leader destinations; no Secretary, Bo’sun or Treasurer category |
| Group Secretary | Secretary records and Activity Log; no Bo’sun or Treasurer category |
| Group Quartermaster / Bo’sun | Five QM destinations; no Secretary, Treasurer or Activity Log |
| Group Leader | People & Parents, Join Us, Leader Access, Settings and Activity Log |
| Group Chairperson | Group Operations and Secretary records; no Treasurer or Activity Log |
| Secretary plus Bo’sun | Union of both active appointments without duplicates; inactive Treasurer contributes no destinations |
| Superuser | Complete destinations, with System Information in the selected version's correct category |

Ordinary Leader accounts retain their canonical shared capabilities. The tests
therefore do not assume that an account with one appointment sees only that
appointment's category. The multi-appointment fixture is private and uses the
existing population seeder's Auth, admin-user and organisation-leadership paths.

For every persona and version the tests assert the exact destination set and
canonical hrefs, completely absent unauthorized links (including hidden DOM),
category order on expandable presentations, one expanded category, and no
duplicates. They click one destination from every permitted category and verify
its exact URL and unique page identity. Each primary journey also checks refresh,
active identity, menu-dismiss Back and page Back. Restricted accounts are denied
the direct System Information route and cannot see the version-setting controls.
A separate Superuser version test retains setting persistence and complete
cross-version menu parity. The existing destination-contract suite retains its
full canonical route walk; the persona suite does not claim to click every route
for every account.

## Development verification

Based on `6c3b3596` (SW-185 / PR #859, still awaiting full CI and merge at
verification time). No competing navigation PR or applicable AGENTS.md was found
in the reconciliation. Read SW-179's foundation-reuse comment and the SW-186
requirements; SW-187/188/189 remain separate follow-up scope.

Local Firebase emulators and Chromium 151.0.7922.34: **30 passed, zero retries,
zero skips** across desktop and mobile (28 persona cases plus two retained
Superuser persistence journeys). Unit tests: **841 passed**. The new matrix
replaces two bundled five-account journeys with separately reported persona
cases; it retains their touch-target, overflow, refresh, active identity, Back,
direct System Information denial and hidden-setting assertions.

The latest measured persona/version durations (365.6s / 28.8s) are recorded in
the shard weights so the new coverage does not silently use the 15-second default
estimate. Existing estimates are refreshed from the 92 fully completed successful
specs in CI #4093; failed or unfinished specs retain their previous estimates. Exact-head CI
and live/manual acceptance are still required.

## Assurance boundaries

Development/CI results must be recorded on the SW-186 PR for its exact head.
Firebase emulator runs are development assurance. A Firebase TEST preview build
is not manual acceptance. Live TEST acceptance remains SW-189, including the
physical Android and assistive-technology checks. Production Manual Testing is
separate. This document does not mark SW-179 or its children Done.

## CI Rover follow-up (18 October)

PR #862 at `d88e7e66`, run `39130556414`, failed at Rover re-designation.
The CI snapshot shows the success message and the existing member card with
Scouts/Rovers, while the management dialog has disappeared. The write succeeded;
the missing dialog prevented the unchanged End Rover Membership assertion.

A controlled real-UI regression confirms a same-marker cleanup hazard: after a
select closes, a newly opened Rover dialog can occupy its transient history entry
before MutationObserver state reaches React. The delayed cleanup checked browser
ownership but used stale surface state and consumed that entry (history index
2 → 1 on both projects). It now checks the live DOM as well before navigating
Back. The regression holds only cleanup/observer timing; portals, clicks, native
history and Firestore operations remain real. It also verifies that genuine
browser Back still dismisses the new dialog.

The original bridge fails both desktop/mobile regression cases. With the fix,
17 actual UI cases passed with five established project-specific skips, zero
retries and zero flaky outcomes: the complete Rover spec, both version/persistence
journeys, active deep-link/reload cases, menu ownership/Sign Out regressions and
the new same-marker cases. The Rover lifecycle assertions, identity/section
preservation, timeout and retry limits are unchanged. Full local quality passed:
842 unit, 51 worker, eight backend tests plus static/build checks, using Firebase
emulators and matching Chromium Headless Shell 151.0.7922.34.

This addresses the confirmed cleanup hazard consistent with the CI snapshot;
a fresh full CI run must establish the reported full-suite result. Live TEST
acceptance and PMT remain separate.
