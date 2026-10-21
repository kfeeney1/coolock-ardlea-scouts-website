# Maintenance: existing Firebase service migration

SW-332 replaces the callable document API with direct Firestore and Storage SDK operations, matching meeting and policy documents. No Cloud Functions, Cloud Run, Cloud Build or Artifact Registry deployment is required. Existing Firebase plan allowances and metering still apply; no zero-total-bill guarantee is made.

Document metadata is reserved first with a stable ID, original name, SHA-256, size, type, uploader and server timestamp. Storage objects are immutable, limited to 10 MB PDF/JPEG/PNG/WebP, and accessible only to canonical group members. Retry verifies existing bytes' metadata before finalizing the same pending record. Failed finalization leaves a recoverable reference. The app lists/links only ready files and opens/downloads authenticated blobs, checking their digest. It does not expose public token URLs.

Firestore revalidates the canonical source behind each membership reference and the rollout setting. Storage independently revalidates the same canonical source through two Firestore lookups (its cross-service rule limit). The rollout toggle gates routes and Firestore document operations; it is not a substitute for Storage authorization. Members' direct Storage permission is independent of the navigation rollout; revoked or inactive canonical membership immediately removes access, even if a reference remains. No broad Storage listing, overwrite or deletion is allowed.

The SW-331 live migration hold remains in force until tasks/assignment are migrated and integrated TEST acceptance is complete. SW-333 follows as a separate PR with Firestore transaction/rules validation. SW-334 follows for canonical assignment and completion. PMT remains pending.

## Development assurance

The rules/service integration exercises real Auth-context Firestore and Storage SDKs against emulators: upload, authenticated download, idempotent retry, missing-file resume, retained-byte/finalization recovery, membership unions/revocation, unsafe writes, file limits, cross-group denial and rollout retention. Full repository quality and Storage regression checks are recorded in the PR.

Local Firebase CLI 15.28.1 ignores NO_PROXY when forwarding Storage-rule Firestore reads. The workspace's HTTP proxy intercepted localhost. Local emulator commands therefore unset HTTP_PROXY/HTTPS_PROXY (and lowercase equivalents) only for emulator execution; all services remain loopback/demo-only. No rule or assertion was weakened. Normal CI has no such proxy configuration.

## SW-333 task migration

Task creation, listing and detail reload now use Firestore SDK transactions/queries, with no callable API. Rules enforce a nonblank description up to 8,000 characters, immutable creation identity/timestamps, unique ready-document links and initial open status. Stable IDs make creation idempotent and conflicting retries fail without replacing another task. Lists use 50-record cursor pagination.

A task can link up to five documents: each reference is validated by Firestore rules, keeping the complete operation within the Security Rules document-lookup budget. The UI enforces the same limit. A retained bill can be reused on multiple tasks.

Assignment is explicitly pending at this intermediate child. Arbitrary assignees and status updates are denied until SW-334's canonical assignment/completion rules are delivered. The live migration hold remains enabled, so this intermediate behavior is not released to members.

The task PR also preserves its previously validated dropdown-history test fix. E2E no longer starts a Maintenance Functions emulator; browser workflows use the actual Firebase client SDKs against the standard emulators. Focused visible-control cases cover both navigation versions, desktop and Pixel 7, independent task persistence/reload/Back, parent upload/download and one document linked to multiple tasks. Rule tests also cover idempotency, conflicting retry, missing/duplicate/excess links, malformed/status/assignee writes, canonical revocation, direct-route data denial and retained records across rollback.

PR order: SW-332 #899 must merge to main before SW-333 #897. While #897 is based on the document branch, it remains draft. Do not merge it into that dependency branch. Retarget/update it onto main and require fresh main-targeted checks after #899 merges. SW-334 and integrated live TEST/PMT remain pending.
