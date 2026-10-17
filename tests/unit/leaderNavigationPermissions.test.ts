import assert from "node:assert/strict";
import test from "node:test";
import { leaderNavigationFilter, NAVIGATION_PERMISSIONS } from "../../src/navigation/leaderNavigationPermissions.ts";
import { leaderNavGroups, dashboardNavItem, accountNavItems } from "../../src/navigation/leaderNavigation.ts";

const items = leaderNavGroups.flatMap((group) => group.items);
const visible = (role: string, scoutingRole: string, appointments?: unknown) => items.filter(leaderNavigationFilter({ role, scoutingRole, appointments })).map((item) => item.id);
test("navigation combines active appointments without duplicating destinations", () => {
  const appointments = [
    { appointment: "Group Secretary", scope: "Group", active: true },
    { appointment: "Group Quartermaster / Bo'sun", scope: "Group", active: true },
    { appointment: "Group Treasurer", scope: "Group", active: false }
  ];
  const result = visible("leader", "Group Secretary", appointments);
  assert.ok(result.includes("secretary-meeting-records"));
  assert.ok(result.includes("qm-reports"));
  assert.ok(result.includes("activity-log"));
  assert.ok(!result.includes("treasurer-subs"));
  assert.ok(!result.includes("system-information"));
  assert.equal(new Set(result).size, result.length);
});
test("system navigation follows canonical effective permission grants", () => {
  assert.ok(visible("super-admin", "").includes("system-information"));
  assert.ok(!visible("admin", "").includes("system-information"));
  assert.ok(!visible("leader", "Section Leader").includes("leader-access"));
  assert.ok(visible("leader", "Deputy Group Leader").includes("leader-access"));
  assert.ok(visible("leader", "Group Treasurer").includes("settings"));
  assert.ok(!visible("leader", "Group Quartermaster / Bo'sun").includes("settings"));
});


test("every destination has an explicit requirement using registered permission IDs", async () => {
  const { PERMISSION_REGISTRY } = await import("../../src/security/permissionRegistry.ts");
  const ids = new Set(PERMISSION_REGISTRY.map((permission) => permission.id));
  const allItems = [dashboardNavItem, ...items, ...accountNavItems];
  assert.deepEqual(Object.keys(NAVIGATION_PERMISSIONS).sort(), allItems.map((item) => item.id).sort());
  for (const item of allItems) {
    assert.ok(NAVIGATION_PERMISSIONS[item.id].length > 0, item.id);
    for (const permission of NAVIGATION_PERMISSIONS[item.id]) assert.ok(ids.has(permission), `${item.id}: ${permission}`);
  }
});

test("unresolved identities and parent-only profiles receive no Leader destinations", () => {
  for (const profile of [null, { role: "parent", scoutingRole: "" }, { role: "unknown", scoutingRole: "" }, { role: "parent", scoutingRole: "Group Secretary" }]) {
    assert.deepEqual([dashboardNavItem, ...items, ...accountNavItems].filter(leaderNavigationFilter(profile)), []);
  }
});

test("new or inherited-property destinations fail closed until explicitly mapped", () => {
  const filter = leaderNavigationFilter({ role: "super-admin", scoutingRole: "" });
  for (const id of ["unreconciled-page", "toString", "constructor", "__proto__"]) {
    assert.equal(filter({ id, label: id, path: "/leader/new", pageId: id }), false);
  }
});

test("expired or inactive contextual appointments hide their categories and protected destinations", () => {
  for (const appointment of ["Group Secretary", "Group Treasurer", "Group Quartermaster / Bo'sun", "Group Leader"]) {
    for (const dateStatus of [{ active: false }, { active: true, endDate: "2000-01-01" }, { active: true, startDate: "2999-01-01" }]) {
      const result = visible("leader", appointment, [{ appointment, scope: "Group", ...dateStatus }]);
      for (const id of ["activity-log", "leader-access", "settings", "secretary-meeting-records", "treasurer-subs", "qm-reports"]) assert.ok(!result.includes(id), `${appointment}: ${id}`);
      assert.ok(result.includes("weekly-meetings"), "ordinary Leader grants remain intact");
    }
  }
});

test("active multiple appointments produce the union of contextual views without system access", () => {
  const names = ["Group Secretary", "Group Treasurer", "Group Quartermaster / Bo'sun"];
  const appointments = names.map((appointment) => ({ appointment, scope: "Group", active: true }));
  const union = new Set(names.flatMap((appointment) => visible("leader", appointment)));
  assert.deepEqual(visible("leader", "Group Secretary", appointments).sort(), [...union].sort());
  assert.ok(!union.has("system-information"));
  assert.ok(!union.has("leader-requests"));
});
