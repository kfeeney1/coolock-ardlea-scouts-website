# SW-293 Back / return navigation audit

Audited against the Member Management workflow and the application's record-route navigation architecture.

| Flow | Semantic return | Multi-origin handling | Coverage |
| --- | --- | --- | --- |
| Member record | Member Management or explicit family origin | `familyReturnTo` plus browser POP for observed in-app history | member-record-page, mobile-back-navigation |
| Consent / medical full record | originating member when supplied; otherwise Consent Management | explicit `returnTo` / legacy `fromMemberPath`; safe direct fallback | member-record-page, mobile-consent-medication |
| Quick Medical Information | exact operational origin when supplied; otherwise Consent Management | explicit `returnTo` + `returnLabel`; no manufactured history | member-record-page |
| Event record/editor | Events & Activities / originating record | record parent + browser POP when observed | event-record-page, mobile-back-navigation |
| Join enquiry record | Join Us Management | explicit parent; unsaved-change guard retained | join-consent-record-pages |
| Equipment record | Equipment & Stores | explicit deep-link-safe parent; no raw history dependency | damaged-equipment-issues / equipment suites |
| Equipment store move | equipment record | explicit record path | equipment suites |
| Create event / meeting | originating list | existing unsaved-change exit handling retained | event/weekly suites |
| Scouter consent | My Profile | explicit profile destination | leader/profile suites |
| Parent Portal | parent context | portal-local navigation; no leader-module origin state introduced | parent-portal |
| Finance, reports, settings, access management | module-local pages | no shared cross-module record route requiring origin state found in audited controls | navigation/role suites |

## Rules

1. A visible Back/Return control must have a safe semantic destination for direct/deep-link entry.
2. A record that can be entered from multiple modules carries an explicit return target rather than inferring from the current URL.
3. Browser/device Back may POP real observed history, but an arbitrary history index is not treated as proof of a valid previous app screen.
4. Return navigation must restore page identity/context, not only a URL.
5. Cross-module medical quick access uses the same rule: explicit origin state when present, safe Consent Management fallback when absent.

The audit found and corrected the raw-history Equipment Record Back control. No redesign was introduced.
