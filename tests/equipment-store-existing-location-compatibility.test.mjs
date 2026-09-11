import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");

test("existing item location values remain visible as Stores", () => {
  assert.match(source, /\.\.\.locations\.map\(\(item\) => item\.name\)/);
  assert.match(source, /\.\.\.items\.map\(\(item\) => item\.location\.trim\(\)\)\.filter\(Boolean\)/);
});
