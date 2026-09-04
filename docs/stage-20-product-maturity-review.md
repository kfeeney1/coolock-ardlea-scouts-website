# Stage 20.7 product maturity review

## Scope

Stage 20.7 is the cross-role closeout review for Stage 20. It re-checks representative public, parent and leader journeys after the navigation, state, search/filter, action-feedback and mobile-operational work completed in Stages 20.1–20.6.

This review is deliberately separate from launch-governance dependencies. It does not treat the parked production TEST-data cleanup, repository branch-protection configuration, unavailable production Storage capability or the future managed non-production restore exercise as product defects, and it does not weaken or hide those dependencies.

## Evidence baseline

The review uses the existing deterministic Playwright suite rather than introducing a duplicate end-to-end suite:

- `e2e/public-smoke.spec.ts` covers the public home, About, Activities, Join and Contact routes, plus the leader-login boundary and password-recovery/access-request entry points.
- `e2e/accessibility-baseline.spec.ts` checks representative public, parent and leader surfaces for document structure, accessible control names, image alternative text and keyboard focus entry.
- `e2e/parent-approved-journey.spec.ts` covers the approved-parent dashboard, things-to-do summary, member consent search, consent editing, linked event consent and the no-access gallery state.
- `e2e/leader-journey.spec.ts` covers rejected leader access, administrator request review without persistence, section-scoped member visibility, Events & Activities and Parent Event Consent.
- Stage 20.6 retains Pixel 7 coverage for the high-frequency leader routes, expanded navigation, dialog action bars and medication-management detail.
- Existing role-permission, reporting, weekly-meeting, equipment, finance, badgework and event suites remain the deeper feature regressions behind those representative journeys.

## Product maturity findings

### Public journeys

The current public regression provides a clear basic journey across the main informational pages and verifies that restricted leader routes return users to an explicit leader-login experience. Password recovery and leader-access request entry points are visible at sign-in. No new Stage 20 product blocker is identified from the repository/test review.

### Parent journeys

The parent portal has a coherent action-first path: the approved account state is explicit, the `Things to do` summary exposes event consent, medical/consent and upcoming-event work, member consent records are searchable, linked consent can be opened directly, and the canonical upcoming event exposes a direct consent action. The gallery no-access state fails closed as an empty state rather than presenting an authorization error as content.

The Stage 20.3–20.5 state and feedback work is therefore represented in the parent critical path without a new high-severity usability gap being identified in this review.

### Leader journeys

The leader journey preserves approval and section scoping while keeping the main operational destinations discoverable. A normal programme scouter can move from the dashboard to Member Management, Events & Activities and Parent Event Consent without acquiring administrative destinations. Administrator leader-request decisions use review and confirmation dialogs without persisting changes during the review path.

Stage 20.2 navigation changes and Stage 20.5 confirmation changes are therefore covered in a representative leader path, while Stage 20.6 adds narrow-screen coverage across Weekly Meetings, Events & Activities, Badgework, Member Management, Equipment & Stores, Section Floats, Meeting Records, Attendance Insights and Reports & Exports.

## Residual product gaps

No new P0/P1 product-maturity defect is identified by this repository and deterministic-test review. Any failure exposed by the PR's existing Quality or Playwright gates is a Stage 20.7 defect to fix before closeout rather than a reason to weaken the regression.

Lower-priority future product work should be tracked as new-stage backlog rather than expanding Stage 20 indefinitely. Candidates should come from real operator/parent use and should be separated from the known governance dependencies below.

## Governance and operational dependencies that remain open

These are not Stage 20.7 usability defects and remain explicitly parked or externally configured:

- production TEST-data cleanup must use the guarded local dry-run/manifest/backup process;
- GitHub branch protection/ruleset enforcement remains a repository-setting dependency;
- production Storage-backed attachments remain capability-gated while Storage is unavailable;
- a real managed non-production restore exercise remains future operational evidence beyond the emulator recovery drill.

## Closeout criteria

Stage 20 can close when this PR passes the existing Quality and Playwright gates without weakening the Stage 18/19 controls or Stage 20 regressions. A CI-discovered product defect should be corrected on this branch with a focused regression where appropriate. If the gates pass, the remaining items above carry forward as explicit operational dependencies and future product improvements can begin in the next stage.
