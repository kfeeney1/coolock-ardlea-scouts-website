import assert from "node:assert/strict";
import test from "node:test";
import { accountNavItems, dashboardNavItem, leaderNavGroups } from "../../src/navigation/leaderNavigation";

test("leader navigation IDs are unique and every destination has a page identity", () => {
  const items = [dashboardNavItem, ...leaderNavGroups.flatMap((group) => group.items), ...accountNavItems];
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  for (const item of items) {
    assert.ok(item.path.startsWith("/"), `${item.id} must use an absolute application path`);
    assert.ok(item.pageId, `${item.id} must declare destination page identity`);
  }
});

test("role-labelled destinations do not silently alias another role workspace", () => {
  const byId = new Map(leaderNavGroups.flatMap((group) => group.items).map((item) => [item.id, item]));
  assert.equal(byId.get("secretary-settings")?.path, "/leader/settings?view=secretary");
  assert.equal(byId.get("qm-settings")?.path, "/leader/settings?view=quartermaster");
  assert.equal(byId.get("qm-equipment-stores")?.path, "/leader/equipment?view=quartermaster");
  assert.equal(byId.get("group-equipment-stores")?.path, "/leader/equipment?view=group-operations");
  assert.notEqual(byId.get("secretary-settings")?.pageId, byId.get("qm-settings")?.pageId);
  assert.notEqual(byId.get("qm-equipment-stores")?.pageId, byId.get("group-equipment-stores")?.pageId);
});
