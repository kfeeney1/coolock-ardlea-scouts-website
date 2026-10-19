# SW-177 acceptance and delivery evidence

## Status and release boundary

Implementation PRs SW-190–SW-196 are merged into main. No child or epic is Done.
The redesign remains disabled by default. These are separate gates:

- Development: full local repository quality checks passed on each integrated branch.
  The latest implementation check passed 861 unit, 51 email-worker and 8 backend
  tests plus repository policies/build. Basic regression coverage shipped with each
  implementation PR; SW-196 supplements it.
- PR CI: each implementation received fresh checks targeting main before merge.
  The results below identify the final tested heads. They are development evidence.
- Live Firebase TEST: A190–A197 acceptance is NOT executed. Acceptance candidate main
  is `f0816fe00ece2c2a58d846e312e0390b1d12c9fa`. Its deployment run
  [39238309355](https://github.com/kfeeney1/coolock-ardlea-scouts-website/actions/runs/39238309355)
  completed successfully for that exact main SHA. The independently fetched public `build-info.json`
  matches that exact SHA: environment `test`, build time
  `2026-10-19T10:33:57.843Z`, source `github-actions`.
  Hosting identity and the deploy workflow are verified. Authenticated schedule
  acceptance and screen-reader checks remain pending; this is not a TEST pass.
- Access: the live acceptance browser reached Leader Login and requires secure
  authentication with an authorised synthetic TEST Superuser. No credentials were
  entered and no live setting or canonical record was changed.
- PMT: NOT executed. No production deployment or enablement has been performed.
- Screenshots: four SW-195 CI captures (both pages, desktop/mobile) were reviewed.
  Text wraps and controls remain within page width. The full-page captures follow
  keyboard focus scrolling and show the sticky banner at that scroll position;
  physical Android/TalkBack and live visual acceptance remain open. Download the
  [screenshot artifact](https://github.com/kfeeney1/coolock-ardlea-scouts-website/actions/runs/39233836904/artifacts/12179021067).
  Local pinned-browser downloads remain unavailable; successful browser evidence
  comes from CI, not a claimed local browser pass.

## Focused PR sequence and final development checks

| Jira | Merged PR | Final tested head | Green PR checks | Remaining acceptance |
| --- | --- | --- | --- | --- |
| SW-190 | #865 | `75ca5e7a0fc6c219cf1312623e0c0021b4516366` | Quality, Rules, Playwright, TEST preview | A190 live settings/rollback |
| SW-191 | #866 | `3ad41c1f7d0e169bd67b47859bf7f64ff69a5630` | Quality #4076, Rules #2303, Playwright #4113, preview #3363 | A191 live interaction/focus |
| SW-192 | #867 | `8996c3320e9b11665b6521a8c5f07c7cf25a5648` | Quality #4082, Playwright #4119, preview #3369 | A192 live meeting parity |
| SW-193 | #868 | `d6cca316e5b68b0d17b99d8016309e6ac644ca3c` | Quality #4089, Playwright #4126, preview #3374 | A193 live event parity |
| SW-194 | #869 | `16339166e3f590ea36fa62ff5ce18b9cd88511b5` | Quality #4091, Rules #2309, Playwright #4128, preview #3375 | A194 live copy/permissions |
| SW-195 | #870 | `c897c226878ed7ef94945b6597484cd3cafe7640` | Quality #4093, Rules #2311, Playwright #4130, preview #3376 | A195 physical Android/screen reader |
| SW-196 | #871 | `b1c9efecf8801a5c1857b0f128adcf7a66f0367e` | Quality #4095, Playwright #4132, preview #3377 | A196 deployed-build combinations |
| SW-197 | #872 documentation | See PR exact head | Documentation checks pending | A197 exact-SHA live TEST and rollback |

Each implementation was integrated with current main and checked before merging
into main; no PR was merged into a feature base. Separate focused assurance fixes
SW-431/#873 and SW-432/#877 were also checked and merged first. They preserve exact
query and meeting-save assertions without increasing retries or test timeouts.
Current main post-merge checks/deployment must also finish successfully; PR checks
alone do not establish the live TEST or production acceptance result.

## Reconciliation and functional inventory

Baseline main: `034233ef4f68a2f96e9d4f9564e6b6254a009eb7`.
Read live SW-177, SW-190–197, SW-179 and SW-417; inspected the attached weekly mockup.
No repository AGENTS.md was found. No open PR existed at initial reconciliation.
SW-179's current MUI theme tokens/shared components are the styling reference;
no group banner, emblem, menu structure, navigation routes or grants were changed.
All supported themes inherit the existing palette rather than hardcoded colours.

SW-417 owns the meeting editor. Historical operational corrections already permitted
by the application remain available through the existing record workflow; schedule
entry points expose View/Copy rather than bypassing the deliberate reopen process.
This wording discrepancy was recorded on SW-177 before affected implementation.
Older 'Super Admin' wording means the existing Superuser (`super-admin`) role.

No existing event-copy lifecycle was found. This discrepancy was recorded on SW-194.
The new dialog calls canonical `createEvent`, allocates a distinct ID, starts Draft,
rechecks eligible audience and never imports attendance or received consent. It does
not add a second dataset or migrate records. Existing event create/edit pages and
persistence modes are retained.

| Existing capability | Redesigned entry point / retained implementation |
| --- | --- |
| Weekly Create Meeting | Same visible Create Meeting route and creation flow |
| Open meeting details, planning, attendance, leaders, uniform, injuries and notes | Same canonical `?meeting=` editor and save/validation services |
| Weekly badgework, equipment, programme share, save/close | Same record editor and secondary workflows |
| Past meeting corrections and locked programme | Same canonical permission model and record editor |
| Meeting View/Copy | Tile links use existing record and copy routes; source remains canonical |
| History search, section/date filters, reopen and future-closed cleanup | Existing Meeting History panel retained below schedule |
| Schedule section scope | Canonical loader and effective permissions; filter can only narrow loaded records |
| Events search, section/status filters and totals | Existing EventListPanel controls retained |
| Add Event and future editing | Existing creation/edit routes, unsaved-change policy, validation and save services |
| Event View | Existing event record route |
| Audience, consent, responses and roster | Existing canonical records, scoped services and event detail workflows |
| Reports, exports, gallery, badgework and equipment | Existing event detail actions remain available through View |
| Back, return destinations and deep links | Existing route/back bridges; no new detail/editor routes |
| Rollback | Existing lists restored by one persisted presentation setting; no record writes |

The unchanged implementation paths are inventory evidence, not a substitute for
runtime parity acceptance. Existing event audience/consent suites and meeting
lifecycle/copy/reopen suites must still pass.

## Acceptance plan — one identified test per child

Run all tests against one recorded exact deployed SHA with synthetic, authorised TEST
accounts. Record desktop/browser, Android device/browser and assistive technology
versions. Confirm the environment banner before mutating fixtures.

| Test / Jira | Test procedure | Pass condition |
| --- | --- | --- |
| A190 / SW-190 | As Superuser select Redesigned schedules, reload and open a second session; confirm both pages switch. As ordinary leader, administrator and parent attempt settings access/write. Select Existing and reload. | Only active Superuser can change it; missing setting defaults Existing; both lists switch live and persist independently of navigation; audit metadata identifies writer/time; canonical records do not change. |
| A191 / SW-191 | On both lists browse dates with Android swipe, pointer controls, keyboard Left/Right/Home/End and the date picker. Include zero, one, duplicate-date and large schedules. | Correct selected tile/date/announcement stay synchronised; no swipe-only action, focus loss, scroll trap or page jump; loading/empty/error states are useful and recoverable. |
| A192 / SW-192 | Browse scoped meetings around today, then change section. Check none/one/many named activities and badges/levels, long text and Create Meeting. Open a record, save, return and switch Existing. | Today, next, then latest-history fallback is correct; section and summaries remain accurate; same saved record, Create, details and all existing workflows work in both presentations. |
| A193 / SW-193 | Browse/filter past, today, ongoing and future events; open selected-member/section/mixed audience examples and inspect consent, responses, roster, reports and gallery. Switch Existing. | Selection, summary and scoped detail identity are correct; existing audience/consent/response functionality and existing filters/actions remain intact. |
| A194 / SW-194 | As authorised and read-only/scoped users move past/future; copy one past meeting and one past event, then inspect source and destination IDs, rosters and consent. Reopen a meeting only via its explicit workflow. | Future Edit is authorised; past tiles expose View/Copy; forbidden actions stay absent and backend rejects forbidden writes; each copy is distinct, source unchanged, attendance/consent reset; reopen is not bypassed. |
| A195 / SW-195 | On physical Android portrait/landscape, tablet and desktop keyboard, review long summaries and both pages. Use TalkBack/screen reader, zoom and visible focus; capture mobile/desktop screenshots. | No clipping/page overflow, nested scroll trap or unstable focus; 44px controls; clear selected-state announcements; DD-MM-YYYY dates and current menu styling; emblem/banner remain intact. |
| A196 / SW-196 | Run required automated checks and changed-area browser suites for all four navigation/schedule combinations, including empty lists, read-only/section negatives, copy and rollback no-write snapshots. | First-attempt assertions pass on desktop and representative mobile; no weakened assertions/retries/timeouts; required CI is green for each main-targeted exact head. |
| A197 / SW-197 | Verify deployed build metadata against approved main SHA, execute A190–A196 in live TEST, capture evidence and perform on/off rollback with record snapshots. End with Existing selected. | Exact SHA and deployment run documented, functional/accessibility evidence complete, no data loss/duplication, rollback verified. Record PMT separately; production enablement needs its authorised rollout. |

## Evidence to fill after deployment

- Acceptance candidate merged main SHA: `f0816fe00ece2c2a58d846e312e0390b1d12c9fa`; Hosting build-info SHA MATCHED.
- Firebase TEST deploy run: `39238309355`, SUCCESS. Hosting build-info matches candidate SHA, build time `2026-10-19T10:33:57.843Z`.
- Device/browser/keyboard/screen-reader versions: PENDING.
- A190–A197 result, timestamp, tester, screenshots and defects: PENDING.
- Canonical source/destination IDs and before/after snapshots: PENDING.
- Final TEST setting Existing, writer and audit timestamp: PENDING.
- Production deployment/enablement authorisation: PENDING.
- PMT result: PENDING.

See `rollout.md` for the Superuser enable/rollback procedure. Do not treat empty
evidence fields, green CI, successful Hosting preview or a merge as acceptance.
