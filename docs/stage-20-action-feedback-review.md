# Stage 20.5 — Action confirmation and feedback

## Scope

Stage 20.5 reviews high-impact operational actions so confirmation, success and failure feedback is predictable and accessible without changing authorization, data semantics, audit requirements or server-side validation.

The first implementation slice covers **Parent Access revocation** because revoking an approved account immediately removes all linked member and section access. The second covers **Leader Access & Organisation** where one save can alter account activation, system role, permitted sections or public organisation visibility. The third covers **Event lifecycle completion**, where completing an event moves it into read-only history. The fourth covers **Member Management status transitions**, where changing Active, Inactive or Left status creates a lifecycle-history event and changes the member's operational state. The fifth covers **Join Us enquiry conversion**, where an accepted enquiry creates a persistent active member record and links that record back to the enquiry.

## Action feedback contract

High-impact actions should follow these rules where applicable:

- destructive, revocation or access-removal actions should use an accessible in-app confirmation rather than a browser-native prompt;
- confirmation copy should identify the action and explain its immediate consequence in plain language;
- the safe/cancel path must leave persisted data unchanged;
- the destructive action should remain visually and semantically distinct from the safe path;
- success and failure feedback should remain visible in the page context after the action completes;
- existing audit events, permission checks and service-layer validation must remain authoritative;
- confirmation UI must not weaken role restrictions, broaden record scope or bypass guarded server-side behaviour.

## First slice — Parent Access revocation

The Parent Access screen already required a confirmation before revoking an approved parent account, but used `window.confirm`. That prompt is browser-native, has limited styling/accessibility control and is inconsistent with the rest of the MUI application.

This slice:

- replaces the browser-native revoke prompt with a labelled MUI dialog;
- names the affected parent in the dialog;
- explicitly states that linked children and sections are cleared immediately while the account and historical records remain intact;
- provides separate **Cancel** and destructive **Revoke Access** actions;
- preserves the existing `updateParentAccess(..., "revoked")` operation, audit event, success alert, failure alert and reload behaviour;
- extends deterministic Playwright coverage to open and cancel the in-app confirmation without mutating the seeded approved account.

## Second slice — Leader Access & Organisation

The Leader Access & Organisation screen already exposes one **Save Leader** action for both routine organisation-chart edits and access-affecting changes. Before this slice, deactivating an account, changing its system role or permitted sections, or changing public Who's Who visibility could be persisted with the same immediate save interaction as a title or display-order edit.

This slice keeps the ordinary save path lightweight while adding explicit review when the draft differs from the last loaded record in an access-affecting field:

- account activation/deactivation;
- system role;
- permitted account sections;
- public Who's Who visibility, including removal caused by changing away from the Leader role.

The confirmation dialog identifies the affected leader and lists the specific consequences detected before the service call runs. **Cancel** closes the dialog without persisting the draft; a later **Refresh** restores the last loaded values. Routine organisation-only edits such as scouting title, organisation section, display order and reporting line continue to use the existing direct save flow.

The existing `updateLeaderAccess` service, Super Admin-only role selector restriction, super-admin account safeguards, audit event, success/error alerts and organisation/public projection sync remain authoritative. Deterministic Playwright coverage uses the existing private multi-section leader fixture, stages a deactivation, verifies the review dialog, cancels it and refreshes to prove no persisted change occurred.

## Third slice — Event lifecycle completion

An existing event can move through its lifecycle to **Completed** from the event editor. Completion is materially different from an ordinary event edit: after the service accepts the transition, the event moves into history and its event details, roster changes and equipment changes become read-only while attendance viewing, reports, exports and gallery access remain available.

The editor already showed an inline warning when **Completed** was selected, but **Save Event** immediately called the existing update path. This slice adds a final review step before that service call:

- selecting **Completed** and pressing **Save Event** changes the existing editor into an accessible **Complete this event?** confirmation step;
- the confirmation names the event and explains that it will move into read-only history;
- **Cancel completion** returns to the editable draft without persisting anything;
- **Complete Event** invokes the existing save callback and therefore the existing `updateEvent` service;
- ordinary event edits and event creation keep their existing direct-save behaviour;
- existing lifecycle-transition validation, attendance/consent close-out checks, projection updates, audit event and success/error feedback remain authoritative;
- deterministic Playwright coverage stages completion of the existing open Beavers event fixture, cancels it, closes the editor and refreshes to prove the event remains Open and editable.

## Fourth slice — Member status transitions

The Member Management editor uses the same **Save Member** action for ordinary contact/detail edits, section changes and transitions between **Active**, **Inactive** and **Left**. The existing member service already treats a status transition as lifecycle history and audits it, but before this slice the UI persisted that operational-state change immediately with the rest of the draft.

This slice adds explicit review only when the status differs from the last saved member record:

- **Active**, **Inactive** and **Left** transitions all require a labelled **Confirm member status change?** review before `updateMember` is called;
- the confirmation identifies the member, shows the previous and proposed status, and explains the consequence of the target state;
- moving to **Inactive** or **Left** explicitly explains that the member record and lifecycle history are retained;
- returning to **Active** explains that the member returns to active status in the register;
- **Cancel status change** returns to the editable draft without persisting it, so the leader can revise or abandon the change;
- ordinary contact/detail edits and section-only changes keep the existing direct-save path;
- member creation keeps its existing flow and does not add a redundant status confirmation;
- the existing `updateMember` service remains responsible for section permissions, atomic member-history writes and audit events;
- deterministic Playwright coverage stages an existing active seeded member as **Left**, cancels the review, closes the editor and refreshes to prove the member remains Active.

## Fifth slice — Join Us member conversion

An accepted Join Us enquiry can be converted into a member with **Create Member Record**. The existing conversion path already re-checks the live enquiry inside a Firestore transaction, refuses conversion unless the enquiry is still **Accepted**, refuses duplicate conversion, creates the new member as **Active**, and links the new member ID back to the enquiry. Before this slice, the UI relied on browser-native `window.confirm` before invoking that service.

This slice moves that action onto the same in-app review contract:

- **Create Member Record** now opens an accessible **Create member record?** dialog instead of a browser-native prompt;
- the confirmation identifies the child and explains that a persistent Active member record will be created in the enquiry's section and linked back to the accepted enquiry;
- the confirmation states that the existing conversion service will re-check accepted status and duplicate-conversion state before creating anything;
- **Cancel conversion** closes the dialog without calling the conversion service or persisting a member link;
- confirming invokes the existing `convertJoinApplicationToMember` service and keeps the existing success and failure feedback;
- workflow-status changes, notes and contact-history behaviour are unchanged;
- the existing transaction, accepted-status requirement, duplicate-conversion guard and record-linking semantics remain authoritative;
- deterministic Playwright coverage uses the existing `TEST_flow_join_accepted` fixture, opens and cancels the confirmation, reloads the record, and proves **Create Member Record** remains available with no member created.

## Preserved boundaries

These slices do not alter:

- Firestore, Auth or Storage Rules;
- administrator and Super Admin role requirements;
- parent approval, rejection or child-linking semantics;
- leader-access service validation or organisation/public projection semantics;
- event lifecycle transition rules, close-out validation, event projections or completed-event read-only rules;
- member service validation, section permissions, lifecycle-history semantics or audit behaviour;
- Join Us workflow-status semantics, conversion transaction semantics, accepted-status validation, duplicate-conversion safeguards or member/enquiry linking;
- parent-account, member, leader-access, organisation, event or Join Us data models;
- audit event category/action/description semantics;
- deterministic seed contents;
- workflow security, provenance controls or branch-protection requirements;
- production data or the parked production TEST-data cleanup process.

## Next review target

Review **Leader Registration request approval and rejection** next. The current request-review dialog explains that approval creates an active section-scoped Leader account, but its **Reject** and **Approve as Leader** actions immediately call the corresponding registration services from the same review dialog. Because approval creates operational access and rejection closes the pending request, Stage 20.5 should inspect whether these final actions need an explicit consequence-focused confirmation step while preserving the existing administrator restriction, registration service validation and audit behaviour.
