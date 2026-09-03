# Stage 20.5 — Action confirmation and feedback

## Scope

Stage 20.5 reviews high-impact operational actions so confirmation, success and failure feedback is predictable and accessible without changing authorization, data semantics, audit requirements or server-side validation.

The first implementation slice covers **Parent Access revocation** because revoking an approved account immediately removes all linked member and section access.

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

## Preserved boundaries

This slice does not alter:

- Firestore, Auth or Storage Rules;
- administrator role requirements;
- parent approval, rejection or child-linking semantics;
- parent-account or member data models;
- audit event category/action/description semantics;
- deterministic seed contents;
- workflow security, provenance controls or branch-protection requirements;
- production data or the parked production TEST-data cleanup process.

## Next review target

Review **Leader Access & Organisation** next. Saving that screen can change account activation, system role, permitted sections and public organisation visibility in one operation, so Stage 20.5 should determine which high-impact changes warrant explicit confirmation and how to keep save success/failure feedback clear without changing Super Admin-only role restrictions.
