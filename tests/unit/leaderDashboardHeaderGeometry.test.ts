import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("leader dashboard header fits its container without viewport-width overflow", () => {
  const header = source("src/components/admin/LeaderDashboardHeader.tsx");
  assert.ok(header.includes('data-testid="leader-dashboard-header"'));
  assert.ok(header.includes('width: "100%"'));
  assert.ok(header.includes('maxWidth: 1536'));
  assert.ok(!header.includes("100vw"));
  assert.ok(!header.includes('transform: "translateX(-50%)"'));
});

test("leader dashboard navigation keeps nested record routes matched to their parent item", () => {
  const header = source("src/components/admin/LeaderDashboardHeader.tsx");
  assert.ok(header.includes('target.search && current.search !== target.search'));
  assert.ok(header.includes('target.hash && current.hash !== target.hash'));
  assert.ok(header.includes('${location.pathname}${location.search}${location.hash}'));
});


test("SW-288 desktop navigation uses independent balanced columns instead of rigid grid rows", () => {
  const header = source("src/components/admin/LeaderDashboardHeader.tsx");
  assert.ok(header.includes("leader-navigation-column-"));
  assert.ok(header.includes("visibleGroups.filter((_,index)=>index%2===column)"));
  assert.ok(header.includes('gridTemplateColumns:"repeat(2, minmax(0, 1fr))"'));
  assert.ok(header.includes("minWidth:0"));
  assert.ok(header.includes('data-testid="leader-navigation-desktop"'));
});
