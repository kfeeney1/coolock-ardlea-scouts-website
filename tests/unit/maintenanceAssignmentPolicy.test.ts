import assert from "node:assert/strict";
import { test } from "node:test";
import { maintenanceLeader, selectMaintenanceAssignee, validateMaintenanceProgress } from "../../src/services/maintenanceAssignmentPolicy.ts";
const access = {active: true, role: "leader", sections: ["Scouts"]};
const organisation = {active: true, displayName: "Group leader", appointments: [{appointment: "Group Leader", scope: "Group", active: true}]};

test("maintenance eligibility uses canonical active appointments and preserves account role unions", () => {
  for (const role of ["leader", "admin", "super-admin"]) assert.deepEqual(maintenanceLeader("gl", {...access, role}, organisation), {uid: "gl", displayName: "Group leader", groupLeader: true});
  for (const patch of [{active: false}, {role: "parent"}, {sections: []}, {section: "Scouts"}]) assert.equal(maintenanceLeader("gl", {...access, ...patch}, organisation), null);
  for (const patch of [{active: false}, {displayName: " "}, {appointments: []}, {appointments: [{appointment: "Group Leader", scope: "Group", active: false}]}, {appointments: [{appointment: "Group Leader", scope: "Group", endDate: "2000-01-01"}]}, {appointments: [{appointment: "Group Leader", scope: "Group", startDate: "2999-01-01"}]}]) assert.equal(maintenanceLeader("gl", access, {...organisation, ...patch}), null);
  assert.equal(maintenanceLeader("sl", access, {...organisation, appointments: [{appointment: "Section Leader", scope: "Scouts"}]})?.groupLeader, false);
  assert.equal(maintenanceLeader("wrong-scope", access, {...organisation, appointments: [{appointment: "Group Leader", scope: "Scouts"}]})?.groupLeader, false);
  assert.equal(maintenanceLeader("legacy", access, {active: true, displayName: "Legacy", scoutingRole: "group leader", organisationSection: "Group"})?.groupLeader, true);
});

test("default requires exactly one Group Leader; explicit eligible choices resolve ambiguity", () => {
  const gl = maintenanceLeader("gl", access, organisation)!;
  const sl = {uid: "sl", displayName: "Section leader", groupLeader: false};
  assert.deepEqual(selectMaintenanceAssignee([gl, sl], undefined), gl);
  assert.deepEqual(selectMaintenanceAssignee([gl, sl], ""), gl);
  assert.deepEqual(selectMaintenanceAssignee([gl, sl], "sl"), sl);
  for (const leaders of [[], [sl], [gl, {...gl, uid: "other"}]]) assert.throws(() => selectMaintenanceAssignee(leaders, undefined), /no single eligible Group Leader/);
  assert.deepEqual(selectMaintenanceAssignee([gl, {...gl, uid: "other"}], "other").uid, "other");
  assert.throws(() => selectMaintenanceAssignee([gl], "revoked"), /no longer eligible/);
  assert.throws(() => selectMaintenanceAssignee([gl], 42), /Choose an eligible leader/);
});

test("progress rejects stale revisions and forged status while supporting completion and reopen", () => {
  for (const status of ["open", "complete"]) assert.deepEqual(validateMaintenanceProgress({revision: 3, status, assigneeUid: "gl"}, 3), {revision: 4, status, assigneeUid: "gl"});
  for (const revision of [2, 4, "3", 3.5]) assert.throws(() => validateMaintenanceProgress({revision, status: "open", assigneeUid: "gl"}, 3), /task changed/);
  assert.throws(() => validateMaintenanceProgress({revision: 3, status: "deleted", assigneeUid: "gl"}, 3), /Open or Complete/);
  assert.throws(() => validateMaintenanceProgress({revision: 3, status: "open", assigneeUid: ""}, 3), /eligible leader/);
});
