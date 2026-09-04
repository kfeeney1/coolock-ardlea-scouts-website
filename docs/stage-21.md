# Stage 21 — Field-use refinement and adoption

Stage 20 closed the planned product-maturity pass with representative public, parent and leader journeys green and no new P0/P1 product defect identified. Stage 21 shifts from broad maturity review to evidence-led refinement based on real operator and parent use.

Stage 21 is not a reason to reopen already-completed architecture work or weaken Stage 18–20 controls. Security, RBAC, provenance, deterministic test fixtures, recovery safeguards, read budgets, accessibility contracts, mobile regressions and the zero-native-dialog Quality contract remain mandatory.

The parked production TEST-data cleanup, branch-protection configuration, unavailable production Storage capability and future managed non-production restore exercise remain separate operational dependencies unless explicitly resumed.

## Planned sequence

1. **21.1 — Field-use backlog and friction baseline.** Review the current product surface and recent issue history for repeated operator/parent friction, duplicate effort, awkward hand-offs and missing shortcuts. Produce a prioritised backlog with clear evidence and avoid speculative feature expansion. **Complete — baseline recorded in `docs/stage-21-field-use-baseline.md`.**
2. **21.2 — Leader workflow efficiency.** Reduce unnecessary navigation, repeated data entry and high-frequency interaction cost in Weekly Meetings, Events, Member Management, Badgework, Equipment and Section Floats while preserving permissions and auditability.
3. **21.3 — Parent self-service refinement.** Improve the clarity and directness of consent, event, badge-progress and member-information journeys without exposing additional data or weakening approval/linking boundaries. **Complete — the two reproduced parent hand-offs are addressed; additional parent changes remain evidence-led.**
4. **21.4 — Operational data-quality guardrails.** Add low-friction validation and consistency protections where real use can create ambiguous, incomplete or duplicate operational records; do not substitute production data for deterministic fixtures.
5. **21.5 — Communications and reporting usefulness.** Review common leader communications, WhatsApp/share flows and reports for actionability, duplication and export usefulness while preserving read-budget and authorization boundaries.
6. **21.6 — Cross-role regression and adoption review.** Re-run representative public, parent and leader journeys, retain Pixel 7 coverage and record remaining adoption issues separately from governance dependencies.

## Starting position

Stage 21.1 is complete. Its repository- and issue-backed review identifies two confirmed high-priority Weekly Meeting refinements, a narrow navigation regression gap following PR #333, and two discovery items that require further field or transient-emulator evidence before implementation. New feature work remains split into focused follow-up PRs rather than bundled into the baseline review.

A candidate should enter the Stage 21 backlog only when it has a clear user task, affected role, current friction, expected improvement and regression boundary. High-frequency or high-risk operational tasks take priority over cosmetic changes.

## Stage 21.2 progress

The first focused slice protects unsaved Weekly Meeting edits. Returning to the meeting list or starting a copy now uses an accessible in-app discard review when the current meeting differs from its last saved snapshot. Keeping the draft leaves the editor and its changes intact; successful persistence resets the comparison snapshot. Browser reload/close also receives the standard unsaved-change warning.

The slice preserves Weekly Meeting permissions, persistence, audit events and copy reset semantics. It extends the existing lifecycle regression rather than adding a duplicate end-to-end journey, and adds unit coverage for the saved-snapshot comparison.

The second focused slice makes closed meetings findable as history grows. Leaders can search programme details and narrow results by section or date range, see a live result count, reset filters and distinguish a genuine empty history from a no-match result. The controls reuse the established operational filter pattern, remain role-neutral and do not change meeting reads, permissions, persistence or audit behavior.

The third focused slice locks the single-Dashboard navigation contract after the duplicate action fixed in PR #333. Existing desktop and Pixel 7 navigation scenarios now require exactly one Dashboard destination in the expanded menu and prove that it returns from a leader feature page to `/leader`. This adds no navigation element, route or end-to-end test declaration.

## Stage 21.3 progress

The first parent self-service slice keeps **Things to do** current after an inline consent or medical update. The confirmed stale-state hand-off came from the form list and task summary owning separate snapshots; a successful parent save now refreshes both without reloading the whole portal. The existing approved-parent journey performs the save against the freshly seeded emulator data and verifies the attention count changes. No later test depends on that mutated count, and each workflow recreates the canonical dataset before Playwright starts.

The second slice removes a confirmed parent navigation dead end. Event consent opened from the Parent Portal now carries a non-sensitive route-state marker and exposes a mobile-safe **Back to Parent Portal** action on the token form. Publicly opened consent links remain unchanged, no parent or event data is added to the URL or route state, and the existing approved-parent journey verifies the return to the still-authenticated portal without submitting another consent response.

Stage 21.3 is complete at the current evidence boundary. The remaining parent badge-progress and member-information surfaces already expose their intended read-only/direct paths, and no additional parent change is promoted without reproduced field friction.

## Stage 21.4 progress

The first operational data-quality slice prevents ambiguous duplicate records in **Equipment & Stores**. Equipment names are compared using the existing case-insensitive, whitespace-normalised label contract before save. Creating a duplicate, or renaming one item to another item's name, is rejected; editing an item without changing its own name remains valid. Archived items are included in the comparison so historical stock is restored or edited rather than silently recreated under the same name.

The guard uses the equipment snapshot already loaded for the page, so it adds no Firestore query or repeated read. Equipment write shape, RBAC, audit events, movement/history semantics, deterministic fixtures and existing category/location duplicate protections are unchanged.

The second operational data-quality slice protects **Events & Activities** from ambiguous duplicate event records. Event identity uses a whitespace-normalised, case-insensitive title together with the exact start date and section. Creating a second event with the same identity is rejected, and editing an event cannot rename or move it onto another existing event's identity while the current record remains excluded from its own check.

The event guard reuses the event snapshots already loaded by the list and record pages, so it adds no Firestore query. Events on different dates or in different sections remain valid even when their titles match. Event write shape, attendance/consent data, RBAC, audit behavior, deterministic fixtures and existing lifecycle semantics are unchanged.

## Non-goals

Stage 21 does not:

- perform or automate the parked production TEST-data deletion;
- weaken branch protection, provenance, RBAC, Rules or audit controls;
- claim Storage-backed production features are available while Storage remains unavailable;
- replace the required managed non-production restore exercise with emulator evidence;
- remove or relax deterministic Playwright, accessibility, mobile or Quality gates merely to reduce CI runtime.
