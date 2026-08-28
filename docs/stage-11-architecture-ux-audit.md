# Stage 11 Architecture & UX Audit

## Purpose

Stage 11 shifts the project from rapid feature expansion toward product consolidation. This audit records the maintainability/UX risks identified at the start of the stage, the work completed to address them, and the boundary for the next development stage.

## Baseline shape

The codebase was appropriately simple for the product: React pages, shared components and domain-oriented services. The service layer was already reasonably decomposed. Complexity was concentrated mainly in page components that had accumulated UI state, filtering, formatting, dialogs and workflow actions during Stages 8–10.

Large page files on the Stage 11 baseline included:

- `src/pages/ConsentManagement.tsx` — about 50 KB
- `src/pages/EventsManagement.tsx` — about 31 KB
- `src/pages/EventConsentManagement.tsx` — about 27 KB
- `src/pages/AttendanceInsights.tsx` — about 17–18 KB

The largest inspected service files were materially smaller, so the baseline did not justify a service-layer rewrite.

## Findings and outcome

### 1. Page components were carrying too many responsibilities — addressed

The largest pages combined data loading, filtering, formatting, dialog lifecycle, workflow actions and substantial presentation.

Stage 11 decomposed the three highest-priority operational pages by user task while keeping the route pages responsible for orchestration:

- `EventsManagement.tsx`: event list/filter UI, editor dialog and roster dialog extracted; export/share calculations moved to pure logic.
- `ConsentManagement.tsx`: overview/filter UI and detail dialog extracted; filtering, totals, formatting and print HTML moved to pure logic.
- `EventConsentManagement.tsx`: per-event consent UI extracted; member eligibility, response matching, duplicate prevention, roster application, reminder targeting and summary calculations moved to pure logic.

Current route-file sizes after the Stage 11 decompositions are approximately:

- `src/pages/ConsentManagement.tsx` — 3.5 KB, down from about 50 KB
- `src/pages/EventsManagement.tsx` — 8.1 KB, down from about 31 KB
- `src/pages/EventConsentManagement.tsx` — 13.9 KB, down from about 27 KB
- `src/pages/AttendanceInsights.tsx` — 18.1 KB

Attendance Insights remains a larger page, but its calculation logic is already separated and it was a Priority E adoption candidate rather than a required decomposition target. Further extraction should be driven by a concrete maintenance or UX need rather than file size alone.

### 2. Reusable operational UX primitives were incomplete — addressed

Stage 11 introduced shared operational search, filter, loading/empty and status presentation patterns and adopted them where they removed real duplication. This established stable UI primitives without forcing every page into a generic abstraction.

### 3. Domain lists and labels were repeated — improved selectively

Values that represent real shared domain rules were moved into shared logic/constants as part of the page decompositions. One-off labels remain local where abstraction would add indirection without reducing drift risk.

### 4. Permission enforcement should remain service/rules backed — preserved

The Stage 11 changes did not move security decisions into visual components. Firestore Rules and permission-scoped service queries remain the enforcement boundary, while UI role checks remain presentation/navigation concerns.

### 5. Playwright is strong but several journeys are broad — preserved intentionally

Browser coverage continues to focus on complete leader and parent journeys. Pure calculations introduced during Stage 11 received unit coverage instead of expanding browser tests for logic that can be verified faster outside the browser.

### 6. The data model did not need an architectural rewrite — confirmed

Stage 11 did not introduce Redux, a second backend, generic repository layers, speculative caching, broad Firestore denormalisation or a framework migration. The existing React/service/Firestore architecture remains appropriate for the product.

## Completed Stage 11 sequence

- **#173 — Architecture/UX audit:** documented the baseline and added repeatable source-complexity reporting.
- **#174 — Shared operational UX primitives:** introduced common operational search/filter/loading/empty/status patterns.
- **#175 — Test-login repair:** restored the canonical super-admin test identity after the audit work exposed the stale fixture.
- **#176 — Canonical test password:** aligned live seed and Playwright authentication on `password1`.
- **#177 — Leader Today / Needs Attention:** added scoped operational attention items without broad collection reads.
- **#178 — Scout year and term periods:** introduced reusable September–August Scout-year and term boundaries.
- **#179 — Programme Library v2 discovery:** added search/filter discovery while retaining existing meeting-template semantics.
- **#180 — Reporting insights:** added aggregate operational insights from existing report data without new database reads.
- **#181 — Events Management decomposition:** split list/filter, editor, roster and pure export logic.
- **#182 — Consent Management decomposition:** split overview/detail presentation and pure filter/print logic.
- **#183 — Event Consent Management decomposition:** split per-event presentation and pure matching/roster logic.
- **#184 — Stage 11 close-out:** records the final architecture state and development boundary.

The two test-login PRs were corrective work required to keep the deterministic development environment aligned while Stage 11 progressed; they did not expand product scope.

## Refactoring rules retained beyond Stage 11

- Do not change user-visible behaviour merely to reduce file size.
- Preserve existing Firestore read scope and security rules during UI extraction.
- Add unit coverage when pure domain logic is extracted.
- Keep Playwright focused on real user journeys.
- Prefer targeted responsibility extraction over broad rewrites.
- Do not make cleanup/reseed operations a dependency of browser tests.
- Do not introduce a new state-management or backend architecture without demonstrated product need.

## Stage 11 success criteria assessment

Stage 11 is complete because:

- the three highest-priority route pages now primarily coordinate data/workflow rather than rendering every sub-flow inline;
- common operational search/filter/loading/empty/status patterns have shared implementations;
- key event, consent and reporting calculations are unit-testable without a browser;
- Playwright remains focused on end-to-end user journeys;
- Firestore security/query boundaries were preserved through the refactors;
- no speculative backend/state-management rewrite was introduced.

## Boundary for Stage 12

Stage 11 should not be extended with additional dashboard, reporting, programme-library or general refactoring work merely because further cleanup is possible.

Stage 12 is reserved for **badgework tracking** as a distinct product capability. Its design should distinguish at least:

- badge catalogue and requirements/criteria;
- member progress against requirements;
- badgework planned for a meeting;
- badgework actually worked on at a meeting;
- individual requirement completion/evidence;
- leader review and final badge award;
- parent/member visibility where appropriate;
- reporting and history.

The important data-model boundary is that **planned badgework, worked-on badgework, completed requirements and awarded badges are separate states**. Stage 12 should build that model deliberately rather than overloading the existing meeting-planning badgework field.
