# Policy document publication

SW-77 reuses the existing Firebase Storage attachment boundary. It does not add a live Google Drive dependency or a second generic file service.

## Authoritative model

Approved PDFs are published beneath `attachments/policy-documents/current/{audience}/{documentId}/{versionId}/{safeFileName}`. Metadata remains attached to the Storage object, matching the existing SW-15 attachment model. Storage Rules are the access-control boundary; React visibility is not relied upon for security.

Supported audiences are `public`, `authenticated`, `parent`, `leader`, and `admin`. `authenticated` means an active approved Parent or active Leader, not merely possession of a Firebase session. `admin` includes system admins and active Group/Deputy Group Leaders for this Group-level publication workflow.

Only PDF is supported initially, with a 10 MB limit. User filenames are sanitised and cannot select arbitrary Storage paths. Reads use authenticated/public Firebase Storage byte retrieval and short-lived browser object URLs rather than persisted Firebase download-token URLs.

## Publication

Google Drive/Docs may remain the authoring and review source. The website receives only an approved exported PDF. Selecting a file is not itself a Storage write: the explicit **Publish document** action creates the current published artefact with title, description, category, audience, effective/version date, source reference, publisher and publication timestamp metadata.

No production documents are uploaded by CI or seed jobs.

## Current version, replacement and withdrawal

The catalogue displays only objects in the `current` namespace with `state=current`. A manager may publish a new approved version and then withdraw the superseded current version. Withdrawal deletes that published Storage object after explicit confirmation and writes a normal system audit event.

SW-80 has not approved a long-term retention duration for superseded policy artefacts. This implementation therefore does not invent an archive-retention period or silently retain withdrawn copies. Organisational source/version history should remain in the approved authoring/records location until SW-80 establishes an authoritative retention rule. If that decision later requires website-side archives, add an admin-only archive namespace and migration deliberately rather than changing current publication semantics silently.

## Access summary

- Public: readable without authentication.
- Authenticated: active approved Parents and active Leaders.
- Parent: active approved Parents.
- Leader: active Leaders.
- Admin: admins, super-admins, Group Leader and recognised Deputy Group Leader variants.
- Disabled/unapproved accounts: public documents only.

Publication and withdrawal are restricted to the admin publication group. Storage defaults remain deny-all outside explicit attachment namespaces.

## Mobile and accessibility

The catalogue uses responsive cards rather than a desktop-only table. Titles are headings, audience/current state is textual, PDF actions have visible names, loading/error states are textual, and withdrawal uses a labelled confirmation dialog. The catalogue UI does not claim that the source PDF itself is accessible; source-document accessibility remains a document-owner responsibility.

## Privacy and retention reconciliation

This work follows the Block D boundary: it records purpose/audience/source metadata and supports controlled withdrawal without defining legal basis or retention periods. SW-80 remains authoritative for future retention/anonymisation/deletion decisions. Audit records contain document identifiers/titles and lifecycle actions, not file contents.
