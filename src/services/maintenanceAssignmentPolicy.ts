import { activeScoutingAppointments, normalizeScoutingAppointmentAssignments } from "../security/scoutingAppointments.ts";
import { UserFacingError } from "./applicationErrors.ts";

export type MaintenanceLeader = {uid: string; displayName: string; groupLeader: boolean};

/** Private canonical inputs stay outside the member-facing selector payload. */
export function maintenanceLeader(uid: string, access: Record<string, unknown>, organisation: Record<string, unknown>): MaintenanceLeader | null {
  if (!uid || access.active !== true || !["leader", "admin", "super-admin"].includes(String(access.role))
    || !Array.isArray(access.sections) || !access.sections.length || "section" in access
    || organisation.active !== true || typeof organisation.displayName !== "string" || !organisation.displayName.trim()) return null;
  const appointments = activeScoutingAppointments(normalizeScoutingAppointmentAssignments(organisation.appointments, organisation.scoutingRole, organisation.organisationSection));
  if (!appointments.length) return null;
  return {uid, displayName: organisation.displayName.trim(), groupLeader: appointments.some(item => item.appointment === "Group Leader" && item.scope === "Group")};
}

export function selectMaintenanceAssignee(leaders: readonly MaintenanceLeader[], selected: unknown): MaintenanceLeader {
  if (selected !== undefined && typeof selected !== "string") throw new UserFacingError("Choose an eligible leader.");
  const choices = leaders.filter(leader => selected ? leader.uid === selected : leader.groupLeader);
  if (choices.length !== 1) throw new UserFacingError(selected
    ? "The selected leader is no longer eligible. Choose another leader."
    : "There is no single eligible Group Leader. Select a responsible leader explicitly.");
  return choices[0];
}

export function validateMaintenanceProgress(input: Record<string, unknown>, revision: number) {
  if (!Number.isSafeInteger(input.revision) || input.revision !== revision) throw new UserFacingError("This task changed. Reload its latest details before saving.");
  if (input.status !== "open" && input.status !== "complete") throw new UserFacingError("Choose Open or Complete.");
  if (typeof input.assigneeUid !== "string" || !input.assigneeUid) throw new UserFacingError("Choose an eligible leader.");
  return {status: input.status, assigneeUid: input.assigneeUid, revision: revision + 1};
}

/** Indices let Rules validate the selected canonical evidence in constant work
 * rather than scanning the entire appointment list twice for each publication. */
export function maintenanceLeaderProjection(uid: string, access: Record<string, unknown>, organisation: Record<string, unknown>) {
  const leader = maintenanceLeader(uid, access, organisation);
  if (!leader) return null;
  const raw = Array.isArray(organisation.appointments) ? organisation.appointments : [];
  const current = (value: unknown) => activeScoutingAppointments(normalizeScoutingAppointmentAssignments([value]));
  return {...leader, eligibleIndex: raw.findIndex(item => current(item).length > 0), groupLeaderIndex: raw.findIndex(item => current(item).some(appointment => appointment.appointment === "Group Leader" && appointment.scope === "Group"))};
}
