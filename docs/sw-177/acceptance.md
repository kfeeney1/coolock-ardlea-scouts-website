# SW-177 acceptance and delivery evidence

## Status and release boundary

Development is proposed in focused draft PRs. No child or epic is Done. The new
experience is disabled by default; no live TEST or production setting was changed.
These are separate gates:

- Development: local quality checks pass; scoped schedule-setting Rules test passes.
  Browser scenarios are authored but have not passed locally. Local installation of
  repository-pinned Playwright 1.62.1 Chromium and headless shell failed because the
  download endpoint returned HTML instead of a browser archive. This is a tooling
  blocker, not a test pass or evidence that application scenarios work.
- CI: SW-190 PR #865 Quality, Firebase Rules and TEST PR Preview passed on its exact
  head. All four Playwright shards and aggregate run #4108 also completed successfully. Other draft PRs are
  stacked on feature bases and must receive fresh required main-targeted CI in order.
- Live Firebase TEST: SW-197 acceptance is NOT executed. A PR Hosting preview alone
  does not prove its Firestore Rules or complete stack is deployed to TEST.
- PMT: NOT executed. No production deployment or enablement has been performed.
- Screenshots: the SW-195 browser test captures and attaches both schedule pages on
  desktop and mobile. Actual screenshots are still pending successful browser runs.

## Focused PR sequence

| Jira | PR | Change and validation | Remaining gate |
| --- | --- | --- | --- |
| SW-190 | #865 | Persisted Superuser setting, Rules, settings UI; full local quality and scoped emulator Rules pass; persistence/independence/rollback browser test added | Required-check review and live settings acceptance |
| SW-191 | #866 | Shared schedule component and deterministic selection; selection unit cases, build/lint/contracts pass | Browser swipe, keyboard, selection and focus acceptance |
| SW-192 | #867 | Canonical Weekly Meetings list integration; full local quality passes; selection/summary/destination/fallback browser test added | Main CI, functional browser and TEST acceptance |
| SW-193 | #868 | Canonical Events list integration and existing filters/summaries; full local quality passes; selection/summary/fallback browser test added | Main CI, event parity and TEST acceptance |
| SW-194 | #869 | Past/future action presentation, distinct canonical event draft copy; action/copy unit cases and full local quality pass; browser source-integrity test added | Main CI, meeting/event copy and permission acceptance |
| SW-195 | #870 | Shared DD-MM-YYYY picker, Ireland date, blank-summary handling; full local quality passes; axe/focus/layout/screenshots browser checks added | Main CI, screenshots, physical Android and screen-reader acceptance |
| SW-196 | #871 | Four targeted flag-combination cases, native touch/pointer synchronisation, no-write snapshots, read-only/section negatives, empty state and owned-fixture cleanup; local quality/contracts pass | Execute browser suite and main CI |
| SW-197 | Acceptance documentation PR | Acceptance plan, inventory and rollout/rollback evidence template | Exact-SHA live TEST and PMT remain open |

PRs #866 onward use the preceding feature branch solely to keep each review focused.
Do not merge into those feature bases. After each dependency is merged, rebase and
retarget its successor to main and require fresh policy checks. No merge is implied
by opening these drafts.

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

- Approved merged main SHA: PENDING.
- Firebase TEST deployment run and build-info SHA: PENDING.
- Device/browser/keyboard/screen-reader versions: PENDING.
- A190–A197 result, timestamp, tester, screenshots and defects: PENDING.
- Canonical source/destination IDs and before/after snapshots: PENDING.
- Final TEST setting Existing, writer and audit timestamp: PENDING.
- Production deployment/enablement authorisation: PENDING.
- PMT result: PENDING.

See `rollout.md` for the Superuser enable/rollback procedure. Do not treat empty
evidence fields, green CI, successful Hosting preview or a merge as acceptance.
