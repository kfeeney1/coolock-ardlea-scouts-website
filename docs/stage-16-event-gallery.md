# Stage 16 — Event Galleries

Stage 16 adds event-linked photo galleries on top of the shared Firebase Storage attachment foundation created during Stage 15.

## Stage 16.1 — secure gallery foundation

The first increment is deliberately leader-only. It establishes the storage contract before exposing gallery content to parents.

- Gallery files are stored below `attachments/event-gallery/{section}/{eventId}/{attachmentId}/{fileName}`.
- Only JPEG, PNG and WebP images up to 10 MB are accepted. PDFs remain valid for finance receipts but are not valid gallery media.
- Every upload is bound to an event and section through Storage custom metadata (`ownerType`, `ownerId`, `section`, `uploadedBy`, `originalFileName`).
- Active leaders can access galleries only for their assigned sections. Admins, super-admins and the Group Leader can access all section galleries.
- Gallery objects cannot be updated in place. Replacement means a new upload; deletion remains an explicit action.
- Parent/public access is denied in Stage 16.1.

## Stage 16.2 — event gallery management UI

Events & Activities now exposes a Gallery action directly on each event card, including completed event history.

- Leaders can select multiple photos from the device photo library.
- Mobile devices can launch the rear-facing camera through a dedicated Take photo action.
- The picker accepts JPEG, PNG and WebP only; the service and Storage Rules continue to enforce the 10 MB limit and metadata contract.
- Gallery photos render as a responsive thumbnail grid with lazy-loaded images.
- Leaders can explicitly remove mistaken photos.
- Multi-photo uploads use independent outcomes, so successful photos remain uploaded when another file fails and the UI reports partial or complete failures.
- Successful uploads and removals create event-category audit entries.
- Completed events keep gallery access while the event record itself remains read-only.
- Parent/public gallery access remains closed. The gallery dialog states this boundary explicitly so attendance consent is not mistaken for photo-sharing consent.

## Stage 16.3 — explicit photo consent and access projection

Parent gallery authorization is now based on explicit, current photo consent rather than event attendance consent.

- The existing `youth-activity-consent` record is the consent source. `photoConsent` must be explicitly `true`, the consent record must be active, and its date range must cover the event date when dates are present.
- A parent is eligible only through a child linked to that parent account who is attending the event and has current photo consent.
- The rules-friendly projection path is `galleryAccess/{parentUid}/events/{eventId}`. A projection records the parent UID, event ID, section, eligible member IDs, source consent application IDs and an `active` flag.
- Projection generation is fail-closed: no eligible child means `active: false` and an empty member list. Withdrawing photo consent therefore removes eligibility instead of preserving stale access.
- Storage Rules never trust object metadata or a parent-provided event relationship to authorize parent reads. They require an approved parent account and a matching active Firestore projection for that exact parent, event and section.
- Parents cannot list a whole section gallery. They can list only an explicitly authorized event path, which prevents discovery of unrelated event photos.
- Gallery writes and deletes remain leader-only.
- CI now executes Storage emulator authorization tests, covering grants, revocation, unauthenticated access and cross-family/cross-section isolation.

The projection is intentionally separate from the broad parent account document so consent withdrawal can revoke one event without changing access to unrelated children or events. Stage 16.4 consumes this contract in the parent UI.

## Planned follow-ons

### Stage 16.4 — parent gallery

Expose only eligible event galleries in the authenticated parent portal. Parent access remains child/event scoped and must never make gallery objects public.

### Stage 16.5 — hardening

Extend audit review, mobile/accessibility coverage, retry behaviour, lifecycle handling for archived events, and reporting/cleanup controls as required.
