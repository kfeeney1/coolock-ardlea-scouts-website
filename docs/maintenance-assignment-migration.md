> Current rollout policy: [SW-521 rollout](maintenance-rollout.md). Migration-stage holds described below are historical; explicit revision 1 opt-in replaces the blanket runtime hold. Live TEST acceptance and PMT remain separate.

# SW-334 assignment and completion

Direct SDK task creation is on main via #900 at bbb28241c7502398c2389a6616ffbb6d3ccf110d. This change adds assignment and progress using existing Firestore transactions and Security Rules. The live migration hold and Functions deployment block remain intact; SW-521 controls rollout restoration separately.

## Canonical responsibility

An eligible assignee has an active canonical account (leader/admin/super-admin union, sections array, no scalar legacy section), an active organisation record, a display name and a current supported appointment. Appointment dates use the existing canonical normalisation model. A default requires exactly one eligible Group Leader appointed at Group scope. Missing/multiple defaults require explicit selection. No arbitrary first account is chosen.

Parents and account-linked members receive only uid, display name, Group Leader flag, snapshot generation and two validation indices. They cannot read private adminUsers or organisationLeadership records. Even an administrator publishing a leader projection must satisfy Rules against its private canonical sources. All twelve supported appointment slots and effective dates are checked. The administrator-controlled Group Leader index is built from the complete canonical collections; it is not a manually selected default account.

## Directory refresh and consistency

In **Superuser Settings → Maintenance**, choose **Refresh responsible leaders** before acceptance and after a canonical account or appointment change. This prepares the directory independently of the rollout toggle and reports success only after every eligible projection is published and the index sealed. Existing public Who's Who visibility does not limit eligibility.

The shared config has a monotonic generation and ready flag. Every client account eligibility/organisation mutation must invalidate it atomically; Rules reject source changes without that invalidation. Leader Access, registration approval and organisation sync perform this write. Rebuild marks the generation unavailable first, queries the complete sources, publishes independently validated minimal records, then seals the index only if the generation is unchanged. Interrupted/concurrent refresh stays unavailable and can be retried. Stale projections cannot be used. Administrators cannot roll the generation back. Effective-date boundaries expire the index, so scheduled appointments cannot silently change the default.

Trusted Admin SDK operations bypass Rules. The canonical seed/reconciliation writers invalidate an existing directory before mutation, preserving --check behaviour. Other administrative imports/restores must call scripts/invalidate-maintenance-directory.mjs before changing canonical leader sources and refresh afterward. No live cloud mutation was performed during development.

## Tasks and progress

Creation persists explicit/default assignment with the description and zero to five unique ready documents. Transaction retry retains stable task identity and rejects conflicting content/explicit assignment. Progress updates require the current revision and Open/Complete status, validate the current directory, and preserve description, creator, creation date and document links. Missing/deactivated assignees cannot be silently saved. Members may complete/reopen tasks and see the responsible leader after reload.

The UI preserves description, links and progress choices on errors, exposes directory refresh errors, and provides task reload for stale revisions. Responsible leader/status controls use existing form components, 44px actions and wrapping layouts. Existing navigation, group emblem and branding remain. A late Parent Portal child-URL normalisation is guarded against replacing a destination after a member follows the Maintenance link; the immediate visible-control regression remains asserted.

## Assurance and rollout

Development assurance is recorded against the exact PR head: full quality checks, canonical/rules SDK scenarios and desktop/Android-sized visible-control journeys. Local browser uses official stable Chrome 156 with the repository's assertions, budgets and zero retries. CI retains its pinned browser. Local video is disabled because the transient environment lacks ffmpeg; traces remain enabled. Emulator binaries were cached through the workspace proxy, then localhost emulator execution unsets HTTP proxy variables to avoid interception of Storage-to-Firestore requests.

SW-522 separately verifies the deployed Firebase TEST build and captures final screenshots and one PMT scenario per child. Production Manual Testing remains owner-recorded and pending. No additional Cloud Functions/Cloud Run/Cloud Build/Artifact Registry service is introduced. Existing Firebase plan usage still applies; a zero-total-bill guarantee is not claimed.
