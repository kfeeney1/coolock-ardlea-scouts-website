# Firestore read budget

The production organisation-chart incident exposed a project-wide Firestore read-quota problem rather than a chart-specific permission failure.

## Changes in this audit

- Dashboard counters for pending parent requests, pending leader requests and new join applications use Firestore aggregation counts instead of downloading every matching document.
- Operations-overview results are cached in memory for 90 seconds per role/section scope. Normal navigation can reuse the overview without immediately paying for the same reads again; the explicit **Refresh Overview** action bypasses the cache.
- Organisation-chart quota failures are reported as database-read allowance exhaustion instead of the generic chart load error.
- The production smoke check added in PR #69 remains the source of truth for whether anonymous `publicLeadership` reads are actually available.

## Stage 23.7 revalidation

The September 2026 production-hardening revalidation reviewed the current leader overview, route-loading boundaries and the remaining broad reads after the Stage 20-23 changes.

- All public and leader pages remain route-level lazy imports in `src/App.tsx`; higher-cost leader features are not pulled into the initial route bundle merely because the route exists.
- `loadAdminOverview` still uses aggregation counts for the three count-only dashboard indicators and retains the 90-second role/section-scoped cache.
- Section-limited leaders load members, events and weekly meetings through section-scoped Firestore queries. Administrator-wide reads remain intentionally broader because those roles require a group-wide operational view.
- Member documents are still required client-side to calculate active section totals and event-consent eligibility. Replacing these reads with counts alone would remove data needed by the existing overview contract.
- Event and weekly-meeting documents are still required to build upcoming-event details, outstanding-consent calculations and the next-meeting/attention model. No duplicate second load was identified in the overview path.
- Equipment incident attention is restricted to roles that can manage equipment. The current collection read supports legacy records and client-side validation of type, quantity and status; narrowing it without a migration/index contract could silently hide older actionable incidents.

No evidence-backed performance regression was identified that justified a production query or schema change in this revalidation. Existing controls remain appropriate for the current data model. The next optimisation trigger should be measured quota pressure, a demonstrable duplicate request, or collection growth that makes one of the remaining functional document reads materially expensive.

## Remaining higher-cost reads

The operations overview still needs member documents to calculate section totals and event-consent eligibility, and it loads event documents within the current leader scope. Those are functional data reads rather than count-only reads, but they are the next candidates for optimisation if the project continues to approach its daily quota.

The main dashboard submissions list intentionally remains uncached so its existing **Refresh** action always performs a fresh read. It is already bounded to the latest 200 join applications and 200 consent submissions.

Other leader pages should be reviewed for repeated whole-collection `getDocs()` calls as datasets grow. Prefer scoped queries, server-side aggregation counts and bounded result sets over downloading a collection just to count or filter it in the browser.

## Operational rule

Do not diagnose a future `Unable to load the organisation chart` incident by changing chart rules or Firebase project configuration until the live Firestore probe has been checked. A `429` / `resource-exhausted` response is a quota condition and should be handled as an infrastructure/read-budget issue.
