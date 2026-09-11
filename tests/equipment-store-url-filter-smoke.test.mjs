import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");

test("equipment filter URL keys remain stable", () => {
  for (const key of ["q", "category", "store", "status", "archived"]) {
    assert.match(source, new RegExp(`(?:get|updateFilterParam)\\(\\"${key}\\"`));
  }
});
