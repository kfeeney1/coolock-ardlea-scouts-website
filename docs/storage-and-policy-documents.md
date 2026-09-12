# Storage and policy document architecture

## Scope

This document records the Work Block D review for SW-15 and SW-72. It covers the existing Firebase Storage implementation for finance receipts and event/gallery images, the security boundary, lifecycle expectations, and the recommended approach for policy documents.

## Existing architecture

The application already has one shared Firebase Storage boundary rather than separate file systems.

### Finance receipts

Storage path:

`attachments/finance-receipts/{section}/{attachmentId}/{safeFileName}`

Receipt ownership is recorded in Storage custom metadata:

- `ownerType=finance-receipt`
- `ownerId=<finance transaction id>`
- `section=<section>`
- `uploadedBy=<Firebase uid>`
- `originalFileName=<original file name>`

Permitted content is JPEG, PNG, WebP or PDF, up to 10 MB. Storage Rules require an active leader/admin profile and the appropriate finance/section authority. Parents and unauthenticated users are denied.

Receipt objects are create/delete only; in-place replacement is denied. A replacement should therefore be modelled as a new attachment followed by explicit removal of the old attachment.

The client now reads receipt bytes through authenticated Firebase Storage requests and exposes them as short-lived browser object URLs. It does not deliberately create persistent Firebase download-token URLs for receipts.

### Event/gallery images

Storage path:

`attachments/event-gallery/{section}/{eventId}/{attachmentId}/{safeFileName}`

Required metadata:

- `ownerType=event-gallery`
- `ownerId=<event id>`
- `section=<section>`
- `uploadedBy=<Firebase uid>`
- `originalFileName=<original file name>`

Permitted content is JPEG, PNG or WebP, up to 10 MB. Leader access is section/group scoped. Parent access is read-only and additionally requires the explicit `eventGalleryAccess` projection plus current linked attendance/photo consent. Public access is denied.

Gallery media is intentionally more widely readable than finance receipts, but only inside the existing authenticated consent-aware boundary. Finance and gallery objects therefore share validation/path conventions while retaining separate rule branches.

## Authoritative security boundary

`storage.rules` is authoritative. UI visibility must never be treated as sufficient access control.

The default rule remains deny-all. Each supported owner type receives an explicit path and allow/deny policy.

Storage emulator coverage should continue to include:

- positive finance access for an assigned leader and Group Treasurer
- cross-section finance denial
- parent and unauthenticated finance denial
- malformed type/metadata rejection
- immutable-object enforcement
- eligible parent gallery read/list
- consent withdrawal/revocation denial
- family/event/section isolation
- unauthenticated gallery denial

## Upload validation and object naming

The shared attachment logic:

- enforces maximum size before upload
- enforces MIME allow-lists rather than trusting the extension
- sanitises user-supplied filenames
- sanitises section/event/attachment path segments
- generates attachment IDs in application code
- prevents the caller from choosing arbitrary Storage paths

Extensions remain presentation-only; MIME/rules checks are the security gate. Executable or arbitrary binary content is not accepted by the supported attachment owner types.

## Lifecycle and recovery

### Upload

A Storage object is written only after local validation. Current receipt/gallery records keep their ownership metadata with the object rather than creating a separate Firestore file record, so a failed Storage upload cannot leave a permanent Firestore metadata row pointing at a missing object.

### Read/view

Sensitive receipt content should be read through authenticated Storage requests. Browser object URLs must be revoked when the view is refreshed/unmounted.

### Replacement

Objects are immutable. Replace means upload a new object and then explicitly remove the superseded object when the workflow requires replacement.

### Removal

Deletion is authorised at Storage Rules. User-facing delete/remove flows should use the exact stored path returned by the application rather than reconstructing a path from arbitrary user input.

### Partial failure

Because metadata is currently object metadata, the principal partial-failure case is an upload that succeeds while a later UI/audit operation fails. The object remains discoverable by section/event listing and can be reconciled without a dangling Firestore pointer. Audit logging is supplementary and must not be allowed to turn a successful Storage operation into a false failure.

## TEST / PRODUCTION separation

Storage follows the existing Firebase environment configuration. TEST and PRODUCTION must use their respective Firebase projects/buckets.

Automated rules and application tests use Firebase emulators or synthetic data only. Real receipts, member images or production documents must never be copied into TEST fixtures.

## SW-72 policy document investigation

Three options were considered.

### 1. Firebase-managed source documents

Advantages:

- direct integration with existing Firebase Auth/RBAC
- one security/audit model
- reliable website access without a second provider
- simple controlled downloads and version metadata

Disadvantages:

- policy authors need a website upload/publish workflow
- Firebase Storage is not a collaborative document editor
- version authoring/review is less natural for administrators already using Google Docs

This is suitable for controlled published artefacts, but not ideal as the editing source of truth.

### 2. Live Google Drive / Google Docs integration

Advantages:

- familiar collaborative editing
- Drive/Docs version history and review workflow
- non-technical administrators can maintain source documents directly

Disadvantages:

- introduces OAuth/service-account/API configuration and another production dependency
- private Drive permissions do not naturally map to Scout website roles
- direct links can require Google accounts or expose sharing settings outside website control
- Google Docs export/PDF conversion introduces runtime failure and quota/caching concerns
- TEST/PRODUCTION credentials and folder IDs add operational complexity
- the website would depend on Drive availability and link/sharing stability for ordinary policy access

A live API integration is not justified for the current requirement.

### 3. Hybrid authoring + controlled publication — recommended

Use Google Drive/Docs as the *authoring* source when administrators prefer it, but publish approved website-facing policy artefacts into the existing Scout website storage/document model.

Recommended workflow:

1. Policy owner edits/reviews the source in Google Docs/Drive.
2. An approved version is exported as PDF (or another explicitly supported safe format).
3. An authorised website administrator publishes that approved artefact through the Scout website.
4. The website stores controlled metadata such as title, category, audience, effective/version date, source owner/reference and current/superseded status.
5. Website users open/download the published copy using website authentication/RBAC, without needing a Google account.

This keeps collaborative authoring simple while ensuring the website controls what is actually published, who may access it, and which version is current.

## Policy implementation decision

Do **not** add a live Google Drive/Docs API integration in SW-72.

SW-72 can be closed as an investigation with the hybrid recommendation above. A focused follow-up should define the policy catalogue/publication UX and the intended audience of each category before code is added. The follow-up should decide which policies are public, authenticated-member/parent, leadership-only or role-specific and then add explicit Storage/Firestore rules for those scopes.

This separation prevents an implementation from accidentally treating all policies as public or creating a second unrelated storage system.

## Privacy / GDPR follow-up

Retention periods, subject-access/export handling, member-image retention and formal records-of-processing belong in the dedicated GDPR/compliance work. This storage architecture should expose enough ownership/context metadata to support those processes without logging file contents or sensitive filenames unnecessarily.
