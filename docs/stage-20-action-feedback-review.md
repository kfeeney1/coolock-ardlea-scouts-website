# Stage 20.5 — Action confirmation and feedback

## Scope

Stage 20.5 reviews high-impact operational actions so confirmation, success and failure feedback is predictable and accessible without changing authorization, data semantics, audit requirements or server-side validation.

The first implementation slice covers **Parent Access revocation** because revoking an approved account immediately removes all linked member and section access. The second covers **Leader Access & Organisation** where one save can alter account activation, system role, permitted sections or public organisation visibility.

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

## Preserved boundaries

These slices do not alter:

- Firestore, Auth or Storage Rules;
- administrator and Super Admin role requirements;
- parent approval, rejection or child-linking semantics;
- leader-access service validation or organisation/public projection semantics;
- parent-account, member, leader-access or organisation data models;
- audit event category/action/description semantics;
- deterministic seed contents;
- workflow security, provenance controls or branch-protection requirements;
- production data or the parked production TEST-data cleanup process.

## Next review target

Review **Event lifecycle completion** next. Editing an event can change its status to **completed**, after which the event moves to history and the event record becomes read-only for further editing while attendance, reports, exports and gallery access remain available. Stage 20.5 should make that transition explicit before persistence without changing the existing event service or completed-event rules.
