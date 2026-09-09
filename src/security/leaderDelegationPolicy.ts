import type { SystemRole } from "../components/admin/AdminAuthProvider.ts";
import {
  CANONICAL_SCOUTING_APPOINTMENTS,
  isGroupLeadershipAppointment,
  normalizeScoutingAppointment,
  type CanonicalScoutingAppointment
} from "./scoutingAppointments.ts";

export const GROUP_LEADERSHIP_DELEGABLE_APPOINTMENTS = [
  "Group Chairperson",
  "Group Youth Champion",
  "Section Leader",
  "Assistant Section Leader",
  "Programme Scouter",
  "Scouter"
] as const satisfies readonly CanonicalScoutingAppointment[];

export type LeaderDelegationActor = {
  uid: string;
  systemRole: SystemRole;
  scoutingAppointment?: unknown;
};

export type LeaderDelegationTarget = {
  uid: string;
  systemRole: SystemRole;
  scoutingAppointment?: unknown;
};

export function canOpenLeaderAccess(actor: LeaderDelegationActor): boolean {
  return actor.systemRole === "admin"
    || actor.systemRole === "super-admin"
    || (actor.systemRole === "leader" && isGroupLeadershipAppointment(actor.scoutingAppointment));
}

export function canChangeSystemRole(actor: LeaderDelegationActor, target: LeaderDelegationTarget): boolean {
  if (actor.systemRole !== "super-admin") return false;
  if (target.systemRole === "super-admin") return false;
  return actor.uid !== target.uid;
}

export function canManageOperationalAssignments(actor: LeaderDelegationActor, target: LeaderDelegationTarget): boolean {
  if (!canOpenLeaderAccess(actor)) return false;
  if (target.systemRole !== "leader") return false;
  if (target.uid === actor.uid) return false;
  return true;
}

export function appointmentsActorMayAssign(actor: LeaderDelegationActor): readonly CanonicalScoutingAppointment[] {
  if (actor.systemRole === "admin" || actor.systemRole === "super-admin") {
    return CANONICAL_SCOUTING_APPOINTMENTS;
  }
  if (actor.systemRole === "leader" && isGroupLeadershipAppointment(actor.scoutingAppointment)) {
    return GROUP_LEADERSHIP_DELEGABLE_APPOINTMENTS;
  }
  return [];
}

export function canAssignScoutingAppointment(
  actor: LeaderDelegationActor,
  target: LeaderDelegationTarget,
  appointment: unknown
): boolean {
  if (!canManageOperationalAssignments(actor, target)) return false;
  const canonical = normalizeScoutingAppointment(appointment);
  return canonical !== "" && appointmentsActorMayAssign(actor).includes(canonical);
}

export function canClearScoutingAppointment(actor: LeaderDelegationActor, target: LeaderDelegationTarget): boolean {
  if (!canManageOperationalAssignments(actor, target)) return false;
  const current = normalizeScoutingAppointment(target.scoutingAppointment);
  if (!current) return true;
  return appointmentsActorMayAssign(actor).includes(current);
}

export function canManageSectionScope(actor: LeaderDelegationActor, target: LeaderDelegationTarget): boolean {
  return canManageOperationalAssignments(actor, target);
}
