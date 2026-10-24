# SW-341 — Leader training foundation

## Canonical storage and access

Each category has one document at `adminUsers/{leaderUid}/training/{category}`.
Category IDs are `garda-vetting`, `first-aid`, and `child-protection`.
Documents contain `completedDate`, `expiryDate`, monotonically increasing integer
`revision`, `updatedBy`, and server `updatedAt`. No evidence, name, or category
projection is added to broadly readable profile documents. No paid API is added.
Renewal replaces the dates at the same path. An expected revision prevents a
stale editor from overwriting a newer renewal. Deletion is denied.

Existing active Administrator and Group Leader/Deputy Group Leader predicates
control maintenance: Group Leadership can maintain only another ordinary leader,
matching existing delegation restrictions; Administrators can maintain all targets. Active leaders may read their own training records without
write permission. Other leaders, parents, public users and inactive accounts
cannot read the subcollection. These rules do not change existing leader access
or public leadership permissions. SW-342 should use the own profile for self
read-only viewing and existing Leader Access records for group maintenance.

## Dates and rollout

Dates are ISO date-only strings; an empty string explicitly represents a missing
date. Partial records are valid storage but display Incomplete, never Current.
Both missing means Not recorded. Expiry is inclusive: a record expires the day
after its recorded expiry date. Future completion dates display Incomplete.
No renewal interval is inferred. Use the shared date picker and DD-MM-YYYY
formatter in SW-342.

`siteSettings/leaderTrainingExperience` uses the existing version contract:
`existing` (or missing) means off, `redesigned` means on. Only an active Superuser
can write it. The labeled switch is under Superuser Settings with no blurb.
Training reads and writes are rejected while off; documents are retained.
Do not enable in deployed TEST until the dependent interface has been accepted.

## Delivery dependencies

This is the SW-341 data/validation and rollout foundation, not the SW-342 editor
or SW-343 reminders. SW-342 requires this PR on main to remain a focused PR
against main. SW-343 then requires SW-342 for its record destination and reminder
controls. No child is accepted or Done merely because this foundation passes CI.

## Manual verification by Jira

- **SW-341 (after SW-342 is available):** enable as Superuser; create each
  category for two leaders; reload and verify association; edit and renew,
  confirming a single category record; test partial/empty dates, leap dates,
  reversed dates and same-day expiry. Open two sessions and reject stale saves.
  Read own records as leader; reject self-edit and another leader's direct path.
  Disable, verify access denied, re-enable and verify retained records.
- **SW-342 (pending development):** test stacked mobile and three-card desktop
  layouts, DD-MM-YYYY inputs, keyboard/focus, read-only controls, Save/Cancel,
  dirty navigation, retry after save failure and return to original leader list.
- **SW-343 (pending development):** enable one reminder per category, change
  expiry, renew and disable; verify no duplicate/stale calendar items. Check
  permissions across personas, multiple daily entries, existing source types,
  record navigation and return to the same calendar month/filters.

Development/emulator checks, deployed Firebase TEST and owner PMT must be
recorded separately. TEST and PMT remain outstanding.
