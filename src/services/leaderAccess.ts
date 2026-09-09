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
import { normalizeScoutingAppointment } from "../security/scoutingAppointments.ts";
import { normalizeLeaderRole, normalizeLeaderSections } from "./leaderAccessLogic";
import { loadInternalOrganisation } from "./organisationChart";
import { isAllowedPublicAppointment, PUBLIC_PROJECTION_VERSION } from "./publicWhosWhoLogic";

export type LeaderAccessRecord = {
  uid: string;
  displayName: string;
  email: string;
  role: SystemRole;
  active: boolean;
  sections: string[];
  scoutingRole: string;
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
  const [snapshot, organisation] = await Promise.all([
    getDocs(collection(db, "adminUsers")),
    loadInternalOrganisation().catch(() => [])
  ]);
  const byUid = new Map(organisation.map((item) => [item.uid, item]));
  return snapshot.docs.map((item) => {
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
      scoutingRole: org?.scoutingRole || "",
      organisationSection: org?.organisationSection || sections[0] || "Group",
      organisationOrder: org?.organisationOrder ?? 999,
      reportsToUid: org?.reportsToUid || "",
      showPublicly: role === "leader" && org?.showPublicly === true,
      accessVersion: timestampVersion(data.updatedAt),
      organisationVersion: 0
    };
  });
}

export async function updateLeaderAccess(record: LeaderAccessRecord, actorUid: string, actorEmail: string): Promise<void> {
  const sections = [...new Set(record.sections.map((section) => section.trim()).filter(Boolean))];
  if (sections.length === 0) throw new Error("Leader access requires at least one canonical section.");
  const canonicalAppointment = normalizeScoutingAppointment(record.scoutingRole);
  if (record.scoutingRole.trim() && !canonicalAppointment) throw new Error("Unsupported Scouting appointment.");

  await runTransaction(db, async (transaction) => {
    const actorAccessRef = doc(db, "adminUsers", actorUid);
    const actorOrgRef = doc(db, "organisationLeadership", actorUid);
    const targetAccessRef = doc(db, "adminUsers", record.uid);
    const targetOrgRef = doc(db, "organisationLeadership", record.uid);
    const publicRef = doc(db, "publicLeadership", record.uid);
    const auditRef = doc(collection(db, "auditLog"));

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
      scoutingAppointment: actorOrgSnap.exists() ? actorOrgSnap.data().scoutingRole : ""
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

    if (timestampVersion(currentAccess.updatedAt) !== record.accessVersion) {
      throw new Error("This leader changed since you opened the page. Refresh before saving.");
    }

    const roleChanged = currentRole !== record.role;
    const sectionsChanged = !sameStrings(currentSections, sections);
    const activeChanged = (currentAccess.active === true) !== record.active;
    const currentAppointment = normalizeScoutingAppointment(currentOrg?.scoutingRole ?? "");
    const appointmentChanged = currentAppointment !== canonicalAppointment;
    const adminActor = actor.systemRole === "admin" || actor.systemRole === "super-admin";

    if (roleChanged && !canChangeSystemRole(actor, target)) throw new Error("Only a Super Admin can change this system role.");
    if (sectionsChanged && !canManageSectionScope(actor, target)) throw new Error("You cannot change this leader's section scope.");
    if (appointmentChanged) {
      const allowed = canonicalAppointment
        ? canAssignScoutingAppointment(actor, target, canonicalAppointment)
        : canClearScoutingAppointment(actor, target);
      if (!allowed) throw new Error("You cannot assign or remove this Scouting appointment.");
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
      transaction.delete(publicRef);
    } else {
      const safeAppointment = canonicalAppointment || "Scouter";
      const safeOrg = {
        displayName: record.displayName.trim().slice(0, 120),
        scoutingRole: safeAppointment,
        organisationSection: record.organisationSection.trim().slice(0, 80),
        organisationOrder: Math.max(0, Math.min(999, Math.round(record.organisationOrder))),
        reportsToUid: record.reportsToUid.trim().slice(0, 128),
        showPublicly: record.role === "leader" && record.showPublicly,
        active: true,
        updatedAt: serverTimestamp()
      };
      transaction.set(targetOrgRef, safeOrg);
      if (record.role === "leader" && safeOrg.showPublicly && isAllowedPublicAppointment(safeAppointment, safeOrg.organisationSection)) {
        transaction.set(publicRef, {
          ...safeOrg,
          showPublicly: true,
          publicProjectionVersion: PUBLIC_PROJECTION_VERSION,
          sourceAccessRole: "leader"
        });
      } else {
        transaction.delete(publicRef);
      }
    }

    transaction.set(auditRef, {
      category: "leader-access",
      action: "Leader access and organisation updated",
      actorUid,
      actorEmail,
      targetId: record.uid,
      targetLabel: record.displayName || record.email,
      description: `System role ${currentRole} -> ${record.role}; appointment ${currentAppointment || "none"} -> ${canonicalAppointment || "none"}; sections ${currentSections.join(", ")} -> ${sections.join(", ")}.`,
      section: record.organisationSection,
      createdAt: serverTimestamp()
    });
  });
}
