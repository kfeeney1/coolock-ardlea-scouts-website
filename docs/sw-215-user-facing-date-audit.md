# SW-215 user-facing date audit

## Reconciliation

SW-95 and PR #617 established the shared `formatSiteDate` boundary for ordinary full dates. PR #764 extended it across application, report, history, notification and email paths, and fixed Floats transaction, correction and opening-float dates plus entry timestamps. Existing date-only, timestamp, render-contract, email-worker and Float-history tests remain in place. Their narrower production passes remain historical evidence; they do not close later failures.

The 12 October PMT-19 screenshot (106720.jpg) reports raw month keys in Section Floats reporting. It shows a presentation and wrapping defect; it does not show an `Invalid Date` message or establish that stored transaction dates are invalid.

## Monthly Float Movement

`buildFinanceMonthlyTotals` groups valid transaction dates by canonical `YYYY-MM` keys and sorts those keys newest first. Invalid transaction dates remain grouped as `Unknown` after valid periods. The report converts keys to fixed English month/year labels with `formatSiteMonth`, which does not construct a day or depend on browser locale. Missing and malformed period keys display `Month unavailable`.

The report uses a stacked layout on narrow screens and a period-plus-amount row at wider widths. Period labels stay on one line. Print/Save PDF uses the same rendered labels. The CSV remains transaction-level and retains canonical transaction date values by design; no monthly buckets are added to that machine-readable export. Amounts, totals, permissions, filters, sorting source values and stored transactions are unchanged.

## Render paths reviewed

All source files using the shared date presentation helpers were inspected after PR #764. Paths are grouped by their user-facing role below.

| Area | Inspected render paths |
| --- | --- |
| Public activities, events and parent portal | `src/pages/Activities.tsx`, `src/pages/EventRecordPage.tsx`, `src/pages/EventConsent.tsx`, `src/components/parent/ParentEventConsentSection.tsx`, `src/components/parent/ParentEventGallerySection.tsx`, `src/components/parent/ParentThingsToDo.tsx`, `src/components/parent/ParentWeeklyProgramme.tsx`, `src/components/parent/ParentPollsSection.tsx` |
| Leader dashboard, meetings, attendance and logs | `src/pages/AdminDashboard.tsx`, `src/pages/ActivityLog.tsx`, `src/pages/AttendanceInsights.tsx`, `src/pages/MeetingRecords.tsx`, `src/pages/LeaderReports.tsx`, `src/components/admin/AdminOverviewPanel.tsx`, `src/components/admin/WeeklyMeetingHistoryPanel.tsx`, `src/services/adminOverviewLogic.ts`, `src/services/weeklyTrackerLogic.ts`, `src/services/weeklyMeetingProgramme.ts` |
| Members, families, consent, medication and requests | `src/pages/MemberManagement.tsx`, `src/pages/MemberRecordPage.tsx`, `src/pages/MemberHistory.tsx`, `src/pages/JoinManagement.tsx`, `src/pages/JoinRecordPage.tsx`, `src/pages/LeaderRequests.tsx`, `src/components/parent/ParentConsentSection.tsx`, `src/services/consentManagementLogic.ts` |
| Events and generated event reports | `src/components/admin/EventListPanel.tsx`, `src/components/admin/EventEditorDialog.tsx`, `src/components/admin/EventConsentEventPanel.tsx`, `src/services/eventManagementLogic.ts` |
| Subs, payments, finance and floats | `src/pages/SubsManagement.tsx`, `src/pages/SectionCashbook.tsx`, `src/components/finance/SectionCashbookHistory.tsx`, `src/components/admin/SubsPaymentPanel.tsx`, `src/components/admin/SubsBalancesReport.tsx`, `src/components/admin/FinanceReportsPanel.tsx`, `src/services/reportingLogic.ts` |
| Equipment, stores and damage history | `src/components/admin/EquipmentLoansPanel.tsx`, `src/components/admin/EquipmentItemReturnDialog.tsx`, `src/components/admin/EquipmentHistoryDialog.tsx`, `src/components/admin/EquipmentOperationsDashboard.tsx`, `src/components/admin/ProgrammeEquipmentDialog.tsx` |
| Badgework and awards | `src/components/admin/BadgeworkGroupCompetencyControls.tsx`, `src/components/admin/BadgeworkMemberProgress.tsx` |
| Policies, system identity, monitoring and generated email | `src/pages/PolicyDocuments.tsx`, `src/pages/SystemInformation.tsx`, `src/operations/systemInformation.ts`, `email-worker/src/index.js`, `email-worker/src/siteDateFormat.js` |
| Shared presentation boundary | `src/services/siteDateFormat.ts` |

## Technical-format exceptions retained

- Native date inputs, date filters, validation, comparisons and sort keys continue to use canonical ISO date values.
- Firestore records, API payloads, timestamps and internal date-only values remain unchanged.
- Finance CSV keeps canonical transaction-date cells so the export remains machine-readable; report filename dates are identifiers, not transaction dates.
- Generated user-facing messages and reports format dates at their output boundary; the weekly meeting WhatsApp/share text uses the shared formatter.
- Timestamp displays retain required time information and use the site's stable date/time presentation helper.
- Canonical `YYYY-MM` remains the aggregation key and React row identity; only the visible month label is human-readable.

No production data was edited or backfilled as part of this presentation change.
