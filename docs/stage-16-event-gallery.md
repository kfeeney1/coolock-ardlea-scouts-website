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

## Stage 16.4 — authenticated parent galleries

Approved parent accounts now have a read-only Event Galleries area alongside their event information.

- The browser uses `publicEvents` only to discover candidate event IDs and display safe event metadata for the parent's linked sections. Candidate discovery does not grant photo access.
- Each candidate gallery is then listed at its exact Storage event path. Stage 16.3 Storage Rules remain the authorization authority; unauthorized events are omitted rather than disclosed through the UI.
- The internal `eventGalleryAccess` projection collection remains client-denied and is not exposed to the parent application.
- Eligible galleries render as responsive thumbnail grids with search and an accessible larger-photo dialog. Parents have no upload, replacement or delete controls.
- Parent images are fetched as authenticated Storage blobs and rendered with short-lived browser object URLs. Stage 16.4 does not create new long-lived download-token links for the parent gallery UI.
- Blob object URLs are revoked when galleries are replaced, fail part-way through loading, or leave the page.
- The empty state explains that a gallery appears only when a linked child attended the event and current photo-sharing consent allows access.
- Playwright covers the canonical approved-parent fail-closed state without adding persistent gallery data to the deterministic seed dataset.

The UI therefore adds no broader read permission: public event metadata may identify a candidate, but the exact parent/event/member/consent relationship must still pass Storage Rules before any photo bytes are returned.

## Stage 16.5 — hardening

The final Stage 16 increment hardens the parent gallery experience without widening the authorization boundary.

- Gallery loading has an explicit retry path for transient failures, while authorization denials still fail closed to the empty state.
- Loading and result-count feedback expose accessible status semantics, and the photo viewer now has a labelled dialog title plus a keyboard-accessible close action.
- Mobile thumbnail controls retain a compact two-column layout and use touch-safe button behaviour without adding separate mobile-only logic.
- Object URL cleanup now runs when a loaded gallery set is replaced as well as when a load is cancelled or the component unmounts, reducing stale in-memory photo blobs during account/section changes and retries.
- Completed and historical events continue to be eligible through their exact event path; access remains governed by the current parent/member/attendance/photo-consent checks rather than by UI state.
- The canonical Playwright parent remains intentionally unprojected for gallery access, and the regression test now also verifies that this secure empty state is not being represented as a load error or retry condition.
- Existing leader upload/removal audit entries remain the operational record for gallery changes; no parent-side mutation or cleanup capability is introduced.

Stage 16 is complete after this hardening pass. Future gallery work should be treated as a separate feature stage so that reporting, retention-policy automation, bulk cleanup, or richer media handling can be designed with explicit product and data-retention requirements rather than being implied by parent read access.
