# Stage 20.3 — Empty, loading and error-state consistency

## Scope

Stage 20.3 standardises the operational-state contract used by high-frequency parent and leader surfaces without changing routing, RBAC, Firestore rules, data shape, seed behaviour or production cleanup controls.

The first implementation slice covered the shared `OperationalStates` primitives, the parent Weekly Meeting Programme and the leader Programme Library. The second slice extended the same contract to parent Adventure Skills and leader Member History, including independent retryable read states where a screen performs more than one query. The third slice applied the contract to the parent Events flow, covering both upcoming Event Consent and Event Galleries. The fourth slice extends the contract across leader Member Management and the parent consent/medical-form surface.

## State contract

The UI now treats these states as different conditions rather than interchangeable alerts:

- **Loading** — a labelled `role="status"` progress state with polite live-region behaviour. The label describes the resource being loaded rather than showing an anonymous spinner.
- **Empty** — the request succeeded but there are no records, or current search/filter criteria have no matches. Copy explains what the user can do next where appropriate.
- **Unavailable capability** — the feature cannot currently operate because a prerequisite is absent. For example, a parent without a linked Scout record cannot yet receive Adventure Skills progress. This is not presented as a data-load failure.
- **Permission denied** — Firebase explicitly rejected access. Firestore reads continue to use the existing `classifyFirestoreFailure` / `firestoreFailureMessage` boundary; Storage permission failures on the gallery surface are also presented as permission states rather than generic faults. This does not change authorization rules or turn a denied resource into an empty result.
- **Error** — the operation failed for another reason. Read failures provide a retry action rather than leaving the user at a dead end.

Mutation success/error feedback remains separate from read/load state so a failed save does not masquerade as a failed page load.

## Implemented surfaces

### Parent Weekly Meeting Programme

- Uses the shared labelled loading state.
- Treats no linked section as an unavailable prerequisite rather than an empty programme.
- Distinguishes Firestore permission failures from general load failures.
- Provides Retry for failed reads.
- Keeps a successful zero-record result as an explicit empty state.

### Leader Programme Library

- Uses the same shared loading state while the library is fetched.
- Distinguishes Firestore permission failures from other read failures.
- Provides Retry for failed reads.
- Distinguishes an empty library from a non-empty library whose current search/filter produces zero matches.
- Keeps create/delete mutation feedback independent from the library load state.

### Parent Adventure Skills

- Replaces the anonymous spinner with the shared labelled loading state.
- Treats a missing linked child record as an unavailable prerequisite rather than a warning or successful empty progress result.
- Distinguishes Firestore permission failures from other read failures using the existing classifier and messages.
- Provides Retry for failed reads without changing parent read permissions or Adventure Skills data access.

### Leader Member History

- Keeps the existing shared loading and successful-empty states for the member list and lifecycle history.
- Separates member-list failures from lifecycle-history failures so one failed query no longer becomes an ambiguous page-level error.
- Distinguishes explicit permission failures from generic read errors for both queries.
- Adds an independent Retry action for each failed read, preserving the selected member when a lifecycle-history retry is needed.

### Parent Event Consent and Event Galleries

- Replaces both bespoke progress indicators with shared labelled loading states.
- Treats a missing linked Scout section as an unavailable prerequisite for both Event Consent and Event Galleries.
- Adds a retry path to Event Consent read failures and keeps the existing gallery retry behaviour through the shared error-state action.
- Distinguishes explicit Firestore permission failures on Event Consent from general read failures.
- Distinguishes surfaced Firestore or Storage permission failures on Event Galleries from general gallery-load failures while preserving the gallery service's existing fail-closed access filtering.
- Keeps successful zero consent requests and zero eligible galleries as empty states rather than errors.
- Uses the same empty-state treatment when a non-empty set has no search matches, with result counts exposed as polite status updates.
- Keeps the gallery privacy notice as informational guidance rather than treating it as an operational state.

### Leader Member Management

- Replaces the anonymous member-register and consent-indicator spinners with labelled shared loading states.
- Keeps the member-register read failure separate from member edit/create mutation feedback.
- Separates consent-indicator read failures from member-save errors so a failed secondary query no longer implies that the member record itself failed to load or save.
- Distinguishes explicit Firestore permission failures from other member and consent-indicator read failures and provides scoped Retry actions for each read.
- Distinguishes a genuinely empty accessible member register from a non-empty register whose current search/status/section filters have no matches.
- Keeps successful zero consent matches as an empty state rather than a read failure.

### Parent Consent and Medical Forms

- Replaces the anonymous spinner and generic error alert with shared labelled loading, permission and error states.
- Provides Retry for failed consent/member reads without changing the underlying parent-scoped Firestore queries.
- Treats an approved account with no linked member record as an unavailable prerequisite and directs the parent back to Parent Access review.
- Treats linked children whose youth consent records have not yet been associated as an unavailable linking prerequisite rather than a generic empty-data result.
- Keeps a successful search with no matching linked child as a true empty state and exposes result counts as polite status updates.
- Leaves individual form update feedback inside `ParentConsentEditor` as mutation feedback rather than mixing it into page-load state.

## Preserved boundaries

This stage does not alter Firestore/Auth/Storage rules, role visibility, queries, indexes, Firebase configuration, dependencies, workflow security, deterministic seed behaviour or production data. The parked production TEST-data cleanup remains unchanged and must continue to use the guarded Stage 18 process when resumed.

The Event Gallery implementation also preserves the existing security model: candidate projection permission mismatches and gallery-list authorization failures continue to fail closed inside the service, and the UI does not infer that denied photos exist.

The Member Management and Parent Consent changes only classify and render failures returned by the existing service calls. They do not broaden the accessible member or consent datasets, bypass leader section scoping, or change parent consent-link matching.

## Follow-up

The shared primitives should continue to be adopted by the remaining high-use leader and parent screens as Stage 20 continues. Screens should not collapse permission-denied, unavailable-prerequisite and successful-empty results into a single generic `No data` message. Where one screen performs multiple independent reads, errors and retry actions should remain scoped to the read that failed rather than replacing otherwise valid content.
