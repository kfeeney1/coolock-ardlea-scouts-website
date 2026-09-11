# SW-69 / SW-70 — Equipment Stores and dashboard filters

The existing equipment `location` field and `equipmentLocations` options remain the authoritative Store model. No second inventory or Store collection is introduced.

## Stores

- Equipment locations are presented to users as Stores.
- Existing SW-42 location values remain compatible and are included in Store filtering even if they predate a saved `equipmentLocations` option.
- New equipment can be assigned to a Store.
- Changing an existing item's Store continues to use the existing audited stock-movement workflow from Equipment History.
- Legacy records with an empty location can be identified through the `No Store assigned` filter when present.

## Search/filter navigation

The detailed inventory uses one combined URL-backed filter model:

- `q` — text search
- `status` — available, checked-out or unavailable
- `category` — equipment category
- `store` — Store/location
- `archived=1` — include archived records

Dashboard tiles use these same filters, which makes filtered inventory views bookmarkable and means browser/system Back restores the previous filter state.

## Accessibility

Dashboard summary tiles are semantic buttons with keyboard focus styling and descriptive accessible names. No nested interactive controls are introduced.
