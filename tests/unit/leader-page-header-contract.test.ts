import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/admin/LeaderPageHeader.tsx", "utf8");

test("authenticated page headers remove the visual title tile and description", () => {
  assert.doesNotMatch(source, /<Paper|<Typography/);
  assert.doesNotMatch(source, /\{description\}/);
  assert.match(source, /component="h1"/);
  assert.match(source, /position: "absolute"/);
});

test("authenticated page actions remain in a compact responsive row", () => {
  assert.match(source, /data-testid="leader-page-actions"/);
  assert.match(source, /aria-label="Page actions"/);
  assert.match(source, /\{actions\}/);
  assert.match(source, /flexWrap: "wrap"/);
});
