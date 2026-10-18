# SW-188 mobile navigation and Back regression coverage

## Reconciliation

Main `70ea3d19` contains SW-185 / #859. Although #860 and #861 were marked
merged, their bases were feature branches, so SW-186/187 were absent from main.
SW-186 is being integrated through main-targeted #862; SW-187 is preserved in
separate draft #863. This work builds on those exact tested trees and stays
scoped to SW-188. No applicable AGENTS.md was found.

The epic reconciliation directs gap-closing against SW-158/176/178/198/199–204.
Those foundations and the subsequent SW-179–187 suites already cover most of
SW-188. They are retained, rather than duplicated or weakened.

| SW-188 requirement | Existing coverage | Additional gap closed |
| --- | --- | --- |
| One expanded category; collapse/open; no category history entries | navigation version, persona, Back suites | Mobile taps collapse/reopen and retain exact URL/history index/length |
| Canonical route and page identity; active state | all-destination contract, persona, route-state suites | QM Reports survives portrait → desktop-width landscape → portrait |
| Deep link and refresh | route-state, direct-route, recovery suites | Reload restores the active parent before responsive transitions |
| Browser Back equivalent | Leader Back and mobile Back suites | Back after rotation dismisses the menu while retaining Reports |
| Representative in-app detail/edit returns | Leader Back: event record/editor browser return; Join Us unsaved Stay/discard; event record parent return | QM Reports in-app return retains Equipment & Stores role context |
| 44px targets; no overflow | accessibility suite at 393px/320px, persona journeys | Visible menu controls are checked at every responsive transition |

## New real-UI checks

`leader-navigation-mobile-transition.spec.ts` runs four cases in the Pixel 7
project: existing/redesigned navigation at 393px and 320px, each rotating to a
1000px landscape layout and back. Desktop projects intentionally skip these
four mobile-only cases; desktop assurance remains in the existing suites.

The saved version is selected through the real Superuser Settings UI and
restored in cleanup. The test taps category and destination controls, checks
the exact Reports route plus loaded report content, reloads, and requires the
route to expand its own parent. After rotation, it requires one active
destination, usable target sizes and no horizontal overflow. Browser Back
dismisses the menu; the real in-app Back link opens the canonical QM equipment
workspace. No route/data response is mocked.

All four cases passed against canonical Firebase emulators and Chromium
Headless Shell 151.0.7922.34, with zero retries/skips/flaky outcomes. Full local
quality passed: 842 unit, 51 email-worker and eight event-backend tests, plus
lint/static/RBAC/seed/documentation/suite checks and build. The completed spec
duration supplies its shard estimate; allocation and timeout/retry policies
are unchanged. No application or authorization code changes were required.

## Separate live acceptance

SW-189 remains pending: verified deployed SHA, representative live accounts,
physical Android system Back, TalkBack/manual keyboard/zoom and evidence.
Pixel 7 browser-history simulation does not establish physical Android acceptance.
PMT remains separate. No Jira is marked Done and no Production pass is claimed.

Main's Firebase TEST deploy run `39129920613` failed before Hosting/seed/smoke
verification: the Rules API returned HTTP 409 for the existing
`cloud.firestore` release. This is a live deployment blocker, not a navigation
test result. The existing 503-only retry policy correctly did not mask it;
its underlying cause remains unproven by that response alone.
