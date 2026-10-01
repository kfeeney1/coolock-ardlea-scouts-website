# Work Block 5 — SW-132 / SW-174 UI cleanup inventory

Baseline: `4a2d0651bf5402032959deef08cf7de3ada18668`.

## SW-132 visible refresh / reload inventory

The authenticated route audit covered every leader/admin page registered in `src/App.tsx`, plus the shared `LeaderPageHeader` and existing cleanup tests. Background functions named `refresh`, mutation callbacks, Firestore/query reloads and `trySecondaryRefresh` are not user-facing controls and remain intact.

| Page / route | Visible label | Component / file | Behaviour | Decision | Evidence |
| --- | --- | --- | --- | --- | --- |
| Parent Access — `/leader/parent-access` | Refresh | `ParentAccessManagement.tsx` / `LeaderPageHeader` action | Re-ran the same parent/member load already performed on route entry and after mutations | Remove | `navigation-recovery.spec.ts` SW-132 route audit |
| Event/activity record — `/leader/events/:eventId` | Refresh | `EventRecordPage.tsx` / `LeaderPageHeader` action | Re-ran the ordinary record/member/equipment load already performed on route entry and after relevant mutations | Remove | source contract in `work-block-e-page-density.test.ts`; PMT regression location covered by repository audit |
| Activity Log — `/leader/activity` | Refresh | `ActivityLog.tsx` / `LeaderPageHeader` action | Re-ran the same read-only audit-log load performed on route entry | Remove | `navigation-recovery.spec.ts` SW-132 route audit |
| Join Us Management — `/leader/join` | none on current main | `JoinManagement.tsx` | Previously redundant routine reload | Already removed; retain absent | existing + expanded navigation recovery coverage |
| Event Consent — `/leader/event-consent` | none on current main | `EventConsentManagement.tsx` | Previously redundant routine reload | Already removed; retain absent | existing + expanded navigation recovery coverage |
| Equipment inventory — `/leader/equipment` | none on current main | `EquipmentInventoryFilters.tsx` | Previously ordinary inventory reload | Already removed; retain absent | PR #602 history and repository audit |
| Member Management load failure — `/leader/members` | Retry loading member records | `MemberManagement.tsx` operational error state | Retries only the failed member-record request in place, preserving route/form context | Retain | `work-block-e-page-density.test.ts` scoped recovery contract |

No visible generic Refresh/Reload button remains in the audited authenticated page set. Application-specific actions such as Reset filters, reconnect/retry error states, import/sync operations, mutation-success refetches and automatic data refresh remain because they are not browser-refresh substitutes.

## SW-174 page-title tile audit

`LeaderPageHeader.tsx` is the reusable authenticated page header. On current main it already renders the page title as a visually hidden semantic `h1` and renders only supplied actions in the compact `leader-page-actions` row. It does not render a Paper/Card title tile or descriptive text. This block preserves that shared behaviour and adds regression coverage so the tile cannot return accidentally.

Preserved examples include Add Member, Add Event, Leader Access, Back-to-record actions, Print / Save PDF and Weekly Meetings' Create Meeting workflow. Content headings such as Open Meeting, Meeting History and Event actions remain ordinary page content and are not part of the removed title tile.

## Safety

No loading/subscription/polling logic was removed. No full-page reload was introduced. Permissions, route guards, mutation refresh callbacks, error recovery and unsaved-change protection remain unchanged. The Playwright cleanup coverage runs in both configured desktop and mobile projects and asserts no horizontal document overflow on Weekly Meetings after the title-tile cleanup.
