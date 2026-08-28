import { describe, expect, it } from "vitest";

import { canEditPastWeeklyMeeting, weeklyMeetingEditMode } from "../../src/services/weeklyMeetingPermissions";

describe("weekly meeting history permissions", () => {
  it("allows Section Leaders and the Group Leader to edit past operational fields", () => {
    expect(canEditPastWeeklyMeeting("Section Leader", false)).toBe(true);
    expect(canEditPastWeeklyMeeting("Group Leader", false)).toBe(true);
  });

  it("allows admin access to edit past operational fields", () => {
    expect(canEditPastWeeklyMeeting("", true)).toBe(true);
  });

  it("keeps lower section roles and the Group Secretary read-only for past meetings", () => {
    expect(canEditPastWeeklyMeeting("Assistant Section Leader", false)).toBe(false);
    expect(canEditPastWeeklyMeeting("Programme Scouter", false)).toBe(false);
    expect(canEditPastWeeklyMeeting("Scouter", false)).toBe(false);
    expect(canEditPastWeeklyMeeting("Group Secretary", false)).toBe(false);
  });

  it("locks programme and completed badgework for every closed meeting", () => {
    expect(weeklyMeetingEditMode("closed", "Section Leader", false, false)).toEqual({
      canEditOperationalFields: true,
      canEditPlanningFields: false
    });
    expect(weeklyMeetingEditMode("closed", "Scouter", false, false)).toEqual({
      canEditOperationalFields: false,
      canEditPlanningFields: false
    });
  });

  it("keeps open meetings editable for normal leaders unless their access is read-only", () => {
    expect(weeklyMeetingEditMode("open", "Scouter", false, false)).toEqual({
      canEditOperationalFields: true,
      canEditPlanningFields: true
    });
    expect(weeklyMeetingEditMode("open", "Group Secretary", false, true)).toEqual({
      canEditOperationalFields: false,
      canEditPlanningFields: false
    });
  });
});
