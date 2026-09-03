# Stage 20.4 — Search and filter consistency

## Scope

Stage 20.4 reviews larger operational datasets so search, filter, date-range and reset behaviour is predictable without changing server-side authorization, query scope, read budgets or production data handling.

The first implementation slice covers **Attendance History & Insights**. The second covers **Equipment & Stores**. The third covers **Reports & Exports**. Together they establish the shared interaction contract on the main high-use datasets identified for this stage.

## Search/filter contract

High-use searchable screens should follow these rules where applicable:

- Search and filter controls should describe the field or dataset they affect.
- Multiple active filters should have one clear **Reset filters** action that returns the whole filter set to its neutral state.
- Reset must clear search text, categorical filters and date/period constraints together rather than requiring several separate clear actions.
- Detail views may preserve the list filters while the user inspects a record, so **Back to members/results** returns to the same working set.
- Matching-result counts should update as a polite status so assistive technology can detect filter-result changes without moving focus.
- A successful query with no client-side matches remains a no-match result, not a permission or data-load failure.
- Client-side filtering must not broaden the records fetched from Firestore or bypass existing leader section/admin scoping.

## First slice — Attendance History & Insights

The Attendance Insights screen already supported member-name search, section filtering, Scout-period selection, custom From/To dates and preservation of active filters when opening and closing a member history detail.

This slice makes those controls operate as one consistent filter set:

- adds a single **Reset filters** action whenever any search, section, period or date constraint is active;
- reset returns member search to blank, section to **All permitted sections**, Scout period to **Custom / all dates**, and clears both dates;
- removes the narrower date-only clear action so users do not have two competing reset patterns on the same screen;
- exposes the matching-active-member count through a polite live status;
- gives the section selector a stable test hook alongside the existing search, period and date hooks;
- extends deterministic Playwright coverage to verify section/search/date filters survive the member-history round trip and are then reset together.

## Second slice — Equipment & Stores

The Equipment catalogue already supported free-text search, category filtering, storage-location filtering and an archived-item visibility toggle. Those controls affected one client-side result set but had no single way to return the catalogue to its neutral state.

This slice applies the same interaction contract:

- treats search, category, location and archived visibility as one filter set;
- adds **Reset filters** whenever any of those constraints is active;
- reset clears search, returns category and location to their **All** values, and hides archived items again;
- exposes the matching-equipment count through a polite live status;
- distinguishes an empty catalogue from a populated catalogue with no matches;
- explicitly associates the category and location labels with their MUI selects, preserving accessible names and reliable role-based test selectors;
- adds stable filter hooks and extends the existing deterministic equipment checkout flow to verify combined filtering and reset without adding seed records solely for this UI check.

## Third slice — Reports & Exports

The Reports & Exports screen already filtered its authorized event snapshot by From/To dates. It exposed a result count and a date-only clear action, but the reset behaviour and accessibility feedback did not yet match the Stage 20.4 contract.

This slice standardises that date filter set:

- treats From and To as one report filter set;
- replaces the always-present disabled **Clear dates** action with **Reset filters** only while either date constraint is active;
- reset clears both dates together and returns reporting to the already-loaded authorized event snapshot;
- exposes the event-range result count as a polite live status;
- adds stable hooks for both date inputs, reset and result count;
- extends the existing deterministic Reports Playwright flow to verify filter activation and reset while preserving its CSV export coverage.

No Finance Reports filter semantics are folded into this reset because that panel is a separate reporting workflow with its own controls and data semantics.

## Preserved boundaries

These slices do not alter:

- Firestore, Auth or Storage Rules;
- leader/admin role visibility or section scope;
- reporting, event, Weekly Meeting or equipment queries;
- Stage 19.6 reporting read-budget behaviour;
- attendance calculations or history construction;
- equipment stock, checkout, return, incident or movement calculations;
- Scout-period definitions;
- report CSV contents, audit semantics or event-member loading behaviour;
- data models, indexes or Firebase configuration;
- deterministic seed contents or seed safety checks;
- workflow security, provenance controls or branch-protection requirements;
- production data or the parked production TEST-data cleanup process.

The filter changes are client-side interaction changes over the same already-authorized datasets.

## Stage 20.4 status

**Complete.** Attendance History & Insights, Equipment & Stores, and Reports & Exports now apply the shared search/filter/reset contract across the principal larger operational datasets identified for this stage.

The next planned Stage 20 area is **20.5 — Action confirmation and feedback**: review high-impact operational actions for consistent confirmation, success, failure and destructive/revocation feedback without weakening permissions or replacing guarded server-side validation.
