import assert from "node:assert/strict";
import test from "node:test";
import { accountNavItems, dashboardNavItem, leaderNavGroups, redesignedNavigationGroups } from "../../src/navigation/leaderNavigation.ts";
import { resolveLeaderNavigation } from "../../src/navigation/leaderNavigationState.ts";

const standalone = [dashboardNavItem, ...accountNavItems];
const resolve = (path: string) => resolveLeaderNavigation(path, redesignedNavigationGroups(leaderNavGroups), standalone);

test("query order and filters retain the correct workspace identity", () => {
  for (const path of ["/leader/reports?view=treasurer&section=Cubs", "/leader/reports?section=Cubs&view=treasurer"]) {
    assert.equal(resolve(path)?.item.id, "treasurer-reports");
    assert.equal(resolve(path)?.groupId, "treasurer");
  }
  assert.equal(resolve("/leader/settings?section=Cubs&view=quartermaster")?.item.id, "qm-settings");
  assert.equal(resolve("/leader/settings?view=unknown"), null);
});

test("specific fragments win over the unfragmented destination", () => {
  assert.equal(resolve("/leader/subs?section=Cubs#family-billing")?.item.id, "family-billing");
  assert.equal(resolve("/leader/members?search=Alice#details")?.item.id, "member-management");
});

test("saved aliases and detail pages retain their canonical parent", () => {
  assert.equal(resolve("/leader/member-history?search=Alice")?.item.id, "member-management");
  assert.equal(resolve("/leader/events/example/edit?tab=details")?.item.id, "events-activities");
  assert.equal(resolve("/leader/eventual"), null);
});

test("active parent uses the selected presentation's stable category id", () => {
  assert.equal(resolve("/leader/system")?.groupId, "super-admin");
  assert.equal(resolveLeaderNavigation("/leader/system", leaderNavGroups, standalone)?.groupId, "administration");
  assert.equal(resolve("/leader?section=Cubs")?.item.id, "dashboard");
});

test("unavailable destinations cannot produce an active item or parent", () => {
  const visible = leaderNavGroups.map(group => ({ ...group, items: group.items.filter(item => item.id !== "qm-settings") }));
  assert.equal(resolveLeaderNavigation("/leader/settings?view=quartermaster", visible, standalone), null);
  assert.equal(resolveLeaderNavigation("/leader/system", [], standalone), null);
});
