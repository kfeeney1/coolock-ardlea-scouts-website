# Maintenance: existing Firebase service migration

SW-332 replaces the callable document API with direct Firestore and Storage SDK operations, matching meeting and policy documents. No Cloud Functions, Cloud Run, Cloud Build or Artifact Registry deployment is required. Existing Firebase plan allowances and metering still apply; no zero-total-bill guarantee is made.

Document metadata is reserved first with a stable ID, original name, SHA-256, size, type, uploader and server timestamp. Storage objects are immutable, limited to 10 MB PDF/JPEG/PNG/WebP, and accessible only to canonical group members. Retry verifies existing bytes' metadata before finalizing the same pending record. Failed finalization leaves a recoverable reference. The app lists/links only ready files and opens/downloads authenticated blobs, checking their digest. It does not expose public token URLs.

Firestore revalidates the canonical source behind each membership reference and the rollout setting. Storage independently revalidates the same canonical source through two Firestore lookups (its cross-service rule limit). The rollout toggle gates routes and Firestore document operations; it is not a substitute for Storage authorization. Members' direct Storage permission is independent of the navigation rollout; revoked or inactive canonical membership immediately removes access, even if a reference remains. No broad Storage listing, overwrite or deletion is allowed.

The SW-331 live migration hold remains in force until tasks/assignment are migrated and integrated TEST acceptance is complete. SW-333 follows as a separate PR with Firestore transaction/rules validation. SW-334 follows for canonical assignment and completion. PMT remains pending.

## Development assurance

The rules/service integration exercises real Auth-context Firestore and Storage SDKs against emulators: upload, authenticated download, idempotent retry, missing-file resume, retained-byte/finalization recovery, membership unions/revocation, unsafe writes, file limits, cross-group denial and rollout retention. Full repository quality and Storage regression checks are recorded in the PR.

Local Firebase CLI 15.28.1 ignores NO_PROXY when forwarding Storage-rule Firestore reads. The workspace's HTTP proxy intercepted localhost. Local emulator commands therefore unset HTTP_PROXY/HTTPS_PROXY (and lowercase equivalents) only for emulator execution; all services remain loopback/demo-only. No rule or assertion was weakened. Normal CI has no such proxy configuration.
