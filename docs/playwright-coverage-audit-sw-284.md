# SW-284 Playwright E2E coverage and stability audit

Baseline: `main` at `1def0c94c2944d7e34f61dd2924e71fb0319861b` (PR #674 / SW-283), audited 2026-10-03.

## Baseline inventory

- 68 Playwright spec files and 240 source test declarations.
- Projects: desktop Chromium, Pixel 7 mobile Chromium, and a focused iPhone 15 WebKit critical path.
- Full-suite main run 37152428133 was green on the baseline SHA: shard 1 ran 34 specs / 202 passed / 90 intentional skips in 9.6m; shard 2 ran 34 specs / 175 passed / 80 intentional skips in 10.1m.
- Weighted estimates are 515.5s versus 513.9s. The current two-shard distribution is already balanced; SW-284 does not change spec ownership or weights enough to justify speculative rebalancing.
- 63 specs have measured runtime weights. Five newer specs use the documented 15s provisional weight: form-validation-focus, member-leader-transition, rover-membership, parent-leader-context and test-environment-smoke.
- PR selection always includes public-smoke, leader-navigation and logout, then adds affected functional suites. Shared infrastructure, Firebase/config, workflows, scripts and unknown paths deliberately fall back to the full suite. Main always runs the full suite.
- Static suite verification already rejects fixed Playwright sleeps, Firebase `networkidle` waits, focused tests, hard-coded canonical passwords, missing Playwright imports and missing/multiple suite ownership.

## Coverage matrix

| Product area | Principal specs | Roles / devices / boundaries protected | Audit conclusion |
| --- | --- | --- | --- |
| Public website | public-smoke, consent-section-symbols, section-consent-ux | public desktop/mobile, protected leader routes | Meaningful coverage retained. |
| Authentication / password | password-visibility, logout, role-permissions, parent-portal | parent, leader, desktop/mobile | Login/logout, masking and recovery entry are covered; external email delivery/reset completion is intentionally outside emulator E2E. |
| Dashboard | admin-overview, leader-journey, equipment-leader-dashboard | admin, Group Leader, section leader, mobile | Distinct role/scope and responsive behaviour. |
| Role navigation | leader-navigation, navigation-recovery, leader-navigation-info | ordinary leader, Treasurer, Secretary, QM/Bo'sun, Group Operations, super admin, desktop/mobile | Broad canonical page-identity protection; overlap is intentional because role identities differ. |
| Member Management | member-management-targeting, member-record-page, member-history-search | admin/leader, section filters, history | Creation/edit/reload/history and targeting protected. |
| Member transitions / Rover | member-leader-transition, rover-membership | youth-to-leader, Rover concurrent membership, mobile | State transitions protected. |
| Section / multi-section | member-record-page, role-permissions, release-authorization-boundaries | primary/secondary sections, multi-section leader | Critical scope boundaries protected. |
| Families / parents | parent-access-management, parent-approved-journey, parent-leader-context, parent-portal | parent-only, leader-only, combined identity, admin | Distinct identity and linked-child boundaries retained. |
| Consent / medical | parent-approved-journey, member-record-page, mobile-consent-medication, join-consent-record-pages | parent/leader, desktop/mobile | Save, linkage, medical indicator and responsive presentation protected. |
| Medication | parent-approved-journey, mobile-consent-medication, admin-overview | parent/leader/admin | Presentation and consent-save path protected; medication-specific authorisation defaults remain covered through their feature regression tests outside this audit's structural changes. |
| Leader Access | leader-access-management, leader-journey | admin, section-aware access, appointments | SW-153/SW-219/SW-248/SW-257 regressions protected. |
| Leader management / appointments | leader-access-management, organisation-chart | admin/super admin, shared appointments | Distinct appointment and organisation behaviour protected. |
| Meetings | weekly-section-tracker, weekly-record-integrity, meeting-records | section leader, Group Leader, Secretary, admin, mobile | Create/edit/copy/reopen/read-only/history/state integrity covered. |
| Events | event-record-page, event-gallery, event-consent-linking | leader, parent handoff, desktop/mobile | Create/edit/gallery/consent/deep-link paths covered. |
| Badgework / Adventure Skills | adventure-skills-badgework, badgework-skill-filter, weekly-parent-sharing | leader/parent, meeting handoff | Multi-member, award visibility and filters protected. |
| Equipment / Stores | equipment-checkout, damaged-equipment-issues, equipment-reports, equipment-leader-dashboard | admin/QM, ordinary-leader denial, mobile | Checkout/check-in/damage/history/store/reporting protected. |
| Subs / payments | subs-management | section leader, super admin, desktop/mobile | State-changing payment persistence and section scoping protected. |
| Family billing | navigation-recovery plus Subs surface | super admin navigation identity | Route identity is protected. Detailed family-account calculations are intentionally not duplicated in E2E where the current suite already exercises the shared Subs/payment model; add focused E2E if family-billing-only state logic diverges. |
| Floats / finance | finance-cashbook, finance-reporting, finance-transfers, navigation-recovery | section leader, Treasurer/Group Operations identities | Scoped workflow, reports and transfer boundary protected. |
| Reports | reports, finance-reporting, equipment-reports, navigation-recovery | role-specific report surfaces, mobile | Generation/actions and canonical role identities protected. Exact future role/report menu policy remains product-scope work, not SW-284. |
| Settings | site-settings, navigation-recovery, subs-management | admin, ordinary-leader denial, role-specific page identity | Access and save behaviour protected. Exact future role/settings policy remains product-scope work. |
| Permission boundaries | role-permissions, roles-permissions, release-authorization-boundaries | unauthenticated, parent, leader, admin, super admin | Intentional overlap: route access, catalogue/effective permissions and data-scope boundaries are materially different. |
| Mobile / responsive | mobile-* specs, leader-navigation, reports, parent-approved-journey, theme-parity | Pixel 7 plus iPhone WebKit critical path | Mobile variants retained only for responsive/navigation/layout contracts or critical journeys. |
| Validation / errors | form-validation-focus, event-record-page, meeting-records, member-leader-transition | invalid form, blocked popup, unusable import, invalid transition | Material error paths protected. |
| Audit / activity | activity-log, weekly-activity-audit | privileged read-only and meeting mutation audit | State-to-audit linkage protected. |

## Duplicate / overlap review

All 68 specs were reviewed by test intent, role, device and state transition. No test was removed merely to reduce runtime. Apparent duplicates were retained when they protect a different boundary:

- `role-permissions` vs `roles-permissions`: route/data access versus the Roles & Permissions catalogue/effective-role UI.
- `leader-navigation` vs `navigation-recovery`: responsive menu behaviour versus canonical destination/page identity across officer roles.
- mobile feature checks versus desktop journeys: retained only where viewport, disclosure, Back, sticky action, dialog or WebKit behaviour is itself the regression contract.
- member/parent consent specs: separate linkage, parent save, mobile presentation and legacy-route protections.

The audit found no genuine duplicate whose deletion would preserve the same regression boundary with equal clarity, so the resulting suite remains 68 specs / 240 declarations.

## Flake-risk review and corrections

The suite contains no `page.waitForTimeout` or `frame.waitForTimeout` calls. Existing static checks also reject `networkidle` waits.

SW-284 identified positional selection of dynamic parent-child options as an avoidable readiness/order risk. Two selectors were changed to target the canonical child by stable name/value instead of `.nth(1)`. The static suite contract now rejects future `getByRole("option").nth(...)` use so dynamic list order cannot silently become a test dependency.

Remaining positional locators are intentional contracts: navigation-order assertions and two table-cell geometry checks. They are not dynamic record selection.

Recent retry-only failures (including SW-283) were reviewed as historical evidence. Their fixes use explicit settled application state; SW-284 does not remove or weaken those assertions.

## Intentional non-E2E boundaries

- Actual password-reset email delivery and external mail-provider behaviour: E2E verifies the recovery entry point; delivery belongs to email/service integration coverage.
- Exact future Reports and Settings role/menu matrices: product-policy epics decide those permissions; current E2E protects implemented route identities and access boundaries without inventing policy.
- Cosmetic variants without distinct responsive behaviour: not duplicated across projects solely for screenshot/layout parity.
- Family Billing currently shares the Subs model and has route-identity protection; a separate state-changing E2E should be added if family-only calculation/state behaviour becomes distinct.

## Result

The audit preserves comprehensive behavioural protection while making dynamic option selection deterministic. No product behaviour was changed, no assertion was weakened, no spec was removed for runtime, PR/full selection remains conservative, and the measured two-shard balance remains effectively even.
