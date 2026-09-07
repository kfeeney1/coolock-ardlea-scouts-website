# Stage 23.3 mobile workflow regression expansion

## Existing baseline

The Stage 20.6 Pixel 7 suite already protects the main leader routes from page-level horizontal overflow, fixed/sticky elements escaping the viewport and navigation expansion regressions. Separate focused specs cover mobile Back ordering for public navigation and an event edit dialog, Badgework exception editing, consent medication layout and narrow confirmation actions.

Stage 23.3 extends that baseline rather than adding another route-smoke suite.

## Added operational contracts

The existing `mobile-operational-pass.spec.ts` now exercises these deterministic, non-destructive workflows on the canonical Pixel 7 project:

- Weekly Meetings: open a seeded meeting, enter a notes draft with the mobile keyboard active, scroll to the bottom and prove the sticky actions neither cover the field nor leave the viewport.
- Members and attendance: open a member record from its tile, use browser Back to return to the list, filter the seeded attendance cohort, open member detail and return without losing the filter.
- Equipment: open the add form, enter an unsaved name, open its category listbox and prove one browser Back closes the listbox before one further Back closes the dialog.
- Section finances and receipts: open and dismiss the transaction listbox with one Back action, enter a valid decimal amount and confirm the receipt action and form remain viewport-safe.

The existing event record/edit/select/Back journey and Badgework mobile exception journey remain authoritative for those surfaces. No production record is written by the new scenarios.

## Boundaries retained

- Canonical emulator seed and credentials only.
- No fixed sleeps, native dialogs or weakened assertions.
- RouteScrollManager and browser history remain unchanged.
- No RBAC, Firebase Rules, service, schema or production-data changes.
