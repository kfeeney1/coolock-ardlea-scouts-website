# SW-586 equipment option integrity

The callable is deployed by the TEST workflow after review and merge. Direct
Firestore updates and deletes of catalogue options are denied. A retired name
is reserved to prevent an old selection from reintroducing an assignment.
No production deployment is included.

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

## Implementation

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

A manager-initiated rename or deletion uses one callable invocation. The
transaction reads current authority, the target option, its retired-name
registry, and at most 1,001 catalogue documents and 1,001 inventory documents
per attempt. It fails closed above 1,000 documents in either collection and
above 248 matched items for rename. A rename writes two records per matched
item plus the option and retirement metadata. Normal inventory assignments
check the relevant retirement registry, at most two document lookups on create
and only changed labels on update. Stock-only updates do not add lookups.
Imports check the same registry in their write transactions. There is no
scheduled workload or separate service.

Validate the callable deployment permission in the existing TEST project.
The main-only TEST workflow targets the single named function. Review and
approve the equivalent production function deployment separately before
releasing client and Rules changes to production.

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
