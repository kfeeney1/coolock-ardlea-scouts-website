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

Parent gallery authorization is based on the existing explicit youth photo-consent field, not on event attendance/medical consent.

- The source of truth is a linked `consentApplications` record with `formType: "youth-activity-consent"`, `status: "active"` and `photoConsent: "Yes"`. The trusted materializer also requires the consent date range to cover the event start date.
- A parent is eligible only through a child linked to the approved parent account, linked to the same section, and marked `attending` for the event.
- The rules-friendly projection path is `eventGalleryAccess/{eventId}/parents/{parentUid}`. It contains exactly one parent, event, section, member and source consent application plus an `active` flag.
- Projection documents are not client-writable under Firestore Rules. `scripts/set-event-gallery-access.mjs` is a trusted Firebase Admin tool, dry-run by default, for granting or explicitly revoking a projection.
- Storage Rules treat the projection as necessary but not sufficient. On every parent read/list they re-check the approved parent/member/section relationship, the event section and current attendance, and the source consent record's current `photoConsent` value.
- This means changing `photoConsent` from `"Yes"` to `"No"` immediately denies Storage access even if a previously-created projection has not yet been rebuilt. Setting the projection `active: false` provides a second explicit revocation path.
- Parents cannot list a whole section gallery. They can list only an authorized event path; writes, replacements and deletes remain leader-only.
- Storage emulator tests cover eligible reads, consent withdrawal, projection revocation, unauthenticated access and cross-family/cross-section/event isolation.

This projection is intentionally separate from the broad parent account document. It gives Stage 16.4 a narrow parent-facing authorization contract without making photos public and without trusting gallery object metadata as an authorization source.

## Planned follow-ons

### Stage 16.4 — parent gallery

Expose only eligible event galleries in the authenticated parent portal. Parent access remains child/event scoped and must never make gallery objects public.

### Stage 16.5 — hardening

Extend audit review, mobile/accessibility coverage, retry behaviour, lifecycle handling for archived events, and reporting/cleanup controls as required.
