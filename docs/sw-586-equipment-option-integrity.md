# SW-586 equipment option integrity

Draft for implementation review. This change records the design and acceptance
criteria. Application behavior and deployed Rules still need the implementation.

## Current boundary

Active Leaders can read equipment categories and Stores. The current Firestore
Rules resolve active Quartermaster, Group Leader and Deputy Group Leader
appointments alongside Admin and Super Admin roles for catalogue mutations.
Those grants are already covered by the operational permission and appointment
union suites. Keep them as the authority for settings management.

Equipment items and historical records store names. The option manager checks
the items currently loaded in the browser before deleting. A direct Firestore
delete only checks the caller's role. A browser-side query followed by a
transaction on the option document leaves the same bypass and can race a new
assignment.

## Proposed implementation

Reuse existing authenticated infrastructure for a group-scoped option mutation.
Evaluate the canonical role and active appointments against current Firestore
records. Keep direct client deletion closed when the replacement path is ready.

Use a trusted Firestore transaction to read the option and check references
against the authoritative inventory, including archived items. Treat equivalent
names using the same normalization as the inventory. An unused option can be
deleted once. A referenced option, a stale name or a changed revision returns a
conflict. Inventory writes that assign a configured option must validate the
current catalogue entry in the same atomic operation. Preserve free-form
legacy values already present on records. A stale selection must not silently
turn into a free-form assignment.

For rename, preserve historical labels and the identity of the configured
option. Verify item creation, editing, split/merge moves and trusted imports
before choosing the compatibility representation. Keep records with only a
legacy name readable throughout rollout. A case-only rename or retry must
preserve the same assignments. Reject duplicates and ambiguous legacy names
before mutating records.

## Cost and rollout gate

Measure documents read per delete or rename with representative TEST inventory.
A full catalogue-reference scan costs reads proportional to inventory size,
including on transaction retry. A verified index could bound lookups but would
require a backfill and extra writes on assignment changes. Record the measured
cost and writer coverage before choosing the implementation. Use existing
infrastructure without polling, scheduled reconciliation, a plan upgrade or a
separate service. Keep TEST and PRODUCTION separate.

## Acceptance tests

- Ordinary Leader reads continue to work. Direct unauthorized create, update
  and delete requests fail.
- Quartermaster, Group Leader, Deputy Group Leader, Admin and Super Admin can
  manage options. Valid appointments in a union grant access. Expired or
  revoked appointments do not.
- An authorized manager can delete a genuinely unused option. Direct deletion
  and deletion of an option referenced by an active, archived or legacy item
  fail.
- Concurrent assignment and deletion settle consistently in either order.
  Neither stale form submissions nor retries leave a dangling reference.
- Rename preserves current assignments and historical names. A failed or
  concurrent rename leaves a consistent catalogue and inventory.
- Verify first in emulator CI, then on the reviewed Firebase TEST build. Record
  Production Manual Testing separately.
