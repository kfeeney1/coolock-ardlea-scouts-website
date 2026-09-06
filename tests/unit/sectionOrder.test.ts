import test from "node:test";
import assert from "node:assert/strict";

import { sectionFilterOptions, sortScoutSections } from "../../src/services/sectionOrder.ts";

test("sortScoutSections follows the Scout progression order", () => {
  assert.deepEqual(
    sortScoutSections(["Ventures", "Beavers", "Rovers", "Scouts", "Cubs"]),
    ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]
  );
});

test("sortScoutSections keeps extra sections after the canonical progression", () => {
  assert.deepEqual(
    sortScoutSections(["Other", "Scouts", "Group", "Beavers"]),
    ["Beavers", "Scouts", "Group", "Other"]
  );
});

test("sortScoutSections trims blanks and removes duplicates", () => {
  assert.deepEqual(sortScoutSections([" Cubs ", "", "Cubs", "Beavers"]), ["Beavers", "Cubs"]);
});

test("sectionFilterOptions keeps all first", () => {
  assert.deepEqual(
    sectionFilterOptions(["Rovers", "all", "Beavers", "Scouts"]),
    ["all", "Beavers", "Scouts", "Rovers"]
  );
});
