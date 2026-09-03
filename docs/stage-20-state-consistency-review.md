# Stage 20.3 — Empty, loading and error-state consistency

## Scope

Stage 20.3 standardises the operational-state contract used by high-frequency parent and leader programme surfaces without changing routing, RBAC, Firestore rules, data shape, seed behaviour or production cleanup controls.

The first implementation slice covers the shared `OperationalStates` primitives, the parent Weekly Meeting Programme and the leader Programme Library. These are representative read-heavy surfaces used during routine parent and leader workflows and provide a reusable pattern for subsequent screens.

## State contract

The UI now treats these states as different conditions rather than interchangeable alerts:

- **Loading** — a labelled `role="status"` progress state with polite live-region behaviour. The label describes the resource being loaded rather than showing an anonymous spinner.
- **Empty** — the request succeeded but there are no records, or current search/filter criteria have no matches. Copy explains what the user can do next where appropriate.
- **Unavailable capability** — the feature cannot currently operate because a prerequisite is absent. For example, a parent without a linked Scout section cannot yet receive a weekly programme. This is not presented as a data-load failure.
- **Permission denied** — Firestore explicitly rejected access. The existing `classifyFirestoreFailure` / `firestoreFailureMessage` boundary is preserved so this state remains distinct from a generic fault and does not imply that records are simply absent.
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

## Preserved boundaries

This stage does not alter Firestore/Auth/Storage rules, role visibility, queries, indexes, Firebase configuration, dependencies, workflow security, deterministic seed behaviour or production data. The parked production TEST-data cleanup remains unchanged and must continue to use the guarded Stage 18 process when resumed.

## Follow-up

The shared primitives should be adopted opportunistically by the remaining high-use leader and parent screens as Stage 20 continues. Screens should not collapse permission-denied, unavailable-prerequisite and successful-empty results into a single generic `No data` message.