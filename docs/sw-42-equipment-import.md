# SW-42 equipment asset-register mapping

Source: Jira SW-42 attachment `Coolok.xlsx`, register period 2025–2026. The source workbook is not committed; its reviewed, normalised equipment seed is committed as `config/sw-42-equipment-seed.json`.

## Column mapping

| Workbook column | Site field | Treatment |
| --- | --- | --- |
| Date Purchased | `purchaseDate` | Excel dates become ISO `YYYY-MM-DD`; `N/A` remains an empty date and exports as `N/A`. |
| Quantity | `totalQuantity` | Only a single non-negative whole number is accepted. |
| Description | `name` | Leading/trailing and repeated whitespace is normalised; spelling is preserved. |
| Category Fixture & Fittings Equipment Other | `category` | The workbook value is preserved (`Equipment` or `Fixture & Fittings`). |
| Replacement Value | `replacementValue`, `replacementValueNote` | Numeric values are stored as per-item euro values because the workbook multiplies Quantity × Replacement Value. Text such as `TBC on next purchase` is preserved in the note field, not converted to zero. |
| Date Sold or Disposed of | `disposalDate` | Excel dates become ISO dates; blank remains blank. |
| Unlabelled calculated column G | generated report value | The site calculates Quantity × Replacement Value. The source total cell is circular (`G2 = G201`, `G201 = SUM(G3:G200)`) and is not imported. |
| Worksheet name | `assetRegisterSection` | Preserves whether the row came from Equipment or Hall. |

The current schema also requires fields absent from the workbook:

- `trackingMode`: explicitly mapped to `quantity` because every workbook row is an aggregate quantity line, not an individually identified asset.
- `condition`: stored as `not-recorded`; the importer does not claim the assets are in good condition.
- `location`: Hall rows map to `Hall`; the general Equipment worksheet maps to the explicit sentinel `Location not recorded`.
- `notes`, checked-out/unavailable quantities and archive state: no workbook equivalents. New imports start with blank notes, zero operational allocations and active state because the controlled import creates catalogue rows, not loans or incidents.
- provenance: `source=spreadsheet-import`, a reviewed batch, and worksheet/row source reference are stored on every record.

## Reviewed source corrections

The attachment contains 136 populated asset rows. The owner supplied these explicit corrections after reviewing the three ambiguous rows:

| Source | Original value | Reviewed import value |
| --- | --- | --- |
| Hall row 6 | Quantity `20+` | Quantity `20`; description remains `Spars`. |
| Hall row 41 | Quantity `3 x 2`, description `Soft` | Quantity `1`; description `3x2 size sofa`. |
| Hall row 42 | Quantity `1x4`, description `Sofa` | Quantity `1`; description `4x1 size sofa`. |

The corrections live in `config/sw-42-equipment-source-overrides.json` and are passed explicitly to the preparer. The resulting manifest contains all 136 rows, records which overrides were applied, and has no rejected source rows. Unknown or unmatched override entries fail preparation.

## Guarded seed workflow

The committed seed was generated with:

```bash
python scripts/prepare-equipment-import.py --xlsx /private/Coolok.xlsx --overrides config/sw-42-equipment-source-overrides.json --batch sw-42-coolok-2025-2026 --output config/sw-42-equipment-seed.json
```

Run a dry run with a narrowly scoped service account and review its project, aggregate counts, conflicts and digest. Execution requires `PROD_EQUIPMENT_IMPORT_CONFIRM_PROJECT`, `PROD_EQUIPMENT_IMPORT_EXPECTED_CREATE_COUNT`, and `PROD_EQUIPMENT_IMPORT_EXPECTED_MANIFEST_SHA256` to match that dry run exactly.

The seed only creates deterministic documents and refuses name or content conflicts; it never updates or deletes existing authoritative equipment. Consequently it does not require Firestore's paid managed-export feature. A provenance-checked rollback is available and refuses to delete any document that does not exactly match this seed batch and source row.

```bash
npm run seed:equipment
npm run seed:equipment -- --execute
npm run seed:equipment -- --rollback
```

The deterministic document ID is derived from batch plus worksheet/row. Re-running the same reviewed batch is idempotent, name conflicts fail closed, and rollback deletes only records whose stored provenance still matches.

For production, use the manually dispatched **Seed production equipment** GitHub workflow. Run `dry-run` first, then start a separate `seed` run with the exact reported create count, SHA-256 digest and confirmation phrase. The workflow checks out `main`, uses the protected production environment and cannot run from pushes, pull requests, deployments or ordinary CI. Its separate rollback action has its own exact confirmation phrase.

## Report

Authorised administrators, Group Leaders and Quartermaster / Bo'sun roles see **Export asset register** on Equipment & Stores. It produces current authoritative equipment data using the source register's meaningful columns, plus a final Register Section column so the two original worksheets remain distinguishable. Ordinary leaders can still use their established catalogue and checkout permissions but cannot see equipment report controls.
