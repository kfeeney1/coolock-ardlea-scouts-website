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

- Stage 16.4 initially used `publicEvents` to discover candidate event IDs and display safe event metadata for the parent's linked sections. Candidate discovery does not grant photo access.
- Each candidate gallery is then listed at its exact Storage event path. Stage 16.3 Storage Rules remain the authorization authority; unauthorized events are omitted rather than disclosed through the UI.
- The internal `eventGalleryAccess` projection collection remains client-denied and is not exposed to the parent application.
- Eligible galleries render as responsive thumbnail grids with search and an accessible larger-photo dialog. Parents have no upload, replacement or delete controls.
- Parent images are fetched as authenticated Storage blobs and rendered with short-lived browser object URLs. Stage 16.4 does not create new long-lived download-token links for the parent gallery UI.
- Blob object URLs are revoked when galleries are replaced, fail part-way through loading, or leave the page.
- The empty state explains that a gallery appears only when a linked child attended the event and current photo-sharing consent allows access.
- Playwright covers the canonical approved-parent fail-closed state without adding persistent gallery data to the deterministic seed dataset.

The UI therefore adds no broader read permission: candidate metadata may identify an event, but the exact parent/event/member/consent relationship must still pass Storage Rules before any photo bytes are returned.

## Stage 16.5 — hardening

Stage 16.5 closes the gallery lifecycle and operational gaps found during the Stage 16.4 rollout.

- A dedicated `parentGalleryEvents/{eventId}` projection now retains only gallery-safe event metadata for Open, Closed and Completed events. Approved parents may read/list these records only for linked sections; draft events and leader-only event fields are never projected.
- `publicEvents` remains a temporary candidate fallback for currently-open events during rollout, so existing Stage 16.4 data continues to fail closed rather than disappearing while retained projections are materialized.
- Event create/update flows keep the retained parent projection synchronized. Moving an event back to Draft removes the parent projection; Closed and Completed events retain it so post-event galleries remain discoverable.
- The trusted `set-event-gallery-access.mjs` grant path also refreshes the retained event projection. `scripts/backfill-parent-gallery-events.mjs` provides a dry-run-first migration for active pre-16.5 gallery grants.
- Parent and leader gallery load failures now expose an explicit Retry action. Loading indicators have accessible labels/live regions, and the parent large-photo dialog has a stable accessible title and mobile-aware image height.
- `scripts/audit-event-gallery-access.mjs` reports stale access projections and can deactivate only those that fail the current parent/member/event/consent contract. It is dry-run by default and supports event/section filters.
- Storage emulator coverage now explicitly locks down missing and malformed access projections, including exact-path list operations, so the fail-closed behavior that surfaced during Stage 16.4 remains regression-tested below Playwright.
- Firestore emulator coverage protects the retained metadata projection: linked approved parents can read only their sections, pending parents are denied, leaders cannot project other sections or Draft events, and extra leader-only fields are rejected.
- Existing deterministic Playwright parent seed data is unchanged; the canonical parent journey continues to exercise an empty, fail-closed gallery state without persistent gallery photos.

### Operational rollout

Before relying on historical parent galleries in production, run `npm run backfill:parent-gallery-events` with the production service account and review the dry-run output. Set `APPLY=true` only after the eligible event list is correct. Routine access review uses `npm run audit:event-gallery-access`; again, review dry-run output before applying deactivations.

Stage 16 is complete after Stage 16.5: secure leader upload/management, explicit consent projection, authenticated parent viewing, completed-event lifecycle, recovery/accessibility hardening, security regressions and dry-run operational controls are all covered.
