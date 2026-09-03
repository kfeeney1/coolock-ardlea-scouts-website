# Stage 20 — Product maturity and operator experience

Stage 19 completed the engineering-control baseline for release evidence, operational health, recovery rehearsal, retention/privacy lifecycle, export/offboarding safeguards, reporting read budgets and launch-readiness review.

Stage 20 moves the project back toward day-to-day product maturity. It must preserve the Stage 18/19 security, provenance, deterministic-test, recovery and read-budget boundaries rather than treating them as temporary hardening work.

The parked production TEST-data cleanup, GitHub branch-protection configuration, unavailable production Storage capability and future managed non-production restore exercise remain explicit operational dependencies. Stage 20 must not hide or weaken those gaps.

## Planned sequence

1. **20.1 — Operator-facing documentation truth.** Align the repository README and entry-point guidance with the current production/test-data/recovery model so stale instructions cannot encourage unsafe live seeding or overstate production capabilities. **Complete.**
2. **20.2 — Navigation and information architecture review.** Re-check public, parent and leader navigation on desktop/mobile after the large feature expansion; remove duplicate/dead routes and ensure frequent operational tasks remain easy to reach without altering permissions. **Complete.**
3. **20.3 — Empty, loading and error-state consistency.** Standardise the most-used parent/leader screens so loading, no-data, unavailable-capability and permission-denied states are distinct, accessible and actionable. **Complete.**
4. **20.4 — Search/filter consistency.** Review member history, attendance insights, reports, equipment and other larger datasets for consistent search/filter/reset behaviour while preserving server-side scoping and Stage 19.6 read budgets. **Complete.**
5. **20.5 — Action confirmation and feedback.** Standardise confirmation, success, failure and destructive/revocation feedback for high-impact operational actions; avoid browser-native prompts where richer accessible confirmation is appropriate. **In progress — only the two Badgework native confirmations remain.**
6. **20.6 — Mobile operational pass.** Re-test high-frequency leader workflows at narrow viewports, especially fixed actions, dialogs, tables/cards, long forms and expandable navigation. **After 20.5 closes.**
7. **20.7 — Product maturity review.** Re-run representative public, parent and leader journeys and record remaining usability/product gaps separately from launch-governance blockers.

## Current position

Stages 20.1 through 20.4 are complete. The Stage 20.5 close-out audit exposed six pre-existing browser-native dialog calls that the earlier repository search had missed. The first residual-cleanup slice removes four of those six:

- event gallery photo deletion now uses an accessible in-app confirmation dialog;
- blocked consent-record and event-report print pop-ups now surface through the existing in-page error feedback instead of `window.alert`;
- failed clipboard copy for parent event-consent links now opens an in-app manual-copy dialog instead of `window.prompt`.

The source-level Quality contract is tightened with that work, leaving only the two Badgework `window.confirm` calls as the bounded audited legacy baseline. Stage 20.5 remains open until those final two interactions are migrated, after which the contract should move to a zero-native-dialog requirement and Stage 20.6 can begin.

## Stage 20.1 — Operator-facing documentation truth

The root README had drifted behind the production-safety model. In particular, it still described a manual **Seed Firebase Test Data** GitHub Actions workflow even though live TEST-data seeding/purging automation was removed during Stage 18 hardening.

Stage 20.1 updates the repository entry point so operators are told that:

- deterministic seed tooling exists for automated tests, not routine production population;
- production data must never become the source of Playwright fixtures;
- production TEST-data cleanup is a separate guarded local operation with exact project/count/manifest and verified-backup safeguards;
- branch protection/ruleset enforcement is a repository-setting requirement;
- post-deploy evidence must match the exact deployed commit;
- Storage-backed attachments remain capability-gated and must not be described as production-ready while Storage is unavailable;
- the emulator recovery drill is useful evidence but is not a substitute for a real managed non-production cloud restore exercise.

This stage changes documentation only. It does not reintroduce a live seed workflow, alter Rules/RBAC, access production data, or change the parked cleanup process.
