import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentsActorMayAssign,
  canAssignScoutingAppointment,
  canChangeSystemRole,
  canClearScoutingAppointment,
  canManageSectionScope,
  canOpenLeaderAccess
} from "../../src/security/leaderDelegationPolicy.ts";

const ordinaryLeader = { uid: "leader-1", systemRole: "leader" as const, scoutingAppointment: "Section Leader" };
const groupLeader = { uid: "gl-1", systemRole: "leader" as const, scoutingAppointment: "Group Leader" };
const deputyGroupLeader = { uid: "dgl-1", systemRole: "leader" as const, scoutingAppointment: "Deputy Group Leader" };
const admin = { uid: "admin-1", systemRole: "admin" as const, scoutingAppointment: "Group Council Administrator" };
const superAdmin = { uid: "super-1", systemRole: "super-admin" as const, scoutingAppointment: "Group Council Administrator" };

test("Leader Access is limited to Admin, Super Admin and Group Leadership", () => {
  assert.equal(canOpenLeaderAccess(ordinaryLeader), false);
  assert.equal(canOpenLeaderAccess(groupLeader), true);
  assert.equal(canOpenLeaderAccess(deputyGroupLeader), true);
  assert.equal(canOpenLeaderAccess(admin), true);
  assert.equal(canOpenLeaderAccess(superAdmin), true);
});

test("only Super Admin can change another non-Super-Admin system role", () => {
  assert.equal(canChangeSystemRole(admin, ordinaryLeader), false);
  assert.equal(canChangeSystemRole(groupLeader, ordinaryLeader), false);
  assert.equal(canChangeSystemRole(superAdmin, ordinaryLeader), true);
  assert.equal(canChangeSystemRole(superAdmin, { ...superAdmin, uid: "super-2" }), false);
  assert.equal(canChangeSystemRole(superAdmin, { ...ordinaryLeader, uid: superAdmin.uid }), false);
});

test("Group Leadership may delegate only ordinary operational appointments", () => {
  const allowed = appointmentsActorMayAssign(groupLeader);
  assert.equal(allowed.includes("Section Leader"), true);
  assert.equal(allowed.includes("Scouter"), true);
  assert.equal(allowed.includes("Group Chairperson"), true);
  assert.equal(allowed.includes("Group Leader"), false);
  assert.equal(allowed.includes("Deputy Group Leader"), false);
  assert.equal(allowed.includes("Group Treasurer"), false);
  assert.equal(allowed.includes("Group Secretary"), false);
  assert.equal(allowed.includes("Group Quartermaster / Bo'sun"), false);

  assert.equal(canAssignScoutingAppointment(groupLeader, ordinaryLeader, "Section Leader"), true);
  assert.equal(canAssignScoutingAppointment(deputyGroupLeader, ordinaryLeader, "Scouter"), true);
  assert.equal(canAssignScoutingAppointment(groupLeader, ordinaryLeader, "Deputy Group Leader"), false);
  assert.equal(canAssignScoutingAppointment(groupLeader, ordinaryLeader, "Group Treasurer"), false);
});

test("Admin and Super Admin may assign canonical scouting appointments without gaining system-role escalation", () => {
  assert.equal(canAssignScoutingAppointment(admin, ordinaryLeader, "Group Treasurer"), true);
  assert.equal(canAssignScoutingAppointment(admin, ordinaryLeader, "Deputy Group Leader"), true);
  assert.equal(canAssignScoutingAppointment(superAdmin, ordinaryLeader, "Group Leader"), true);
  assert.equal(canChangeSystemRole(admin, ordinaryLeader), false);
});

test("ordinary operational assignment changes cannot target self or protected system roles", () => {
  assert.equal(canManageSectionScope(groupLeader, ordinaryLeader), true);
  assert.equal(canManageSectionScope(groupLeader, { ...ordinaryLeader, uid: groupLeader.uid }), false);
  assert.equal(canManageSectionScope(groupLeader, admin), false);
  assert.equal(canManageSectionScope(admin, superAdmin), false);
  assert.equal(canClearScoutingAppointment(groupLeader, { ...ordinaryLeader, scoutingAppointment: "Section Leader" }), true);
  assert.equal(canClearScoutingAppointment(groupLeader, { ...ordinaryLeader, scoutingAppointment: "Group Treasurer" }), false);
});
