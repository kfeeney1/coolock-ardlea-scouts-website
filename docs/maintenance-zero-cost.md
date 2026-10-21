> Current rollout policy: [SW-521 rollout](maintenance-rollout.md). Migration-stage holds described below are historical; explicit revision 1 opt-in replaces the blanket runtime hold. Live TEST acceptance and PMT remain separate.

# SW-330: reuse existing website infrastructure

The owner clarified on 20-10-2026 that Maintenance should replicate the rest of the website. The revised architecture uses existing Firebase Auth, Firestore and Storage SDKs and deployed Security Rules. It adds no Cloud Functions, Cloud Run, Cloud Build or Artifact Registry dependency and needs no new hosting provider. Existing Firebase reads, writes, stored bytes and downloads still count toward the website's existing plan and allowances. This is not a guaranteed zero-total-bill claim.

## Delivery order

1. SW-331, PR #898: remove Maintenance from TEST/Production backend deployment targets, block explicit Functions deployment, and replace callable membership checks with direct Firestore SDK access validated by rules. Keep live rollout blocked while documents/tasks are migrated. Emulator development remains available.
2. SW-332: migrate documents to the existing validated Storage upload and authenticated getBlob pattern used by meeting/policy documents. Retain reserved pending metadata and stable IDs for recovery. Add Security Rules validating membership, uploader, types, sizes and immutable records. No public download tokens.
3. SW-333: migrate task creation/list/details to Firestore transactions and queries; validate description, document references and stable request IDs in rules. PR #897 remains draft until revised.
4. SW-334: migrate assignment/completion to transactions and canonical appointment validation in rules; preserve revision conflict checks and relationships. Restore live rollout only after the complete direct-SDK implementation and deployed TEST acceptance.

## Membership foundation

The document maintenance/group/access/{uid} stores only kind and sourceId as a reference to existing canonical data. A user can write only their own reference, only while rollout is enabled, and only if rules verify an active canonical leader, approved parent or active account-linked member. It stores no cached permission, role grant or arbitrary boolean. Subsequent operations must revalidate the referenced canonical record, so disabling a member or parent cannot leave lasting authority in a projection. Account-linked members can query only their own member records; section/leader role unions remain intact.

The Maintenance root remains the project-specific group boundary. Another group path is denied. Document/task access stays closed until the corresponding child rules are implemented and verified.

## Protective controls during migration

- TEST/Production release targets exclude Maintenance Functions.
- Both Firebase configurations reject explicit Maintenance Functions deployment with a predeploy hook.
- Live builds hide Maintenance and block its routes, even if an old rollout setting says enabled. Superuser Settings explains that migration is pending.
- Old callable upload/download helpers reject in live builds pending SW-332 replacement.
- Records are neither deleted nor overwritten. Unrelated features and Firebase deployments are preserved.

These source changes do not delete deployed resources or cancel running cloud deployments. Cloud access was unavailable, so existing functions/build artifacts must be inventoried separately before cleanup. Do not disable project billing, remove shared infrastructure or downgrade the existing website as part of this migration.

## Assurance

Run full repository quality checks and emulator rules tests per focused child. Active members must access the group, while signed-out, outsider, inactive and cross-group requests fail; forged references and broad member queries must fail. Then repeat the document/task workflows, mobile navigation and Back on deployed TEST. PMT and Done remain pending until the user's recorded acceptance.

Sources checked on 20-10-2026:

- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 — Firebase Storage uses Blaze; existing usage remains metered.
- https://firebase.google.com/docs/firestore/pricing — reads/writes and free allowances.
- https://firebase.google.com/docs/projects/billing/spend-caps — caps can be delayed and do not guarantee zero expenditure.
