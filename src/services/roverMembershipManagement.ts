import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";

import { auth, db } from "../firebase";
import { ServiceFailure, UserFacingError } from "./applicationErrors.ts";
import { canonicalMemberSections } from "./memberSectionCore.mjs";
import { normalizeMemberSectionRoles } from "./memberYouthRoles";

export type RoverManagementCandidate = {
  uid: string;
  displayName: string;
  email: string;
  roverActive: boolean;
};

function stringValue(data: DocumentData, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
}

function clean(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function memberStatus(value: unknown): "active" | "inactive" | "left" {
  return value === "inactive" || value === "left" ? value : "active";
}

function isActiveRoverSectionLeader(organisation: DocumentData | null): boolean {
  if (!organisation || organisation.active !== true) return false;
  const appointments = Array.isArray(organisation.appointments) ? organisation.appointments : [];
  return appointments.some((item) => item && typeof item === "object"
    && item.active !== false && item.appointment === "Section Leader" && item.scope === "Rovers");
}

export async function loadRoverManagementCandidates(): Promise<RoverManagementCandidate[]> {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("A signed-in leader account is required.", "auth/unauthenticated");
  const [profileSnapshot, organisationSnapshot] = await Promise.all([
    getDoc(doc(db, "adminUsers", user.uid)),
    getDoc(doc(db, "organisationLeadership", user.uid))
  ]);
  const profile = profileSnapshot.data();
  const organisation = organisationSnapshot.exists() ? organisationSnapshot.data() : null;
  const canManage = profileSnapshot.exists() && profile?.active === true
    && (profile.role === "admin" || profile.role === "super-admin"
      || isActiveRoverSectionLeader(organisation)
      || (organisation?.active === true && ["Group Leader", "Deputy Group Leader", "Deputy-Group-Leader", "Deputy GroupLead", "DGL"].includes(organisation.scoutingRole)));
  if (!canManage) return [];

  const leaders = await getDocs(query(collection(db, "adminUsers"), where("active", "==", true), where("role", "==", "leader")));
  const candidates = await Promise.all(leaders.docs.map(async (leader) => {
    const data = leader.data();
    const email = stringValue(data, "email");
    if (!email) return null;
    const linked = await getDocs(query(collection(db, "members"), where("accountUid", "==", leader.id)));
    if (linked.size > 1) return null;
    const memberData = linked.docs[0]?.data();
    const roverActive = Boolean(memberData && memberData.status === "active"
      && canonicalMemberSections(memberData.sections, stringValue(memberData, "section")).includes("Rovers"));
    return { uid: leader.id, displayName: stringValue(data, "displayName") || email, email, roverActive };
  }));
  return candidates.filter((item): item is RoverManagementCandidate => item !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function setManagedRoverMembership(targetUid: string, enabled: boolean): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("A signed-in leader account is required.", "auth/unauthenticated");
  const targetSnapshot = await getDoc(doc(db, "adminUsers", targetUid));
  if (!targetSnapshot.exists() || targetSnapshot.data().active !== true || targetSnapshot.data().role !== "leader") {
    throw new UserFacingError("The selected person is not an eligible active adult.");
  }
  const target = targetSnapshot.data();
  const email = stringValue(target, "email");
  const displayName = stringValue(target, "displayName");
  if (!email || !displayName) throw new UserFacingError("The selected adult needs a name and email before Rover membership can be managed.");

  const accountMatches = await getDocs(query(collection(db, "members"), where("accountUid", "==", targetUid)));
  if (accountMatches.size > 1) throw new UserFacingError("More than one member record is linked to this adult. Reconcile the records first.");
  let member = accountMatches.docs[0];

  const now = serverTimestamp();
  if (!member && enabled) {
    const parts = displayName.trim().split(/\s+/);
    const firstName = parts[0] || displayName;
    const lastName = parts.slice(1).join(" ") || "Rover";
    await setDoc(doc(db, "members", `rover_${targetUid}`), {
      firstName, lastName, displayName, displayNameMode: "auto", dateOfBirth: "",
      section: "Rovers", sections: ["Rovers"], sectionRoles: {}, parentName: "",
      emailAddress: email, mobileNumber: clean(target.mobileNumber ?? "", 40),
      emergencyContactName: "", emergencyContactPhone: "", status: "active",
      source: "rover-authorized-management", sourceJoinApplicationId: "", accountUid: targetUid,
      createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid
    });
    return;
  }
  if (!member) throw new UserFacingError("No Rover member record exists for this adult.");

  const data = member.data();
  if (data.accountUid && data.accountUid !== targetUid) throw new UserFacingError("This member record is linked to another account.");
  const sections = canonicalMemberSections(data.sections, stringValue(data, "section"));
  const nextSections = enabled ? [...sections.filter((section) => section !== "Rovers"), "Rovers"] : sections.filter((section) => section !== "Rovers");
  const retainedSections = nextSections.length > 0 ? nextSections : ["Rovers"];
  await updateDoc(member.ref, {
    accountUid: targetUid,
    section: retainedSections[0],
    sections: retainedSections,
    sectionRoles: normalizeMemberSectionRoles(data.sectionRoles, retainedSections),
    status: enabled ? "active" : (nextSections.length === 0 ? "left" : memberStatus(data.status)),
    updatedAt: now,
    updatedBy: user.uid
  });
}
