# SW-50 — Leader Access & Organisation role management

## Authoritative role catalogue

System access roles remain separate from Scouting appointments:

- `leader` — ordinary authenticated leader access, section-scoped unless an appointment grants additional group-wide permissions.
- `admin` — administrative access. Admin can manage ordinary leader activation, sections and canonical Scouting appointments, but cannot promote/demote Admin system access.
- `super-admin` — protected system administrator. Only Super Admin can change another non-Super-Admin account between `leader` and `admin`. A Super Admin account cannot be modified through ordinary delegation.

Canonical Scouting appointments are defined in `src/security/scoutingAppointments.ts`. Legacy Deputy Group Leader aliases normalize to canonical `Deputy Group Leader` for reads; new writes use canonical values.

## Delegation boundaries

Group Leader and Deputy Group Leader share the same Group Leadership delegation ceiling. They may change another ordinary `leader` account's section scope and may assign/remove these ordinary operational appointments:

- Group Chairperson
- Group Youth Champion
- Section Leader
- Assistant Section Leader
- Programme Scouter
- Scouter

They may not:

- change their own assignment through Leader Access;
- activate/deactivate accounts;
- change system roles;
- target Admin or Super Admin accounts;
- grant Group Leader or Deputy Group Leader;
- grant Group Secretary, Group Treasurer or Group Quartermaster / Bo'sun;
- alter public Who's Who visibility or organisation-chart hierarchy settings.

Admin/Super Admin may assign any canonical Scouting appointment to an ordinary Leader target. System role promotion/demotion remains Super Admin-only.

## Mutation model

Leader Access mutations use a Firestore transaction. The transaction re-reads actor and target access/organisation records, validates the actor/target delegation boundary, compares record versions to reject stale edits, updates `adminUsers` and `organisationLeadership`, aligns an existing `publicLeadership` projection where permitted, and creates the `auditLog` entry in the same transaction.

A no-op produces no writes. Public visibility remains Admin-controlled. Group Leadership may only keep an already-existing public projection's appointment text aligned when the replacement appointment is public-listing compatible.

## Enforcement map

- Client policy: `src/security/leaderDelegationPolicy.ts`
- Mutation service: `src/services/leaderAccess.ts`
- UI/navigation: `src/pages/LeaderAccessManagement.tsx`, `src/components/admin/LeaderDashboardHeader.tsx`
- Authoritative authorization: `firestore.rules`
- Effective permission catalogue: `src/security/permissionRegistry.ts`
- Direct Rules tests: `tests/firestore/leader-delegation.rules.test.mjs`
- Unit policy tests: `tests/unit/leaderDelegationPolicy.test.ts`, `tests/unit/leaderAccessPermissionRegistry.test.ts`
- Browser journey: `e2e/roles-permissions.spec.ts`

## Security invariants

The UI is not an authorization boundary. Firestore Rules independently deny system-role escalation, self-escalation, protected-target changes, privileged appointment delegation and public-visibility changes. Firebase Auth establishes identity only; authorization continues to come from `adminUsers` and `organisationLeadership`. No production role data is mutated by SW-50.
