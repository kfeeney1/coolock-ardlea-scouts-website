# Personal-data retention review workflow

This workflow operationalises the existing `data-retention-lifecycle.md` contract without introducing automatic deletion or inventing retention periods that the Scout Group has not approved.

## Current safe position

Member lifecycle states such as `inactive` and `left` are operational states, not deletion instructions. Existing communications/reminder flows should continue to exclude inactive/left records unless an explicit operational/legal reason requires them. Sensitive and special-category records remain subject to manual review.

## Review triggers

The canonical retention contract defines triggers such as member offboarding, parent offboarding, leader offboarding, consent purpose ending, application resolution, event-consent purpose ending and financial/governance review. `scripts/data-retention-review.mjs` converts those triggers into review items and permitted review actions.

## Controlled decision record

A retention decision must record:

- the collection and, when acting on a specific record, its record id;
- the requested action (`retain`, `restrict`, `anonymise`, `delete`, `rebuild-projection` or `no-action` as permitted by the canonical policy);
- who reviewed the decision;
- the rationale; and
- a timestamp.

Destructive actions (`delete` or `anonymise`) additionally require an `approvedPolicyReference`. Code must reject a destructive decision without that reference. This is intentional: development does not decide how long the organisation must retain child, medical, safeguarding, financial, audit or other records.

## Auditability and execution boundary

The module creates/validates decision records only. It does **not** delete Firestore documents, Storage objects, authentication accounts or production data. A future destructive executor must be separately reviewed, authorised, auditable and covered by Firebase Rules/service tests before it is enabled.

Until the Scout Group approves the relevant retention schedule and operating procedure, a reviewed decision can safely choose `retain` or, where the application supports it, `restrict` from ongoing operational use. Existing source projections should follow their canonical source lifecycle rather than gaining independent retention rules.

## Linked data review checklist

A member/parent/leader offboarding decision must consider linked data before any destructive action is approved, including:

- member lifecycle/history and badge/programme history;
- parent/member account links;
- consent, medical and event-consent records;
- attendance/meeting/event history;
- galleries and photo consent/access projections;
- finance/subs/receipt records and statutory/accountability needs;
- join/registration provenance;
- audit records; and
- uploaded documents/files.

The absence of an approved retention period for any category is a reason to hold the destructive action for owner/data-protection review, not a reason to guess a period in code.

## Organisational decision still required

SW-80 cannot be fully closed by code alone. The responsible Scout Group owner must approve retention decisions by data category and the procedure for access, restriction, anonymisation and deletion requests. Once that policy exists, a separate implementation can wire approved destructive actions into an admin-only service with explicit confirmation, audit logging and Firebase security tests. No production data is bulk-deleted by this work.
