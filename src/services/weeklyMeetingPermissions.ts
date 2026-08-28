import type { WeeklyMeetingStatus } from "./weeklyTracker";

const PAST_MEETING_EDITOR_ROLES = new Set(["Section Leader", "Group Leader"]);

export type WeeklyMeetingEditMode = {
  canEditOperationalFields: boolean;
  canEditPlanningFields: boolean;
};

export function canEditPastWeeklyMeeting(scoutingRole: string, isAdmin: boolean): boolean {
  return isAdmin || PAST_MEETING_EDITOR_ROLES.has(scoutingRole);
}

export function weeklyMeetingEditMode(
  status: WeeklyMeetingStatus,
  scoutingRole: string,
  isAdmin: boolean,
  baseReadOnly: boolean
): WeeklyMeetingEditMode {
  if (baseReadOnly) return { canEditOperationalFields: false, canEditPlanningFields: false };
  if (status === "open") return { canEditOperationalFields: true, canEditPlanningFields: true };

  return {
    canEditOperationalFields: canEditPastWeeklyMeeting(scoutingRole, isAdmin),
    canEditPlanningFields: false
  };
}
