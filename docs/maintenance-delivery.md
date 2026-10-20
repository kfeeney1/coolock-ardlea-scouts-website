# SW-330 — Maintenance delivery and assurance

Implementation is prepared as four dependent, focused PRs. SW-330 and SW-331–SW-334 remain **In Progress**. No Production Manual Testing pass or Done status is claimed. Keep Maintenance disabled until the integrated Firebase TEST build is accepted.

## Reconciliation

Live Jira initially recorded all five tickets To Do, with no comments or linked dependencies. Main at reconciliation was `c1604785`. No facilities Maintenance implementation or matching work branch was found. Existing equipment maintenance incidents are a separate workflow and remain intact. The implementation reuses the current branding/theme, authenticated header, leader navigation presentations, configuration transaction mechanism and attachment size/type validation.

| Jira | Implementation | PR dependency |
|---|---|---|
| SW-330 | Integrated Tasks/Documents area, independent rollout and complete member workflow | All four children |
| SW-331 | Guarded routes; active leaders, approved parents and active members linked by `accountUid`; both leader menu versions; parent header entry; default-disabled Superuser setting | #891 → main |
| SW-332 | Paginated documents; validated PDF/JPEG/PNG/WebP uploads up to 10 MB; retained filename, size, uploader and timestamp; authenticated open/download; recoverable pending uploads | #893 → #891 |
| SW-333 | Task creation with description and optional ready-document links; compact cards; persisted details and navigation | #894 → #893 |
| SW-334 | Explicit assignment; exactly-one Group Leader default; missing/ambiguous/default rejection; completion/reopen; revision conflicts; paginated tasks; integrated assurance and screenshots | Final child → #894 |

The feature uses an isolated `maintenance` Firebase Functions codebase in the same Firebase project as the application. It has no email provider dependency. Every operation checks canonical group membership and rollout; direct Maintenance Firestore and Storage access is denied, including for Superusers. Backend identifiers cannot select another group or arbitrary file path. TEST and Production retain separate project/bucket bindings. The existing event-save mechanism remains unchanged.

Document uploads reserve a stable metadata record before writing bytes. Failed finalisation retains a pending record and stable upload ID so retry can resume. Pending files cannot be downloaded or linked. Task creation is idempotent. Assignment/status updates validate current appointment data inside a Firestore transaction, preserve links and reject stale revisions. The appointment adapter is generated from the canonical scouting appointment implementation and checked by Quality.

## Development assurance

| Check | Observed result |
|---|---|
| Complete `npm run quality:checks` | Passed: lint, 874 unit, 51 email-worker, 5 Maintenance backend and 8 existing backend tests; repository contracts; source complexity; build |
| Maintenance backend production dependency audit | Passed, zero vulnerabilities |
| Dedicated Firestore/Storage rules | 3 passed, no retries |
| Persisted backend integration | 1 passed, no retries: access denial, account-linked member access, upload idempotency/download, tasks with/without documents, invalid links, multiple/missing Group Leaders, explicit assignment, completion/reload, stale revision, inactive assignee and rollback retention |
| Desktop and Android-sized visible-control browser cases | 8 passed, zero retries: rollout/navigation/Back, keyboard upload/download, default assignment/completion/reload, approved-parent document linking and explicit assignment |
| Final detail-state visual check after loading-label refinement | 2 passed, zero retries; lint/build also passed |
| Required GitHub checks at final PR heads | Pending; do not substitute local results or an earlier-head pass |

Local browser checks used stable Chrome 155 with the repository's desktop and Pixel 7 projects. The pinned local Playwright Chromium download was unavailable. This workspace blocks the Functions emulator's Unix worker sockets, so browser checks used the loopback-only `tests/maintenance/local-gateway.mjs`: it verifies Auth emulator tokens and invokes the same exported callable handlers against the real Firestore/Storage emulators. CI remains configured to use the actual Functions emulator and pinned browser. These local results do not prove deployed transport, physical Android or live TEST acceptance.

## Screenshots

All are synthetic local-emulator data, not deployed TEST or Production screenshots.

| View | Desktop | Android-sized |
|---|---|---|
| Tasks | [Desktop](evidence/sw330/tasks-chromium.png) | [Android-sized](evidence/sw330/tasks-mobile-chromium.png) |
| Documents | [Desktop](evidence/sw330/documents-chromium.png) | [Android-sized](evidence/sw330/documents-mobile-chromium.png) |
| Task details | [Desktop](evidence/sw330/task-details-chromium.png) | [Android-sized](evidence/sw330/task-details-mobile-chromium.png) |

## Rollout and rollback

As an authorised Superuser, open **Leader Dashboard → Settings → Maintenance** (`/leader/settings`). Choose **Maintenance enabled** only for the accepted rollout. It is independent of navigation, schedules and attendance. Missing settings default to disabled.

To roll back, select **Maintenance disabled**. Entry points disappear, guarded routes stop exposing workflows, and backend operations reject access. Tasks, document metadata and file bytes remain retained for later re-enablement. Changing this setting does not grant membership or leader eligibility.

Merge/review order is SW-331 → SW-332 → SW-333 → SW-334. After each dependency merges, retarget/rebase the next PR onto current main and require fresh checks. The drafts target their feature dependencies so their diffs remain one Jira each; main-only workflow filters mean their required checks must run after retargeting. The new backend deployment also needs its actual TEST deployment/IAM/API provisioning verified. No live deployment or IAM success is assumed.

## Live Firebase TEST acceptance — pending

The integrated change has not merged to main or been separately verified on the deployed TEST project. A successful PR Hosting preview is not a Maintenance API deployment or an end-to-end TEST pass. Required work after the chain merges: verify the deployed commit and isolated Maintenance functions, enable only in TEST, repeat all four scenarios below with synthetic accounts/files, verify unauthenticated/out-of-group denial and rollback, then record TEST results separately. Physical Android Back, PDF opening and downloads, keyboard/focus and deployed error recovery remain acceptance items.

## PMT — one end-to-end scenario per child, all pending

| Jira | Scenario and expected result |
|---|---|
| SW-331 | After the approved release, a Superuser enables Maintenance. An approved parent and a leader enter Tasks/Documents through their visible menus; verify existing/redesigned leader navigation, refresh, deep links, browser/Android Back and in-app returns. Signed-out/out-of-group accounts cannot access records. Disable and confirm routes/entries are blocked; re-enable and confirm records remain. |
| SW-332 | A member uploads a uniquely named maintenance bill, reloads Documents, opens it and downloads it, checking name/content/date. Reject an unsupported or oversized file without a success message. Interrupt/retry a supported upload and confirm one ready record, or use Resume upload for its pending record. |
| SW-333 | A member raises a task without a document, then another with the retained bill; verify both cards/details after reload. Reuse the same bill on another task and confirm both links persist. Trigger a recoverable validation/save failure and confirm entered description/selections remain. |
| SW-334 | Raise a task using the default Group Leader, then assign a different eligible leader explicitly. Complete it, reload, reopen it and verify responsibility and document links remain correct. Compare the responsible names with approved appointment records. Missing/multiple/default and stale-update cases are additionally covered with synthetic emulator/TEST fixtures. |

Record Production pass/fail evidence per Jira only after the user performs PMT. No automated or TEST result closes those PMT outcomes.
