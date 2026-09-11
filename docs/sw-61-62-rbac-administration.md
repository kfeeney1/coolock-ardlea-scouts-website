# SW-61 / SW-62 — Roles, Permissions & Administration

## Authoritative model

The application uses one coordinated RBAC model rather than a second runtime permissions system.

System access roles are `leader`, `admin` and `super-admin`. Scouting appointments remain a separate operational layer. Canonical permission definitions live in `src/security/permissionRegistry.ts`; protected data access continues to be enforced independently by `firestore.rules`, `storage.rules`, route guards and mutation services.

Role assignment and permission configuration are deliberately separate concepts:

- **Role assignment** changes which supported role or appointment a user has. Existing assignments are managed through Leader Access & Organisation subject to the delegation policy and Firebase Rules.
- **Permission configuration** defines what a supported role or appointment means. These definitions are security-protected code policy because Firebase Rules cannot safely consume arbitrary client-authored runtime switches.

This avoids a UI that appears to change permissions while backend authorization remains unchanged.

## SW-61 — Super Admin full access

### Root cause

The effective permission catalogue inherited `leader` and `admin` grants for a `super-admin`, but it did not inherit permissions granted through operational Group Leadership appointments. This meant the highest application-level role could appear to lack group-wide capabilities such as programme, weekly-meeting, event-gallery, badgework and ordinary operational-delegation permissions even though the backend already treats a valid Admin/Super Admin profile as section-unrestricted for the corresponding administrative access paths.

### Fix

`effectivePermissionsFor` now treats `super-admin` as the explicit authoritative override for every non-parent administrative and operational permission entry.

Parent-only relationship permissions remain excluded. A Super Admin does not become a parent of every member; linked-child permissions continue to depend on the parent relationship model.

Ordinary Admin behaviour is unchanged. Admin does not gain `roles.manage.admin`, protected Super Admin authority, or appointment-only escalation simply because Super Admin was corrected.

## SW-62 — useful Roles & Permissions administration

The Roles & Permissions page now makes the existing administration path explicit rather than pretending that protected Firebase-backed permissions are runtime-editable.

The page now provides:

- clear separation between role assignment and protected permission policy;
- a system-role matrix describing Parent / Guardian, Leader, Admin and protected Super Admin;
- effective permission and enforcement information for the signed-in user;
- an actionable **Manage user roles & appointments** entry point for actors already authorised by the existing delegation model;
- explicit boundaries for Group Leadership, Admin and Super Admin;
- protected-policy labelling for permission definitions.

Group Leader and Deputy Group Leader may reach the existing narrowly scoped delegation interface for ordinary Leader section scope and permitted operational appointments. Admin may manage ordinary leader activation, sections and appointments. Only Super Admin may promote or demote non-Super-Admin accounts between Leader and Admin.

## Protected Super Admin safeguards

Existing safeguards remain authoritative:

- ordinary users and Group Leadership cannot grant Admin or Super Admin system roles;
- Admin cannot promote a Leader to Admin;
- Super Admin promotion/demotion is limited to non-Super-Admin targets;
- protected Super Admin accounts cannot be altered through ordinary `adminUsers` delegation;
- no client UI is treated as an authorization boundary;
- direct Firestore writes remain subject to Rules;
- production users or permissions are not modified by this work.

## Canonical profile invariant

TEST Super Admin identities are deterministically seeded as active `super-admin` profiles with the canonical `sections: ["Group"]` shape. Firestore and Storage currently require every active leader-side profile, including system administrators, to retain a non-empty sections list. SW-61 does not relax this established profile-shape invariant because doing so is not required to correct the verified permission defect and would unnecessarily widen the Rules/Storage change surface.

## Regression coverage

Unit coverage verifies that Super Admin receives every non-parent administrative/operational permission while ordinary Admin and lower roles retain their existing boundaries.

Playwright coverage verifies:

- unauthenticated Roles & Permissions access is rejected;
- ordinary leaders can inspect policy but cannot reach role-assignment actions they do not own;
- Deputy Group Leader retains Group Leadership operational delegation without Admin authority;
- Admin can reach ordinary role administration but cannot grant Admin/Super Admin;
- Super Admin receives the full protected administrative and operational bundle;
- linked-parent permissions are not falsely inherited by Super Admin;
- protected Super Admin messaging and role-administration entry points remain visible;
- desktop and Pixel 7/mobile behaviour remain usable.

Existing direct Firebase Rules tests continue to prove Admin promotion denial, Super Admin promotion authority over non-protected targets and protected Super Admin immutability.

## Environment boundary

This work is development/TEST-only. It does not deploy production, change production users, seed production, or alter the manual-only production deployment safeguard.
