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

## Why parent access stays closed initially

The existing event consent response records establish attendance/consent for an event, but they are not a photo-publication consent model. Opening Storage directly to parent accounts before a dedicated, enforceable relationship exists would make it too easy to expose a photo to the wrong household or to treat event attendance consent as photography consent.

Stage 16 therefore keeps the fail-closed posture used by the shared attachment architecture. Parent reads should only be added after Firestore contains a small, rules-friendly gallery access projection derived from the parent's linked children, the event, and an explicit photo-sharing decision.

## Planned follow-ons

### Stage 16.3 — photo consent/access projection

Define the explicit photo-sharing consent model and a Firestore projection that Storage Rules can check without trusting client-supplied metadata. Include withdrawal/revocation behaviour and tests for cross-section/cross-family isolation.

### Stage 16.4 — parent gallery

Expose only eligible event galleries in the authenticated parent portal. Parent access remains child/event scoped and must never make gallery objects public.

### Stage 16.5 — hardening

Extend audit review, mobile/accessibility coverage, retry behaviour, lifecycle handling for archived events, and reporting/cleanup controls as required.
