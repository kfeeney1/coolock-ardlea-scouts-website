import { collection, doc, getDocs, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import type { SystemRole } from "../components/admin/AdminAuthProvider";
import {
  canAssignScoutingAppointment,
  canChangeSystemRole,
  canClearScoutingAppointment,
  canManageSectionScope,
  type LeaderDelegationActor,
  type LeaderDelegationTarget
} from "../security/leaderDelegationPolicy.ts";
import { activeScoutingAppointments, normalizeScoutingAppointment, normalizeScoutingAppointmentAssignments, type ScoutingAppointmentAssignment } from "../security/scoutingAppointments.ts";
import { normalizeLeaderRole, normalizeLeaderSections } from "./leaderAccessLogic";
import { buildPublicLeadershipAppointments, isAllowedPublicAppointment, PUBLIC_PROJECTION_VERSION, shouldPublishLeaderAppointments } from "./publicWhosWhoLogic";

export type LeaderAccessRecord = {
  uid: string;
  displayName: string;
  email: string;
  role: SystemRole;
  active: boolean;
  sections: string[];
  scoutingRole: string;
  appointments: ScoutingAppointmentAssignment[];
  organisationSection: string;
  organisationOrder: number;
  reportsToUid: string;
  showPublicly: boolean;
  accessVersion: number;
  organisationVersion: number;
};

function timestampVersion(value: unknown): number {
  return value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function"
    ? (value as { toMillis: () => number }).toMillis()
    : 0;
}

function sameStrings(left: string[], right: string[]): boolean {
  return [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}

export async function loadLeaderAccessRecords(): Promise<LeaderAccessRecord[]> {
  const [accessSnapshot, organisationSnapshot] = await Promise.all([
    getDocs(collection(db, "adminUsers")),
    getDocs(collection(db, "organisationLeadership"))
  ]);
  const byUid = new Map(organisationSnapshot.docs.map((item) => [item.id, item.data()]));
  return accessSnapshot.docs.map((item) => {
    const data = item.data();
    const role: SystemRole = normalizeLeaderRole(data.role);
    const sections = normalizeLeaderSections(data);
    const org = byUid.get(item.id);
    return {
      uid: item.id,
      displayName: typeof data.displayName === "string" ? data.displayName : "Leader",
      email: typeof data.email === "string" ? data.email : "",
      role,
      active: data.active === true,
      sections,
      scoutingRole: typeof org?.scoutingRole === "string" ? org.scoutingRole : "",
      appointments: normalizeScoutingAppointmentAssignments(org?.appointments, org?.scoutingRole, org?.organisationSection),
      organisationSection: typeof org?.organisationSection === "string" ? org.organisationSection : sections[0] || "Group",
      organisationOrder: typeof org?.organisationOrder === "number" ? org.organisationOrder : 999,
      reportsToUid: typeof org?.reportsToUid === "string" ? org.reportsToUid : "",
      showPublicly: org?.showPublicly === true,
      accessVersion: timestampVersion(data.updatedAt),
      organisationVersion: timestampVersion(org?.updatedAt)
    };
  });
}

export async function updateLeaderAccess(record: LeaderAccessRecord, actorUid: string, actorEmail: string): Promise<void> {
  const sections = [...new Set(record.sections.map((section) => section.trim()).filter(Boolean))];
  if (sections.length === 0) throw new Error("Leader access requires at least one canonical section.");
  const appointments = normalizeScoutingAppointmentAssignments(record.appointments, record.scoutingRole, record.organisationSection);
  const activeAppointments = activeScoutingAppointments(appointments);
  const canonicalAppointment = activeAppointments[0]?.appointment || normalizeScoutingAppointment(record.scoutingRole);
  if (record.role === "leader" && appointments.some((item) => !normalizeScoutingAppointment(item.appointment))) throw new Error("Unsupported Scouting appointment.");
  if (new Set(appointments.map((item) => item.id)).size !== appointments.length) throw new Error("Duplicate Scouting appointment scope.");

  await runTransaction(db, async (transaction) => {
    const actorAccessRef = doc(db, "adminUsers", actorUid);
    const actorOrgRef = doc(db, "organisationLeadership", actorUid);
    const targetAccessRef = doc(db, "adminUsers", record.uid);
    const targetOrgRef = doc(db, "organisationLeadership", record.uid);
    const publicRef = doc(db, "publicLeadership", record.uid);
    const auditRef = doc(collection(db, "auditLog"));

    // Do not read publicLeadership here. Its public-read rule deliberately rejects
    // missing/non-public projections, which made an otherwise authorised Leader
    // Access transaction fail before any write when the target was not on Who's Who.
    const [actorAccessSnap, actorOrgSnap, targetAccessSnap, targetOrgSnap] = await Promise.all([
      transaction.get(actorAccessRef),
      transaction.get(actorOrgRef),
      transaction.get(targetAccessRef),
      transaction.get(targetOrgRef)
    ]);
    if (!actorAccessSnap.exists() || !targetAccessSnap.exists()) throw new Error("Leader access record no longer exists.");

    const actorAccess = actorAccessSnap.data();
    const actor: LeaderDelegationActor = {
      uid: actorUid,
      systemRole: normalizeLeaderRole(actorAccess.role),
      scoutingAppointment: actorOrgSnap.exists() ? actorOrgSnap.data().scoutingRole : "",
      scoutingAppointments: actorOrgSnap.exists() ? actorOrgSnap.data().appointments : []
    };
    const currentAccess = targetAccessSnap.data();
    const currentRole = normalizeLeaderRole(currentAccess.role);
    const currentSections = normalizeLeaderSections(currentAccess);
    const currentOrg = targetOrgSnap.exists() ? targetOrgSnap.data() : null;
    const target: LeaderDelegationTarget = {
      uid: record.uid,
      systemRole: currentRole,
      scoutingAppointment: currentOrg?.scoutingRole ?? ""
    };

    if (timestampVersion(currentAccess.updatedAt) !== record.accessVersion
      || timestampVersion(currentOrg?.updatedAt) !== record.organisationVersion) {
      throw new Error("This leader changed since you opened the page. Refresh before saving.");
    }

    const roleChanged = currentRole !== record.role;
    const sectionsChanged = !sameStrings(currentSections, sections);
    const activeChanged = (currentAccess.active === true) !== record.active;
    const currentAppointments = normalizeScoutingAppointmentAssignments(currentOrg?.appointments, currentOrg?.scoutingRole, currentOrg?.organisationSection);
    const appointmentChanged = JSON.stringify(currentAppointments) !== JSON.stringify(appointments);
    const adminActor = actor.systemRole === "admin" || actor.systemRole === "super-admin";

    if (roleChanged && !canChangeSystemRole(actor, target)) throw new Error("Only a Super Admin can change this system role.");
    if (sectionsChanged && !canManageSectionScope(actor, target)) throw new Error("You cannot change this leader's section scope.");
    if (appointmentChanged) {
      const currentKeys = new Set(currentAppointments.map((item) => item.id));
      const added = appointments.filter((item) => !currentKeys.has(item.id));
      const allowed = added.every((item) => canAssignScoutingAppointment(actor, target, item.appointment))
        && (appointments.length > 0 || canClearScoutingAppointment(actor, target));
      if (!allowed) throw new Error("You cannot assign or remove one or more Scouting appointments.");
    }
    if (activeChanged && (!adminActor || target.systemRole === "super-admin")) throw new Error("You cannot change this account's active state.");

    const orgChanged = currentOrg?.organisationSection !== record.organisationSection
      || currentOrg?.organisationOrder !== record.organisationOrder
      || (currentOrg?.reportsToUid ?? "") !== record.reportsToUid
      || (currentOrg?.showPublicly === true) !== record.showPublicly;
    if (orgChanged && !adminActor) throw new Error("Only an Administrator can change organisation-chart or public-listing settings.");
    if (!roleChanged && !sectionsChanged && !activeChanged && !appointmentChanged && !orgChanged) return;

    transaction.update(targetAccessRef, {
      role: record.role,
      sections,
      active: record.active,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid
    });

    if (!record.active) {
      if (targetOrgSnap.exists()) transaction.delete(targetOrgRef);
      if (adminActor) transaction.delete(publicRef);
    } else {
      const safeAppointment = canonicalAppointment || "Scouter";
      const safeOrg = {
        displayName: record.displayName.trim().slice(0, 120),
        scoutingRole: safeAppointment,
        appointments,
        organisationSection: record.organisationSection.trim().slice(0, 80),
        organisationOrder: Math.max(0, Math.min(999, Math.round(record.organisationOrder))),
        reportsToUid: record.reportsToUid.trim().slice(0, 128),
        showPublicly: record.showPublicly,
        active: true,
        updatedAt: serverTimestamp()
      };
      transaction.set(targetOrgRef, safeOrg);

      if (adminActor) {
        const publicAppointments = buildPublicLeadershipAppointments({
          appointments,
          scoutingRole: safeAppointment,
          organisationSection: safeOrg.organisationSection,
          accountSections: sections
        });
        if (shouldPublishLeaderAppointments({ active: true, showPublicly: safeOrg.showPublicly, appointments, scoutingRole: safeAppointment, organisationSection: safeOrg.organisationSection, accountSections: sections })) {
          const primaryPublicAppointment = publicAppointments[0];
          transaction.set(publicRef, {
            displayName: safeOrg.displayName,
            scoutingRole: primaryPublicAppointment.role,
            organisationSection: primaryPublicAppointment.section,
            organisationSections: [...new Set(publicAppointments.map((item) => item.section))],
            publicAppointments,
            organisationOrder: safeOrg.organisationOrder,
            reportsToUid: safeOrg.reportsToUid,
            showPublicly: true,
            active: true,
            updatedAt: serverTimestamp(),
            publicProjectionVersion: PUBLIC_PROJECTION_VERSION,
            sourceAccessRole: "leader"
          });
        } else {
          transaction.delete(publicRef);
        }
      } else if (currentOrg?.showPublicly === true) {
        if (!isAllowedPublicAppointment(safeAppointment, safeOrg.organisationSection)) {
          throw new Error("An Administrator must change the appointment of a publicly listed leader when the new appointment is not public-listing compatible.");
        }
        transaction.update(publicRef, {
          scoutingRole: safeAppointment,
          updatedAt: serverTimestamp()
        });
      }
    }

    transaction.set(auditRef, {
      category: "leader-access",
      action: "Leader access and organisation updated",
      actorUid,
      actorEmail,
      targetId: record.uid,
      targetLabel: record.displayName || record.email,
      description: `System role ${currentRole} -> ${record.role}; appointments ${currentAppointments.map((item) => item.appointment + "@" + item.scope).join(", ") || "none"} -> ${appointments.map((item) => item.appointment + "@" + item.scope).join(", ") || "none"}; sections ${currentSections.join(", ")} -> ${sections.join(", ")}.`,
      section: record.organisationSection,
      createdAt: serverTimestamp()
    });
  });
}
