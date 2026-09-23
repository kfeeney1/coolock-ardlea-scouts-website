# Work Block E — page density, refresh-control and header audit

Baseline: `1051e7e1733f45ec286825d8ae549f2bea67cd8e`. Exact-SHA Quality, Playwright E2E, Firebase Rules, Firebase TEST Deploy, Branch Protection Audit and Post-merge CI Guard were green before development.

## Decision record

| Area | Control/copy | Decision | Reason |
| --- | --- | --- | --- |
| Leader Access | generic Refresh + header description | Remove | Route-entry load and successful mutations already reload the data; the description repeats the page purpose. |
| Leader Requests | generic Refresh + header description | Remove | Requests load on entry and after mutations; matching/approval safety remains in workflow states. |
| Member Management | generic Refresh + header description | Remove | Existing load lifecycle and mutation callbacks update records. Preserve scoped error recovery and rename it to “Retry loading member records”. |
| Events & Activities admin | generic Refresh + header description | Remove | Route load/mutation lifecycle already reloads event data; Add Event remains the task action. |
| Consent Management | generic Refresh + header description | Remove | Existing loader remains; the removed text only enumerated record types. |
| Parent Communications | introductory workflow blurb | Remove | Visible step chips communicate the workflow. Recipient/RBAC safety Alert remains. |
| Subs | introductory header blurb | Remove | Operational controls and finance-specific policy/error guidance remain. |
| Reports & Exports | introductory header blurb | Remove | Report-scope/privacy Alert remains because it carries meaningful data-handling guidance. |
| Settings | generic role blurb | Remove | Section-specific inactivity guidance and role gating remain. |
| Equipment & Stores | introductory header blurb | Remove | Role-specific permissions Alert remains. |
| Public Activities | generic public intro | Remove | Title, event records and meaningful empty/error states remain. |
| Policy documents | catalogue intro | Remove | Publication approval warning, audience controls, empty/error states and withdrawal warning remain. |
| Weekly Meetings | header description | Already empty | Retain compact title-only header. Unsaved-change protection and meeting-specific safety guidance remain. |
| Roles & Permissions | security/enforcement description | Retain | Explains that the page is not itself an access grant and identifies the enforcement boundary. |
| Parent Portal | account/status context | Retain | Context is dynamic and required to explain registration/access state. |
| Error/empty states | Retry/recovery controls | Retain where resource-specific | Browser reload is not a safe substitute for scoped recovery, especially around forms and authenticated state. |
| Reports | Reset filters / regeneration actions | Retain | These are task-specific operations, not document reload. |
| Equipment | internal onChanged refresh callbacks | Retain | These are data lifecycle callbacks after mutations, not user-facing generic refresh controls. |

## Guardrails

No full-page reload was introduced. Existing Firestore/query lifecycles, mutation-success reloads, form dirty-state protection, filters, role checks, Back handling, warnings, privacy/safeguarding/finance guidance and scoped recovery states remain in place.

The remaining repository-wide audit must treat identifiers such as `refresh`, `onRefresh` and refresh keys as implementation lifecycle mechanisms unless they render a generic user-facing action.