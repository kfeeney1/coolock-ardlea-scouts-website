# Stage 21.6 — Cross-role regression and adoption review

## Purpose

Stage 21.6 closes the field-use refinement cycle by checking that the product still works coherently across public, parent and leader journeys after the focused Stage 21 changes. This is a regression/adoption review, not a licence for speculative feature expansion.

The review keeps the Stage 18–20 safeguards intact: RBAC, Rules, provenance, deterministic emulator fixtures, auditability, read budgets, accessibility, mobile coverage and the zero-native-dialog Quality contract remain mandatory.

## Evidence boundary

Stage 21.5 is complete at the current evidence boundary. Its promoted reporting issues were concrete and reproducible: user-facing event export dates were inconsistent with the site date contract, Outstanding Consent included explicit non-attendees, the general roster contradicted that rule, and stale member-level consent markers could override the event-level requirement. Those defects are now covered by focused reporting tests.

The Stage 21.1 communications recipient-name search item remains discovery-only. Existing section filtering, select/clear controls and worker-side authorization are already present; the repository does not establish a section-scale list size or field frequency that justifies changing the workflow. Do not implement recipient search in Stage 21.6 without new field evidence.

## Regression review matrix

### Public

Representative public journeys should prove that unauthenticated navigation and public event-consent links still work without exposing authenticated leader or parent state. Existing accessibility/public-page coverage should remain green.

### Parent

Representative parent coverage should include an approved parent entering the portal, viewing current tasks, updating permitted consent/medical information, seeing the task summary refresh, opening event consent and returning to the still-authenticated Parent Portal. Public/direct consent links must remain independent of parent-originated route state.

### Leader

Representative leader coverage should include dashboard navigation, Weekly Meetings, Meeting History discovery, Events & Activities, Member Management, Badgework, Equipment, Section Floats and Reports & Exports. Stage 21-specific contracts to retain include unsaved-meeting protection, a single Dashboard destination, report date formatting, and operationally consistent consent status.

### Mobile

Retain the existing mobile operational baseline, including Pixel 7 coverage. Stage 21.6 should strengthen an existing representative journey when a concrete mobile regression gap is found rather than add duplicate end-to-end declarations for every feature.

## Adoption review questions

For each role, record only evidence-backed friction:

- Is a high-frequency task blocked, ambiguous or unnecessarily repetitive?
- Does a workflow end without a clear return/next action?
- Does the same operational state render differently across two surfaces?
- Does a mobile journey hide or obstruct an action?
- Is a proposed improvement supported by repository behaviour or field evidence, rather than preference alone?

Items that do not meet that bar remain observations, not Stage 21 defects.

## Governance and operational dependencies

The following remain outside Stage 21.6 product-defect scope unless explicitly resumed:

- parked production TEST-data deletion;
- branch-protection configuration;
- unavailable production Storage capability;
- the future managed non-production restore exercise.

They should be recorded separately from adoption findings so they do not distort product-readiness conclusions.

## Exit criteria

Stage 21.6 can close when representative public, parent and leader regressions are green, Pixel 7 coverage is retained, any newly reproduced P0/P1 adoption defect is fixed or explicitly parked with evidence, and remaining observations are separated from governance/operational dependencies.
