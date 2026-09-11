import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");

test("inventory filters are initialised from URL search parameters", () => {
  assert.match(source, /const \[searchParams, setSearchParams\] = useSearchParams\(\)/);
  assert.match(source, /searchParams\.get\("q"\)/);
  assert.match(source, /searchParams\.get\("category"\)/);
  assert.match(source, /searchParams\.get\("store"\)/);
  assert.match(source, /searchParams\.get\("status"\)/);
});
