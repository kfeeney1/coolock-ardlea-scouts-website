import assert from "node:assert/strict";
import test from "node:test";

import { canEditPastWeeklyMeeting, weeklyMeetingEditMode } from "../../src/services/weeklyMeetingPermissions.ts";

test("Section Leaders and the Group Leader can edit past operational fields", () => {
  assert.equal(canEditPastWeeklyMeeting("Section Leader", false), true);
  assert.equal(canEditPastWeeklyMeeting("Group Leader", false), true);
});

test("admin access can edit past operational fields", () => {
  assert.equal(canEditPastWeeklyMeeting("", true), true);
});

test("lower section roles and the Group Secretary are read-only for past meetings", () => {
  assert.equal(canEditPastWeeklyMeeting("Assistant Section Leader", false), false);
  assert.equal(canEditPastWeeklyMeeting("Programme Scouter", false), false);
  assert.equal(canEditPastWeeklyMeeting("Scouter", false), false);
  assert.equal(canEditPastWeeklyMeeting("Group Secretary", false), false);
});

test("programme and completed badgework are locked for every closed meeting", () => {
  assert.deepEqual(weeklyMeetingEditMode("closed", "Section Leader", false, false), {
    canEditOperationalFields: true,
    canEditPlanningFields: false
  });
  assert.deepEqual(weeklyMeetingEditMode("closed", "Scouter", false, false), {
    canEditOperationalFields: false,
    canEditPlanningFields: false
  });
});

test("open meetings remain editable for normal leaders unless their access is read-only", () => {
  assert.deepEqual(weeklyMeetingEditMode("open", "Scouter", false, false), {
    canEditOperationalFields: true,
    canEditPlanningFields: true
  });
  assert.deepEqual(weeklyMeetingEditMode("open", "Group Secretary", false, true), {
    canEditOperationalFields: false,
    canEditPlanningFields: false
  });
});
