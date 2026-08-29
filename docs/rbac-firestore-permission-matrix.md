# RBAC and Firestore permission matrix

This document is a review contract for the current application. It does not replace `firestore.rules`; Firestore Rules remain the authoritative enforcement boundary.

## Identity layers

The application intentionally separates system access from Scout organisation responsibility.

- **Parent**: authenticated through `parentAccounts`, approved status required for linked member/section access.
- **Leader**: active canonical `adminUsers` profile with `role: leader` and one or more assigned sections.
- **Admin**: active canonical `adminUsers` profile with `role: admin`; inherits section access through `hasSection()`.
- **Super-admin**: active canonical `adminUsers` profile with `role: super-admin`; may manage administrator roles where Rules explicitly allow it.
- **Group Leader**: Scout role from `organisationLeadership`; grants selected group-wide operational access.
- **Group Secretary**: Scout role from `organisationLeadership`; grants selected group-wide read access.
- **Quartermaster / Bo'sun**: Scout role from `organisationLeadership`; may manage equipment together with admins and Group Leader.

Client-side route guards and services are usability controls only. Security decisions must be enforced in Firestore Rules or trusted server-side code.

## Permission matrix

Legend: **R** read, **C** create, **U** update, **D** delete, **S** section-scoped, **L** linked-member/linked-section only, **—** denied by default. Field-level allowlists and state-transition constraints in `firestore.rules` still apply.

| Data domain / collection | Public | Parent | Section leader | Admin | Super-admin | Group Leader | Group Secretary | Quartermaster |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `adminUsers` | — | — | R own/active leader lookup only | R/C/U leaders | R/C/U incl. admin role changes except peer super-admin | normal leader rights unless system admin | normal leader rights unless system admin | normal leader rights unless system admin |
| `parentAccounts` | — | R own | — | R/C/U approval data | same as admin | — unless admin | — unless admin | — unless admin |
| `leaderRegistrationRequests` | — | — | R own request | R/U review | same as admin | — unless admin | — unless admin | — unless admin |
| `joinApplications` | C strict schema | — | R/U S | R/U | R/U | R/U via section/group scope | R/U via section/group scope where Rules permit | R/U only through assigned sections unless admin |
| `members` | — | R L | R/C/U S | R/C/U all sections | R/C/U all sections | R group-wide, C/U where Rules permit | R group-wide | R/C/U only assigned sections unless admin |
| Adventure Skill requirements / awards | — | R L | R/C/U/D linked member in S | R/C/U/D | R/C/U/D | R/C/U/D group-wide | R group-wide | normal section-leader access |
| `memberHistory` | — | — | R/C S | R/C | R/C | access follows current member/section rules | access follows current member/section rules | normal section-leader access |
| `events` | — | — | R/C/U S | R/C/U | R/C/U | R/C/U group-wide where Rules permit | R group-wide where Rules permit | normal section-leader access |
| `publicEvents` | R | — | C/U/D S | C/U/D | C/U/D | C/U/D where Rules permit | normal leader rights | normal leader rights |
| `eventConsentLinks` | R active link | R active/linked section | R/C/U S | R/C/U | R/C/U | R/C/U via section/group scope | normal leader rights | normal leader rights |
| `eventConsentResponses` | C strict schema against active link | — | — | R/U processing | R/U processing | — unless admin | — unless admin | — unless admin |
| `consentApplications` | C strict schema | R/U own linked youth consent | R/U S | R/U | R/U | R/U where section/group access permits | R where permitted | normal section-leader access |
| `meetingRecords` | — | — | R/C/U leader meetings S | R/C/U incl. group meetings | same as admin | R group/leader records; create/update per Rules | R group/leader records | normal section-leader access |
| `weeklyMeetings` | — | — | R/C/U S | R/C/U | R/C/U | R/C/U group-wide | R group-wide | normal section-leader access |
| `parentWeeklyMeetings` | — | R L | C/U S | C/U | C/U | C/U group-wide | normal leader rights | normal leader rights |
| `programmeLibrary` | — | — | R/C/U/D S | R/C/U/D | R/C/U/D | R/C/U/D group-wide | normal section-leader access | normal section-leader access |
| Equipment inventory / locations / categories | — | — | R | R/C/U/D where Rules allow | same as admin | R/C/U/D | R/C/U/D | R/C/U/D |
| Equipment loans / programme reservations | — | — | R/C/U for assigned sections | R/C/U all sections | R/C/U all sections | R/C/U group-wide | read only where Rules allow | R/C/U all equipment sections |
| Equipment incidents / history | — | — | create/report and read relevant records | manage/read | manage/read | manage/read | read where Rules allow | manage/read |
| Public site projections | R | R | R | R | R | R | R | R |
| Audit/history collections | — | — | R/C only where explicitly permitted | broader read where explicitly permitted | same or broader where explicitly permitted | role-specific | role-specific | equipment-specific |

## Contract rules

1. **No client role check may grant data access by itself.** Every privileged operation must remain protected by Firestore Rules or trusted server code.
2. **Section access is least privilege.** A normal leader may only access records for sections in their canonical `adminUsers.sections` list unless a specific Scout role grants broader access.
3. **Scout roles do not silently become system roles.** Group Leader, Group Secretary and Quartermaster remain organisational responsibilities and must not automatically gain administrator-account management rights.
4. **Parent access is explicit linkage, never name/email matching.** Parent reads must resolve through approved `memberIds` or `linkedSections`.
5. **Public writes are schema/state constrained.** Public join, consent and event-consent submissions must remain create-only with strict allowed fields and server timestamps. Anti-abuse controls are a separate Stage 14 requirement.
6. **Historical records are append-only wherever practical.** Member history, equipment history and audit records must not become ordinary editable documents.
7. **Delete remains exceptional.** Business records should normally be closed, archived or status-transitioned instead of hard-deleted.
8. **Theme selection never changes permissions.** Default and Modern Scout themes use identical routes, services, rules and persistence behaviour.

## Review checklist for future PRs

A PR that changes a protected collection, role, section scope or parent linkage must answer all of the following before merge:

- Which row in this matrix changes?
- Is the change enforced in `firestore.rules`, not only the UI?
- Is there a positive Firestore Rules test for the newly allowed operation?
- Is there a negative test proving a nearby unauthorised role/section is still denied?
- Does the change preserve parent linkage and sensitive-data boundaries?
- Does it require a migration or compatibility audit for existing documents?

If implementation and this document disagree, treat that as security-contract drift: review `firestore.rules`, tests and this matrix together rather than assuming the document is authoritative.