# Export and offboarding governance

Stage 19.5 makes operational exports and account offboarding explicit without introducing a bulk production data dump or destructive account purge.

## Operational exports

The approved leader reporting exports are declared in `src/services/exportGovernance.ts`. The contract classifies each export by sensitivity, requires a permitted section scope for ordinary leaders, and records the data categories that must remain excluded.

Approved leader-report surfaces are member list, membership summary, event overview, attendance trends, event roster and outstanding consent. Existing report loaders remain Firestore-section scoped and existing UI actions remain audit logged. Medical details and emergency-contact data are not approved for these exports; aggregate exports also exclude member identity/contact data.

This contract is deliberately not an authorisation replacement. Firestore Rules and scoped reads remain authoritative. It also does not create a super-admin database dump, export production backups through GitHub Actions, or put sensitive exports into workflow artifacts.

## Parent offboarding

Parent access now has four explicit states: `pending`, `approved`, `rejected` and `revoked`.

`revoked` is the offboarding state for a previously approved parent account. Revocation:

- requires an explicit confirmation in the Parent Access UI;
- changes the account away from the only status that grants parent access;
- clears `memberIds` and `linkedSections` in the same update;
- records an immutable audit entry stating that access was revoked and links were cleared;
- preserves the parent account and historical records instead of deleting them.

A revoked account may later be re-approved only through the normal identity-verification and child-linking process.

## Leader and member lifecycle

Leader access already uses the canonical `active` flag. An inactive leader profile fails the common active-leader checks and its organisation/public leadership projections are removed by the existing organisation synchronisation path. Stage 19.5 does not delete Firebase Auth users or historical audit records.

Members continue to use `active`, `inactive` and `left`. Marking a member left remains a lifecycle/history event rather than a deletion event, preserving Adventure Skills and member history. Any broader member erasure or data-subject deletion must follow the Stage 19.4 retention classifications and a separately reviewed process.

## Safety boundary

This stage does not add automatic deletion, TTL policies, production purge workflows, Firebase Auth deletion, production backup exports, or medical-data exports. The parked Stage 18.16 TEST-data cleanup remains separate and unchanged.
