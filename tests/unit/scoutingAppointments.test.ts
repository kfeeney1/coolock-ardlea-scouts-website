import assert from "node:assert/strict";
import test from "node:test";
import { effectivePermissionsFor } from "../../src/security/permissionRegistry.ts";
import {
  isGroupLeadershipAppointment,
  normalizeScoutingAppointment
} from "../../src/security/scoutingAppointments.ts";

test("Deputy Group Leader is canonical and legacy aliases normalize forward", () => {
  assert.equal(normalizeScoutingAppointment("Deputy Group Leader"), "Deputy Group Leader");
  assert.equal(normalizeScoutingAppointment("Deputy-Group-Leader"), "Deputy Group Leader");
  assert.equal(normalizeScoutingAppointment("Deputy GroupLead"), "Deputy Group Leader");
  assert.equal(normalizeScoutingAppointment("DGL"), "Deputy Group Leader");
  assert.equal(isGroupLeadershipAppointment("Deputy Group Leader"), true);
  assert.equal(isGroupLeadershipAppointment("Group Leader"), true);
  assert.equal(isGroupLeadershipAppointment("Group Treasurer"), false);
});

test("Deputy Group Leader inherits the Group Leader operational bundle without Admin promotion", () => {
  const gl = new Set(effectivePermissionsFor("leader", "Group Leader").map((permission) => permission.id));
  const dgl = new Set(effectivePermissionsFor("leader", "Deputy Group Leader").map((permission) => permission.id));
  assert.deepEqual([...dgl].sort(), [...gl].sort());
  assert.equal(dgl.has("roles.manage.admin"), false);
  assert.equal(dgl.has("system.superadmin.protect"), false);
});
