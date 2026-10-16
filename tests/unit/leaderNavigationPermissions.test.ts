import assert from "node:assert/strict";
import test from "node:test";
import { leaderNavigationFilter } from "../../src/navigation/leaderNavigationPermissions.ts";
import { leaderNavGroups } from "../../src/navigation/leaderNavigation.ts";

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
