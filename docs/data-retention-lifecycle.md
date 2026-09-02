# Data retention and privacy lifecycle

Stage 19.4 establishes a deliberate lifecycle boundary for every canonical Firestore root collection before any destructive retention automation is considered.

The machine-readable source of truth is `scripts/data-retention-contract.mjs`. Its coverage is checked against `scripts/firestore-collection-contract.mjs`, so a new root collection cannot be added without also receiving an explicit lifecycle classification.

## Safety boundary

This stage is intentionally non-destructive.

- There is no production purge workflow.
- There is no age-based deletion job.
- No Firestore Rules are weakened to permit deletion.
- No production credentials are added to CI.
- Existing member, audit, finance, equipment and programme histories are not reclassified as disposable merely because they are old.
- The parked production TEST-data cleanup remains a separate Stage 18.16 activity and is not affected by this policy.

The retention contract therefore describes what must happen before deletion can ever be automated, rather than inventing retention periods that have not yet been formally approved.

## Lifecycle dispositions

The contract uses four dispositions:

| Disposition | Meaning |
| --- | --- |
| `manual-review-required` | The data may eventually need deletion or anonymisation, but only after its purpose, dependencies, legal or operational need and audit requirements have been reviewed. |
| `no-routine-deletion` | Historical or accountability data must not be removed by a generic age-based cleanup. Any later removal requires a separate governance decision. |
| `source-projection` | The document is a derived, public or parent-safe projection and must follow the lifecycle of its named canonical source instead of inventing an independent retention period. |
| `configuration-lifecycle` | Reference or configuration data is retired or replaced deliberately rather than expired by age. |

No automatic-destructive disposition exists in Stage 19.4.

## High-risk domains

### Consent, medical and emergency information

`consentApplications` is classified as special-category data because the current schema can contain medical conditions, medication-management information, GP details, addresses, signatures and emergency or contact information. `eventConsentResponses` and `eventConsentLinks` also require manual review when the consent purpose ends.

Before any later deletion tool is introduced, the project must define an approved retention period and decide what evidence, if any, must remain after the detailed medical or contact payload is removed. That decision must be made separately from this codebase's technical capability to delete records.

### Members and parent links

A member becoming `inactive`, `left`, or moving section is not deletion. `memberHistory` and `memberAdventureSkillProgress` intentionally preserve lifecycle and programme history across section transfers. The `members` record itself contains child, contact and emergency information and therefore requires an explicit offboarding review.

`parentAccounts` contains explicit member links. Parent unlinking and account removal belongs to the Stage 19.5 offboarding path so entitlement removal, account state and audit evidence can be handled together.

### Applications and registrations

`joinApplications` contain child, parent and emergency-contact data and can remain linked to a converted member through `sourceJoinApplicationId`. Closed or converted applications therefore require a deliberate retention decision that preserves necessary provenance without retaining personal details indefinitely by accident.

`leaderRegistrationRequests` similarly require a post-resolution review instead of indefinite passive retention.

### Audit, finance and equipment history

`auditLog`, `financeTransactions`, `financeReconciliations`, `equipmentHistory`, `equipmentLoans` and `equipmentIncidents` are classified as no-routine-deletion records. They support accountability and historical understanding and must not be swept into a generic privacy cleanup.

This classification does not claim that such records must be kept forever. It means any later deletion or anonymisation policy must be domain-specific and explicitly approved rather than inferred from age alone.

### Meetings and events

`weeklyMeetings`, `meetingRecords` and `events` can contain attendance, notes, incident or medical context or consent-related operational history. They are therefore not generic purge candidates.

Public and parent-safe projections such as `publicEvents`, `parentWeeklyMeetings` and `parentGalleryEvents` follow their canonical source lifecycle and may be rebuilt or removed when that source state changes.

## What Stage 19.4 enforces

The unit contract checks fail when:

- a canonical Firestore root collection has no retention policy;
- a retention policy names an unknown collection;
- a collection is classified more than once;
- a policy uses an unsupported sensitivity or disposition;
- a projection does not identify its canonical source; or
- the Stage 19.4 contract drifts away from the canonical root-collection inventory.

This turns retention from an undocumented convention into a schema-governance requirement without introducing destructive production behaviour.

## Follow-on work

Stage 19.5 should build explicit export and offboarding workflows on top of these boundaries. A future destructive retention implementation, if approved, should be a separate reviewed change with dry-run output, dependency checks, audit evidence, backup and recovery prerequisites and production execution safeguards comparable to other destructive maintenance tooling in this repository.
