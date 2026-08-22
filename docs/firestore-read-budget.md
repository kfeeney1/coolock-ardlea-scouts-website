# Firestore read budget

The production organisation-chart incident exposed a project-wide Firestore read-quota problem rather than a chart-specific permission failure.

## Changes in this audit

- Dashboard counters for pending parent requests, pending leader requests and new join applications use Firestore aggregation counts instead of downloading every matching document.
- Operations-overview results are cached in memory for 90 seconds per role/section scope. Normal navigation can reuse the overview without immediately paying for the same reads again; the explicit **Refresh Overview** action bypasses the cache.
- Organisation-chart quota failures are reported as database-read allowance exhaustion instead of the generic chart load error.
- The production smoke check added in PR #69 remains the source of truth for whether anonymous `publicLeadership` reads are actually available.

## Remaining higher-cost reads

The operations overview still needs member documents to calculate section totals and event-consent eligibility, and it loads event documents within the current leader scope. Those are functional data reads rather than count-only reads, but they are the next candidates for optimisation if the project continues to approach its daily quota.

The main dashboard submissions list intentionally remains uncached so its existing **Refresh** action always performs a fresh read. It is already bounded to the latest 200 join applications and 200 consent submissions.

Other leader pages should be reviewed for repeated whole-collection `getDocs()` calls as datasets grow. Prefer scoped queries, server-side aggregation counts and bounded result sets over downloading a collection just to count or filter it in the browser.

## Operational rule

Do not diagnose a future `Unable to load the organisation chart` incident by changing chart rules or Firebase project configuration until the live Firestore probe has been checked. A `429` / `resource-exhausted` response is a quota condition and should be handled as an infrastructure/read-budget issue.
