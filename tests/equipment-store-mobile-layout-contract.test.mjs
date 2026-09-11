import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");

test("equipment filters retain responsive mobile/desktop layout", () => {
  assert.match(source, /direction=\{\{ xs: "column", md: "row" \}\}/);
  assert.match(source, /gridTemplateColumns: \{ xs: "1fr", md: "repeat\(2, minmax\(0, 1fr\)\)"/);
});
