# Leader navigation Back matrix (SW-184)

Baseline: SW-183 merged as `b164af1e691709c8f35f10614e9df52145526fdb`.
Both navigation versions retain the canonical route map and existing permission/data guards.

| Entry and action | Expected result | Automated evidence |
| --- | --- | --- |
| Open Leader menu, expand/collapse categories | Only the menu creates one transient history entry; category changes do not add entries | `leader-navigation-back.spec.ts`, both modes and viewports |
| Select Events from Dashboard, open event, open its editor; browser Back repeatedly | Editor → event record → Events list → Dashboard, without loops or a public-page detour | Same spec |
| Record reached from an observed in-app Events list, ordinary Back to Events link | Return through actual history, preserving the originating list URL/query | Same spec |
| Ctrl-click record Back to Events link | Open its explicit parent in another tab; keep current record unchanged | Same spec; modified-click unit cases |
| Record loaded directly or reloaded, even with a stale positive history index | Use the explicit Events parent link; do not infer a previous in-app screen | Same spec and `mobile-back-navigation.spec.ts` |
| Join enquiry reached from its list; edit notes and use Back to enquiries | Show existing unsaved-change dialog; Stay retains draft; explicit Leave discards it and returns to list | `leader-navigation-back.spec.ts`, both modes and viewports |
| Event editor with changes; guarded Back/Save/Discard/Stay | Existing event editor policy remains authoritative | `sw362-event-edit-navigation.spec.ts` |
| Menu open at a destination; browser Back | Dismiss menu first, keeping page identity; next Back follows route history | Existing navigation-contract/version suites |
| Account lacks permission for a destination | Existing route/data guards still apply; Back selection grants no access | Existing navigation-version and authorization suites |

The record bridge intercepts only an ordinary, unmodified, same-origin explicit parent link with a Back/Return label. Page-owned buttons, already-handled clicks, download links and links targeting another browsing context retain their own behavior. In particular, the Join enquiry's dirty Back button owns its confirmation dialog and must not be replaced by a history POP.

The bridge still requires a previous route observed by the current mounted app plus a valid in-app history index. Reload/direct entry keeps each record's explicit fallback. The existing safe-parent map covers Member, Event, Join and Consent records; other workflow-specific Back controls remain unchanged. Browser history does not invent an internal predecessor for a direct entry.

Browser-history tests on an Android-sized viewport exercise the browser-equivalent Back path. Physical Android system Back, screen-reader/manual accessibility acceptance, live Firebase TEST acceptance (SW-189) and Production Manual Testing remain separate and pending. Automated results are not a Production pass.
