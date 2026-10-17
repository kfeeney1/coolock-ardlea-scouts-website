import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { resolveLeaderNavigation } from "../../src/navigation/leaderNavigationState.ts";
import { leaderNavGroups } from "../../src/navigation/leaderNavigation.ts";

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
  const resolve = (route: string) => resolveLeaderNavigation(route, leaderNavGroups, []);
  assert.equal(resolve("/leader/events/record-1/edit")?.item.id, "events-activities");
  assert.equal(resolve("/leader/equipment/inventory?section=Cubs&view=quartermaster")?.item.id, "qm-detailed-inventory");
  assert.equal(resolve("/leader/equipment/inventory?view=unknown"), null);
  assert.equal(resolve("/leader/subs#family-billing")?.item.id, "family-billing");
  assert.notEqual(resolve("/leader/subs#other")?.item.id, "family-billing");
});


test("SW-288 desktop navigation uses independent balanced columns instead of rigid grid rows", () => {
  const header = source("src/components/admin/LeaderDashboardHeader.tsx");
  assert.ok(header.includes("leader-navigation-column-"));
  assert.ok(header.includes("visibleGroups.filter((_,index)=>index%2===column)"));
  assert.ok(header.includes('gridTemplateColumns:"repeat(2, minmax(0, 1fr))"'));
  assert.ok(header.includes("minWidth:0"));
  assert.ok(header.includes('data-testid="leader-navigation-desktop"'));
});
