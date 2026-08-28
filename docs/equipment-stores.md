# Equipment & Stores

Equipment & Stores is the group equipment register and operational workflow for stock, section holdings, incidents, programme reservations and reporting.

## Access and permissions

Quartermaster / Bo'sun, Group Leader, Admin and Super Admin users can manage the group inventory, locations and categories, move stock, investigate and resolve incidents, and export the full equipment report set. Active section leaders can view the catalogue and equipment history, check equipment in and out for their authorised sections, and report issues connected to their section holdings. Parents do not have access to equipment inventory, loans, reservations, incidents or internal equipment history.

## Inventory and availability

Each item records its name, category, storage location, tracking mode, total quantity, condition, notes and optional replacement value. Availability is derived from total stock after checked-out/reserved and unavailable quantities are removed. Archived items remain historical records and cannot be newly allocated.

## Checkout and return

A checkout records the section, selected equipment quantities and expected return date. Allocation is transactional so two leaders cannot successfully claim the same remaining stock. Section holdings stay open until all outstanding quantities have either been returned or accounted for by an incident. Partial returns are supported.

## Broken, lost, missing and maintenance issues

Leaders can report damaged, lost, missing or maintenance/cleaning issues. A loan-linked issue accounts for the affected quantity on that checkout and makes the stock unavailable. Damaged, lost and missing reports use the established notification path for the Quartermaster / Bo'sun and Group Leader. Equipment managers can move an issue through Reported, Investigating and Resolved, recording the outcome and resolution notes. Written-off stock reduces the total stock count; found/returned, repaired, replaced and no-action resolutions restore the affected unavailable quantity as appropriate.

## Equipment history and stock moves

Equipment history is append-only. It records operational events such as checkout, return, incident, resolution and stock movement. Managers may move available stock between storage locations. A full move changes the item's location; a partial move creates or adds the moved quantity at the destination while retaining the remaining quantity at the source.

## Weekly Meetings, events and activities

Weekly Meetings and Events & Activities can attach structured planned equipment requirements. Planning alone does not allocate stock. A leader can reserve the planned quantities for the programme date and later convert the reservation into a real checkout. Programme status follows Planned, Reserved, Checked Out, Partially Returned and Returned.

Copy Meeting copies reusable planned equipment requirements to the new meeting but never copies the original reservation or checkout transaction. This prevents the copied meeting from silently holding or issuing stock.

## Reports and CSV exports

The Equipment Reports panel provides CSV exports for Inventory Summary, Equipment by Location, Equipment by Category, Current Section Holdings, Overdue Equipment, Repair / Maintenance List, Missing / Lost Equipment, Loss & Damage History, Equipment Usage, and Write-offs / Replacement Value. Reports can be filtered by section, equipment item, category, location, status/issue and date range where relevant. Reservations are not counted as actual section holdings, overdue checkouts or usage transactions.

Equipment managers also have a prominent **Export all equipment CSV** action on the Equipment & Stores dashboard. CSV free-text cells are neutralised where needed to avoid spreadsheet-formula execution when exports are opened in spreadsheet software.

## Test and seed strategy

The canonical Playwright seed remains deliberately small and deterministic. It provides the stable users, members, meetings and other shared records needed to reach application workflows, but it does not seed permanent equipment items, loans, incidents, history or programme-equipment requirements. Equipment E2E tests create the stock and transactions they need through the application during each emulator-backed run. The seed-contract check explicitly guards this rule so future tests do not turn transient equipment scenarios into long-lived fixture dependencies.

Equipment coverage is split across unit tests for stock, incidents, history, programme/reservation and reporting logic; Firestore rules tests for equipment collections and role scope; and Playwright regression for checkout/return, incident resolution, stock movement and report downloads.
