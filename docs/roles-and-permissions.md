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

## Current appointment catalogue

Current data and UI support Group Leader, Group Secretary, Group Treasurer, Group Quartermaster / Bo'sun, Group Chairperson, Group Youth Champion, Section Leader, Assistant Section Leader, Programme Scouter and Scouter. Historical Quartermaster/Bo'sun spellings are accepted by existing Rules for equipment access; new canonicalisation work must write only `Group Quartermaster / Bo'sun`.

Deputy Group Leader is intentionally not granted Group Leader parity in SW-48. SW-49 introduces the canonical appointment and a shared Group Leader organisational permission bundle so that the change can be tested as a separate authorization slice.

## Protected delegation boundaries

- Admin cannot promote a Leader to Admin and cannot alter a Super Admin.
- Super Admin can promote/demote non-Super-Admin accounts between Leader and Admin.
- No ordinary appointment can grant Admin or Super Admin.
- Parent access is determined by approved links and cannot be widened by a Scouting appointment.
- Medical, finance, audit and role-management permissions remain code/Rules-defined.
- Runtime permission switches are not provided. The current Firebase architecture has no safe mechanism for a client-managed permission toggle to change Rules enforcement atomically, so exposing such controls would be misleading.

## Effective appointment permissions currently enforced

- **Group Leader**: group member read; group-wide weekly-meeting and parent-facing weekly programme management; protected group/leader-meeting reads; group programme-library management; group badgework write; group finance/subs; equipment management; group-wide event-gallery media access; and audit access. The appointment does **not** make group event records or consent/medical records group-wide, and group meeting-record creation remains Admin-only.
- **Group Secretary**: group member, badgework and meeting read access plus audit access where encoded; it does not inherit the Group Leader write bundle.
- **Group Treasurer**: group member read required by the present finance model plus group finance/subs authority.
- **Group Quartermaster / Bo'sun**: equipment management.
- **Section Leader**, **Assistant Section Leader**, **Programme Scouter**, **Scouter**, **Group Chairperson** and **Group Youth Champion** currently add no group-wide authorization beyond the person's system role and assigned sections. The current Rules do not contain a separate Section Leader-only closed-meeting amendment permission.

Ordinary active leaders can read the group equipment register and equipment history, and can operate equipment loans for their assigned sections. Those read/loan capabilities come from the system Leader role, not from a Scouting appointment.

## Authentication and claims

Firebase Authentication establishes identity, but system role and section authorization are read from the current `adminUsers` document and appointment authorization is read from `organisationLeadership`. The application does not currently use custom role claims as its RBAC source. Firestore Rules do use the authenticated token email when validating attributed audit-log writes.

## Enforcement points

Authoritative enforcement is split across:

1. `firestore.rules` for Firestore reads/writes and protected role invariants.
2. `storage.rules` for protected receipt/gallery objects.
3. `AdminAuthProvider` for approved active Leader-system profiles and section loading.
4. route/page guards for navigation and direct-route UX. These are not a substitute for Rules.
5. domain services that shape data before it reaches Rules.
6. `config/rbac-matrix.json`, permission-registry tests, Firebase emulator tests and Playwright role tests as executable contracts.

## SW-48 architecture decision

The Roles page is intentionally read-only. All entries state a stable permission ID, area, description, scope, default grants, enforcement location and protected status. The page also calculates the signed-in Leader's effective entries from the same registry. Editable permission toggles are deferred because current client-configured state could not safely become authoritative in Firebase Rules.

SW-49 and SW-50 must extend this registry and the server-enforced rules together; UI-only permission changes are prohibited.
