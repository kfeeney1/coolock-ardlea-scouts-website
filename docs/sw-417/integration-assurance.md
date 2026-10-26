# SW-425 — Combined meeting integration and accessibility assurance

This candidate combines SW-422 #937, SW-423 #938 and corrected SW-424 #939 with current main, without merging those PRs. It is development assurance only. A focused SW-425 PR must be rebased onto main after the implementation PRs are integrated; do not duplicate their changes in the assurance PR. Live Firebase TEST acceptance and owner PMT remain separate.

## Reconciliation

- Retain incident draft participation in the complete save boundary, saved tracker handoff and boolean-returning close callback.
- Retain pending-incident suspension of quiet saves while sharing the explicit/background write slot.
- Retain compact Plan, Run programme reference/incidents, Review badge-note separation and `stage=review` source return.
- Preserve every suite registry entry and all implementation regressions during conflict resolution.
- Base includes main's intervening dependency update. Use its lockfile rather than reverting it.

The combined candidate adds 44px minimum targets to the redesigned panels and Create's date control. OFF retains its original panel layout. It adds an explicit generic missing/out-of-scope direct-route message and clears a successfully reloaded record that is no longer in the permitted result set. Recoverable load failures still retain the existing draft. Tracker URL construction moves into the shared workflow helper, with present-only/source-return unit coverage; the editor remains below 20,000 bytes.

## Changed-area coverage

| Area | Automated evidence |
| --- | --- |
| Create → Plan/share → Run/pending incident → Review/tracker return → confirmed close/history | Real UI journey on desktop and mobile with schedule OFF and ON; verifies the incident saves once before tracker handoff and notes survive closure |
| All supported themes | Current, Modern Scout, Irish Adventure, Bold Campaign and Programme Explorer on desktop and 320px mobile |
| Accessibility | Axe WCAG 2 A/AA and 2.1 AA checks on Create, Plan, Run, Review and close confirmation; zero allowed violations; 44px targets, no horizontal clipping, accessible labels, keyboard focus and disclosure operation |
| Modal contrast | Measured after the actual fade opacity reaches its final value; no fixed sleep, increased timeout or disabled contrast rule |
| Scope | Direct out-of-section route gives a generic denied/missing message and exposes no meeting content |
| Legacy and rollout | Existing per-story matrix/live-switch tests retain OFF/ON parity, persistence, independent schedule setting and pinned drafts |
| Lifecycle and recovery | Existing Create, compact/library, share, Run, Review, lifecycle, permissions, failed writes, explicit unsaved choices, history/copy/reopen and read-only regressions retained |

## Evidence state

Full local quality:checks passed: 928 unit tests plus backend/worker tests, contracts and build. The expanded real demo-emulator/browser run passed 89 desktop/mobile cases with zero retries and one unchanged desktop-only programme-library skip. All 16 new integration/accessibility cases passed, including 50 axe scans across all five themes on Create, Plan, Run, Review and confirmation, plus source boundaries and the full pending-incident/tracker/closure journey. Existing implementation and rollout regressions passed on the same combined tree. Final candidate SHA and separate CI evidence are recorded in Jira. Diagnostic browser is Chromium153 with real demo Firebase emulators and the local event backend; pinned exact-head CI is still required on the eventual focused PR.

No TEST/Production acceptance, production deployment, feature enablement, PR merge or Done transition follows from this candidate. The owner PMT scenario remains in SW-427; SW-426 requires an identified deployed integrated TEST SHA and permitted role-based execution.
