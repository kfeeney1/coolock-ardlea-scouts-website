# RBAC test matrix

This matrix is the security test contract for Work Block R. Navigation checks are never treated as authorization evidence by themselves; protected operations require Firestore/Storage emulator coverage or another authoritative enforcement test.

| Actor | System access | Appointment / scope | Representative allows | Representative denies |
| --- | --- | --- | --- | --- |
| Public visitor | none | none | public pages and explicitly public projections | leader routes, private members, finance, medical, audit, role management |
| Parent / Guardian | approved parent account | linked members/sections only | linked member and permitted linked badgework/parent projections | unrelated members/sections, leader administration, finance/audit |
| Ordinary section Leader | leader | assigned section, Scouter/Programme Scouter | assigned-section member/programme/meeting operations; equipment reads and assigned-section loans | cross-section protected data, Activity Log, role management, Admin promotion |
| Section Leader | leader | assigned section, Section Leader | ordinary Leader access plus implemented closed-weekly-meeting operational edits | group-wide appointment powers, Admin/Super Admin operations |
| Deputy Group Leader | leader | Group; Deputy Group Leader | same Group Leadership operational bundle as Group Leader: group member read, weekly programme, programme library, badgework, finance/subs, equipment, gallery Storage, audit, role-appropriate Settings | Admin/Super Admin promotion, account approvals, protected Super Admin mutation, Group Council/Group Leaders meeting creation, automatic group-wide consent/medical/event-record access |
| Group Leader | leader | Group; Group Leader | same Group Leadership operational bundle as Deputy Group Leader | same non-delegable system/admin boundaries as Deputy Group Leader |
| Group Secretary | leader | Group; Group Secretary | encoded group-wide read/audit responsibilities | Group Leadership write bundle, Admin/Super Admin operations |
| Group Treasurer | leader | Group; Group Treasurer | group finance/subs and supporting member reads | unrelated system administration and protected Super Admin operations |
| Group Quartermaster / Bo'sun | leader | Group; Quartermaster | group equipment management | unrelated finance, audit and system-role authority |
| Admin | admin | optional organisational title | ordinary operational administration, account approval and organisation maintenance currently allowed by Rules | promoting/demoting Admin through ordinary Admin authority; altering protected Super Admin |
| Super Admin | super-admin | optional organisational title | protected system-role operations currently reserved to Super Admin | altering another protected Super Admin through prohibited ordinary mutation paths |

## Required Work Block R journeys

SW-48 covers Roles-page visibility, effective permission display, ordinary Leader boundaries, Admin boundaries, Super Admin authority, direct-route denial and desktop/mobile rendering.

SW-49 adds deterministic Deputy Group Leader coverage across the permission registry, navigation/direct routes, Firestore direct access, Storage direct access, equipment/weekly helper logic and operational notification recipient selection. GL and DGL effective permission IDs must remain identical while both remain normal `leader` system accounts.

SW-50 must extend this matrix with appointment assignment/removal, section assignment/removal, Group Leadership delegation ceilings, ordinary Leader denial, Admin/Super Admin target protections, self-escalation denial, stale-edit/concurrency rejection, auditable/idempotent mutations, navigation refresh after a change and stale-session/profile refresh behaviour.
