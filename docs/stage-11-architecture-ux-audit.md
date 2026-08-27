# Stage 11 Architecture & UX Audit

## Purpose

Stage 11 shifts the project from rapid feature expansion toward product consolidation. This audit records the current maintainability/UX risks and defines the order of follow-up work without changing runtime behaviour.

## Current shape

The codebase is still appropriately simple for the product: React pages, shared components and domain-oriented services. The service layer is already reasonably decomposed. Complexity is concentrated mainly in page components that accumulated UI state, filtering, formatting, dialogs and workflow actions during Stages 8–10.

Observed large page files on the Stage 11 baseline include:

- `src/pages/ConsentManagement.tsx` — about 50 KB
- `src/pages/EventsManagement.tsx` — about 31 KB
- `src/pages/EventConsentManagement.tsx` — about 27 KB
- `src/pages/AttendanceInsights.tsx` — about 17 KB

The largest inspected service files are materially smaller, for example `eventAdmin.ts` (~11 KB), `eventConsent.ts` (~10 KB), `consentApplications.ts` (~8 KB), `adminOverview.ts` (~6 KB) and `attendanceInsightsLogic.ts` (~6 KB). This does not justify a service-layer rewrite.

## Findings

### 1. Page components are carrying too many responsibilities

The largest pages combine several of the following in one component:

- data loading and error handling
- permission-scoped presentation
- search/filter state
- formatting helpers
- export/print helpers
- dialog lifecycle
- form state
- status rendering
- roster/member matching
- workflow actions

`ConsentManagement.tsx` contains data-formatting, printable/export helpers, summary/filter state, dialogs and record-detail presentation. `EventsManagement.tsx` combines event editing, search/filtering, roster calculations, CSV/HTML helpers and roster dialogs. `EventConsentManagement.tsx` combines event/link loading, response matching, notification behaviour and roster updates.

**Recommendation:** decompose by user task, not by arbitrary line count. Keep route pages as orchestrators and move substantial UI sections into domain components. Keep pure calculations in services/logic modules where they can be unit tested.

### 2. Reusable operational UX primitives are incomplete

The project has shared layout/admin components, but common operational patterns are still implemented independently on many pages.

Stage 11 should standardise:

- search field + result count
- filter bar / section selector / status selector
- page-level loading and error state
- empty/no-results state
- status chips
- page title / description / primary actions
- mobile-safe action footer
- confirmation dialogs

**Recommendation:** make this the scope of the next implementation PR rather than refactoring all pages inside this audit.

### 3. Domain lists and labels are repeated in presentation code

Section lists, status labels and similar small domain mappings appear in multiple pages. Some repetition is harmless, but repeated role/section/status mappings can drift.

**Recommendation:** consolidate only values that are true domain constants or shared formatting rules. Do not create a generic utility layer for one-off strings.

### 4. Permission enforcement should remain service/rules backed

The current architecture correctly keeps Firestore Rules and scoped service queries as the security boundary. UI role checks should continue to control presentation/navigation only.

**Recommendation:** any Stage 11 extraction must preserve this model. Avoid moving permission decisions into reusable visual components where they could become the only enforcement point.

### 5. Playwright is strong but several journeys are broad

The current E2E suite intentionally covers complete leader/parent journeys. As pages are decomposed, browser tests should continue to verify critical user journeys while pure calculations and formatting move toward unit tests.

**Recommendation:** do not split Playwright tests merely to make files shorter. Split when setup and assertions represent clearly separate behaviours or when a pure function can be tested faster outside the browser.

### 6. The data model does not need an architectural rewrite

Firestore, the current React/service split, deterministic E2E emulators, rules tests, provenance checks and audit logging are all fit for the current product.

**Do not introduce in Stage 11:** Redux, a second backend, generic repository layers, speculative caching, broad Firestore denormalisation or a framework migration.

## Decomposition order

### Priority A — shared operational UX

Create shared primitives first so page decomposition has stable targets instead of duplicating another generation of local components.

Candidate scope:

1. `OperationalSearchField`
2. `OperationalFilterBar`
3. `PageFeedback` / loading-error-empty handling
4. consistent `StatusChip`
5. mobile-safe page action container

### Priority B — Events Management

Split `EventsManagement.tsx` around user tasks:

- event list/filter panel
- event create/edit dialog
- roster/attendance dialog
- export/share helpers moved to pure logic

This page is a good first decomposition target because the responsibilities are already distinct and existing Playwright coverage is strong.

### Priority C — Consent Management

Split `ConsentManagement.tsx` around:

- summary cards/filters
- record list
- consent detail dialog
- print/export formatting helpers

Move pure formatting/export logic out of the page before touching the data contract.

### Priority D — Event Consent Management

Split around:

- event consent link controls
- parent notification controls
- response matching/review
- roster application logic

The response matching/apply functions are good candidates for focused unit coverage.

### Priority E — remaining pages

Review Attendance Insights, Member History, Reports, Weekly Meetings and Parent Access for adoption of the shared UX primitives. Refactor only when the shared component genuinely removes duplicated behaviour.

## Stage 11 implementation sequence

1. **#173 — Architecture/UX audit**: document baseline and add a repeatable source-size report.
2. **#174 — Shared operational UX primitives**: search/filter/feedback/status/action patterns.
3. **#175 — Leader Today / Needs Attention dashboard**: build on existing scoped data without adding broad collection reads.
4. **#176 — Scout year / term periods**: shared date-period model for Reports, Attendance, Meetings and Events.
5. **#177 — Programme Library v2**: search/filter/tags/duration/equipment/reuse improvements.
6. Decompose Events/Consent pages incrementally as the shared primitives become available.

## Refactoring rules

- No user-visible behaviour change merely to reduce file size.
- Preserve existing Firestore read scope and security rules.
- Add unit coverage when pure logic is extracted.
- Keep existing Playwright journeys green through each extraction.
- Prefer one responsibility extraction per PR over broad rewrites.
- Do not make cleanup/reseed operations a dependency of browser tests.

## Success criteria

Stage 11 consolidation is succeeding when:

- route pages primarily coordinate data and workflow state rather than rendering every sub-flow inline;
- common search/filter/loading/error/status patterns are visually and behaviourally consistent;
- pure domain calculations are unit-testable without a browser;
- Playwright remains focused on real user journeys;
- no new backend/state-management architecture is introduced without a demonstrated need.
