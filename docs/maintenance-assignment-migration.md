# SW-334 assignment migration

The direct-SDK task foundation is on main via #900 at bbb28241c7502398c2389a6616ffbb6d3ccf110d. Maintenance remains held live.

The initial shared assignment policy preserves leader/admin/super-admin unions, canonical active appointment dates and Group scope. Omitted selection requires exactly one eligible Group Leader. Explicit selection must remain eligible. Progress changes require a matching revision and Open/Complete status. Unit tests cover these policy decisions; this alone is not backend enforcement or acceptance.

## Remaining implementation before review readiness

- Provide a minimal group-member-readable leader directory without exposing adminUsers or private organisation fields. PublicLeadership cannot be used: eligibility must include leaders who opt out of the public website.
- Keep any directory and the default Group Leader index synchronized with canonical appointment/account writes, including revocation, aliases and effective dates. Security Rules cannot query an entire collection to prove a default is unique. A client-computed default alone cannot satisfy backend ambiguity validation. Do not silently substitute the first account or a manually chosen unrelated setting.
- Validate canonical eligibility, default uniqueness, revision, status and immutable document links on Firestore writes. Budget rule lookups across the five supported links.
- Wire transaction persistence, selector, assignment/status controls and recoverable errors into task create/detail. Revalidate before saving, preserve failed form input, and verify reloads.
- Exercise true emulator SDK/rules writes, including parent/member access and forged/default/stale changes, then desktop/mobile visible-control end-to-end scenarios. Reconcile exact-head checks and post-merge assurance.

SW-521 separately restores controlled rollout after this work. SW-522 records deployed TEST and screenshots. Production Manual Testing remains owner-recorded and pending. No paid Maintenance backend is reintroduced by this migration.
