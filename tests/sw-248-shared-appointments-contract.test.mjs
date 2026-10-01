import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { effectivePermissionsFor } from "../src/security/permissionRegistry.ts";
import { leaderNavGroups } from "../src/navigation/leaderNavigation.ts";

const page = fs.readFileSync("src/pages/LeaderAccessManagement.tsx", "utf8");
const service = fs.readFileSync("src/services/leaderAccess.ts", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");

test("SW-248 Group appointments use Group scope when rendering and toggling", () => {
  assert.match(page, /assignmentScope = .*isGroupScopedAppointment\(appointment\) \? "Group" : appointmentScope\(record\)/);
  assert.match(page, /item\.scope === assignmentScope\(record, appointment\)/);
});

test("SW-248 appointments are persisted on the selected leader document only", () => {
  assert.match(service, /targetOrgRef = doc\(db, "organisationLeadership", record\.uid\)/);
  assert.match(service, /transaction\.set\(targetOrgRef, safeOrg\)/);
  assert.doesNotMatch(service, /where\([^\n]*scoutingRole/);
});

test("SW-248 does not encode a blanket cross-leader uniqueness rule", () => {
  assert.doesNotMatch(service, /appointment[^\n]*(already|taken|holder|unique)/i);
  assert.doesNotMatch(rules, /appointment[^\n]*(already|taken|holder|unique)/i);
});

test("SW-248 keeps authorization on appointment mutation", () => {
  assert.match(service, /canAssignScoutingAppointment\(actor, target, item\.appointment\)/);
  assert.match(service, /canClearScoutingAppointment\(actor, target\)/);
});


test("SW-248 shared holders independently derive Treasurer permissions and navigation", () => {
  const assignment = [{ appointment: "Group Treasurer", scope: "Group", active: true }];
  const first = effectivePermissionsFor("leader", "Group Treasurer", assignment).map((permission) => permission.id);
  const second = effectivePermissionsFor("leader", "Group Treasurer", assignment).map((permission) => permission.id);
  assert.deepEqual(second, first);
  assert.ok(first.includes("finance.manage.group"));
  assert.ok(first.includes("subs.policy.manage"));

  const treasurer = leaderNavGroups.find((group) => group.id === "treasurer");
  assert.ok(treasurer);
  assert.ok(treasurer.items.length > 0);
  assert.ok(treasurer.items.every((item) => item.appointments?.includes("Group Treasurer")));
});
