# Reporting and dashboard read budgets

Stage 19.6 protects the current production-read discipline with a machine-readable regression contract in `scripts/reporting-read-budget.mjs`.

The budgets are deliberately about **query fan-out and repeat-query behaviour**, not a claim that Firestore document-read billing is fixed. The number of billed document reads still depends on how many documents match each query. Silently truncating operational reports with arbitrary limits would be worse than making the scaling boundary explicit.

## Leader dashboard overview

The dashboard keeps a 90-second in-memory cache per normalized access scope. Count-only cards use Firestore aggregation queries. Member and event detail needed to calculate the visible operational summary remains permission-scoped, weekly-meeting queries fan out only by the leader's assigned sections, and equipment incidents are loaded only for roles that can manage equipment.

The regression budget allows at most six section branches and a worst-case 25 query operations for one uncached ordinary-leader overview load. Any feature that adds another section-fanned collection must update the budget deliberately and explain why the extra production reads are justified.

## Reports & Exports

The main reports page has two initial Firestore datasets: members and events. For ordinary leaders, each dataset is queried once per permitted section, so the maximum six-section fan-out is 12 query operations. Admins use one collection query per dataset.

The member snapshot is cached by report scope. Attendance/consent exports reuse that snapshot, so a CSV export after the page has loaded has a budget of **zero additional member-query operations**. Adding an export that re-queries members should fail the Stage 19.6 regression test unless the architecture and budget are explicitly reviewed.

## Section Floats reporting

Finance reporting loads two query families for each permitted finance section: `financeTransactions` and `financeReceipts`. Group-wide finance access currently spans five sections, giving a maximum initial fan-out of 10 query operations.

Section/category/date filters, summaries, missing-receipt calculations, printing and CSV generation all operate on the already-authorized snapshot. Their post-load Firestore query budget is zero.

## Review rule

A budget failure is not permission to increase a number automatically. First determine whether the new read can be removed, derived from an already-loaded snapshot, replaced with an aggregate query, scoped more narrowly, cached safely, or deferred until the user actually opens the feature. Raise a budget only when the added read is necessary and documented.

These checks do not weaken Firestore Rules, do not read production data in CI, do not require production credentials, and do not add telemetry containing member or financial data.
