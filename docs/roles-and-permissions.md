# Roles and permissions

This document records the effective RBAC model implemented by the application and Firebase Rules. The in-app **Roles & Permissions** page is a readable projection of the canonical registry in `src/security/permissionRegistry.ts`; it is not an authorization service.

## Two separate layers

System access roles and Scouting appointments are intentionally separate.

- **Parent / Guardian** is represented by an approved `parentAccounts` record and can access only explicitly linked members/sections.
- **Leader** is an active `adminUsers` profile with `role: "leader"` and one or more canonical sections.
- **Admin** is an active `adminUsers` profile with `role: "admin"`.
- **Super Admin** is an active `adminUsers` profile with `role: "super-admin"`.
- Scouting appointments live in `organisationLeadership.scoutingRole` and may add only the operational permissions explicitly implemented in Rules.

Appointments do not grant Admin or Super Admin.

## Current appointment catalogue and normalization

The canonical appointment catalogue is Group Leader, Deputy Group Leader, Group Secretary, Group Treasurer, Group Quartermaster / Bo'sun, Group Chairperson, Group Youth Champion, Section Leader, Assistant Section Leader, Programme Scouter and Scouter.

`src/security/scoutingAppointments.ts` is the application-side normalization contract. Legacy Deputy spellings `Deputy-Group-Leader`, `Deputy GroupLead` and `DGL` are recognized for compatibility, and existing Quartermaster/Bo'sun variants remain recognized. New application writes must use canonical values, particularly `Deputy Group Leader` and `Group Quartermaster / Bo'sun`; compatibility aliases exist to avoid silently removing access from historical records, not as new write formats.

## Protected delegation boundaries

- Admin cannot promote a Leader to Admin and cannot alter a Super Admin.
- Super Admin can promote/demote non-Super-Admin accounts between Leader and Admin.
- No ordinary appointment can grant Admin or Super Admin.
- Parent access is determined by approved links and cannot be widened by a Scouting appointment.
- Medical, finance, audit and role-management permissions remain code/Rules-defined.
- Runtime permission switches are not provided. The current Firebase architecture has no safe mechanism for a client-managed permission toggle to change Rules enforcement atomically, so exposing such controls would be misleading.

## Effective appointment permissions currently enforced

- **Group Leader and Deputy Group Leader** share one Group Leadership operational bundle: group member read; group-wide weekly-meeting and parent-facing weekly programme management; protected group/leader-meeting reads; group programme-library management; group badgework write; group finance/subs; equipment management; group-wide event-gallery media access; activity/audit-log read; and the role-appropriate Settings/subs surface. Both remain `leader` system accounts. Neither appointment grants Admin/Super Admin, leader-account approval, parent-account approval, Admin promotion, protected Super Admin mutation, or creation of Group Council/Group Leaders formal meeting records. Group event records and consent/medical records also remain subject to their existing section/workflow boundaries rather than becoming group-wide merely because of the appointment.
- **Group Secretary**: group member, badgework and meeting read access plus audit access where encoded; it does not inherit the Group Leadership write bundle.
- **Group Treasurer**: group member read required by the present finance model plus group finance/subs authority.
- **Group Quartermaster / Bo'sun**: equipment management.
- **Section Leader**, **Assistant Section Leader**, **Programme Scouter**, **Scouter**, **Group Chairperson** and **Group Youth Champion** currently add no group-wide authorization beyond the person's system role and assigned sections. Section Leader retains its specifically implemented closed-weekly-meeting operational edit capability.

Ordinary active leaders can read the group equipment register and equipment history, and can operate equipment loans for their assigned sections. Those read/loan capabilities come from the system Leader role, not from a Scouting appointment.

Equipment incident notifications use the same operational appointment intent: active Group Leader, Deputy Group Leader and Quartermaster/Bo'sun recipients are eligible for urgent equipment alerts. DGL parity is therefore not limited to UI visibility or Firestore reads.

## Authentication and claims

Firebase Authentication establishes identity, but system role and section authorization are read from the current `adminUsers` document and appointment authorization is read from `organisationLeadership`. The application does not currently use custom role claims as its RBAC source. Firestore Rules do use the authenticated token email when validating attributed audit-log writes.

## Enforcement points

Authoritative enforcement is split across:

1. `firestore.rules` for Firestore reads/writes and protected role invariants. The existing `isGroupLeader()` Rules predicate is now the compatibility-aware Group Leadership predicate and covers canonical Group Leader and Deputy Group Leader plus guarded historical DGL aliases.
2. `storage.rules` for protected receipt/gallery objects, using the equivalent Group Leadership predicate.
3. `AdminAuthProvider` for approved active Leader-system profiles and section loading.
4. route/page guards for navigation and direct-route UX. These are not a substitute for Rules.
5. domain services and the email worker where appointment-aware operational behaviour is required.
6. `config/rbac-matrix.json`, permission-registry tests, Firebase emulator tests, Storage emulator tests and Playwright role tests as executable contracts.

## SW-48 / SW-49 architecture decisions

The Roles page remains intentionally read-only. All entries state a stable permission ID, area, description, scope, default grants, enforcement location and protected status. The page calculates the signed-in Leader's effective entries from the same registry. Editable permission toggles are not exposed because current client-configured state could not safely become authoritative in Firebase Rules.

SW-49 implements Deputy Group Leader through inheritance of the existing Group Leader operational permission bundle rather than duplicated feature checks. SW-50 may expose safe appointment and section delegation, but it must preserve the system-role boundary: Group Leadership may not grant Admin/Super Admin, alter protected Super Admin accounts, bypass account approval or self-assign authority beyond its delegation ceiling.
