import assert from "node:assert/strict";
import test from "node:test";
import { eligibleLeader, selectAssignee } from "../src/assignment.js";
const profile = {role: "leader", active: true, sections: ["Group"]};
const org = {active: true, displayName: "Group leader", scoutingRole: "Group Leader", organisationSection: "Group"};
test("default assignment requires exactly one canonical active Group Leader", () => {
  const leader = eligibleLeader("gl", profile, org);
  assert.equal(leader.groupLeader, true);
  assert.deepEqual(selectAssignee([leader], ""), {assigneeUid: "gl", assigneeName: "Group leader"});
  assert.throws(() => selectAssignee([], ""));
  assert.throws(() => selectAssignee([leader, {...leader, uid: "other"}], ""));
  assert.deepEqual(selectAssignee([leader, {...leader, uid: "other"}], "other"), {assigneeUid: "other", assigneeName: "Group leader"});
  assert.throws(() => selectAssignee([leader], "outside"));
  assert.throws(() => selectAssignee([leader], 42));
});
test("inactive, expired and non-leader accounts cannot be assigned; role unions retain active appointments", () => {
  assert.equal(eligibleLeader("x", {...profile, active: false}, org), null);
  assert.equal(eligibleLeader("x", {role: "parent", active: true, sections: ["Group"]}, org), null);
  assert.equal(eligibleLeader("x", profile, {...org, active: false}), null);
  assert.equal(eligibleLeader("x", profile, {...org, appointments: [{appointment: "Group Leader", scope: "Group", active: false}]}), null);
  assert.equal(eligibleLeader("x", profile, {...org, appointments: [{appointment: "Group Leader", scope: "Group", active: true, endDate: "2000-01-01"}]}), null);
  assert.equal(eligibleLeader("x", profile, {...org, scoutingRole: "Group Treasurer", appointments: [{appointment: "Group Leader", scope: "Group", active: true}, {appointment: "Group Treasurer", scope: "Group", active: false}]}).groupLeader, true);
  assert.equal(eligibleLeader("x", profile, {...org, scoutingRole: "Deputy Group Leader"}).groupLeader, false);
});
