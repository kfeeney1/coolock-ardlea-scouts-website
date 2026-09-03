# Stage 20.4 — Search and filter consistency

## Scope

Stage 20.4 reviews larger operational datasets so search, filter, date-range and reset behaviour is predictable without changing server-side authorization, query scope, read budgets or production data handling.

The first implementation slice covers **Attendance History & Insights**. The second covers **Equipment & Stores**. Later slices should review other high-use datasets such as reports against the same interaction contract rather than forcing unrelated screens into one large change.

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

## Preserved boundaries

These slices do not alter:

- Firestore, Auth or Storage Rules;
- leader/admin role visibility or section scope;
- reporting, event, Weekly Meeting or equipment queries;
- Stage 19.6 reporting read-budget behaviour;
- attendance calculations or history construction;
- equipment stock, checkout, return, incident or movement calculations;
- Scout-period definitions;
- data models, indexes or Firebase configuration;
- deterministic seed contents or seed safety checks;
- workflow security, provenance controls or branch-protection requirements;
- production data or the parked production TEST-data cleanup process.

The filter changes are client-side interaction changes over the same already-authorized datasets.

## Next review target

Review **Reports & Exports** next against the same contract. Its current From/To event date range already has a partial clear action and result count, so the review should stay focused on consistency and accessibility without broadening reporting queries, exports or Stage 19.6 read-budget behaviour.