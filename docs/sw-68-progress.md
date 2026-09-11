# SW-68 numeric input audit

Affected equipment numeric editors identified on main:

- item total quantity
- checkout quantity
- return quantity
- stock movement quantity
- incident quantity

The implementation must allow a temporary empty editing value without persisting null/empty data. Service writes remain validated numeric values.
