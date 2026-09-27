import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { recordAuditEvent } from "./auditLog";

export type ReconciliationCandidate = {
  id: string;
  displayName: string;
  dateOfBirth: string;
  section: string;
  parentName: string;
  emailAddress: string;
  mobileNumber: string;
};

export type ConsentReconciliationState = {
  unresolved: string[];
  ambiguous: Array<{ consentId: string; candidateMemberIds: string[] }>;
  linked: number;
};

const value = (data: Record<string, unknown>, key: string) => typeof data[key] === "string" ? String(data[key]).trim() : "";
const identity = (name: string, dob: string) => `${name.trim().toLocaleLowerCase()}::${dob.trim()}`;

async function currentProfile() {
  const user = auth.currentUser;
  if (!user) throw new Error("No signed-in leader.");
  const snapshot = await getDoc(doc(db, "adminUsers", user.uid));
  if (!snapshot.exists() || snapshot.data().active !== true) throw new Error("Active leader profile is required.");
  return { user, profile: snapshot.data() };
}

export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const { profile } = await currentProfile();
  return profile.role === "super-admin";
}

export async function reconcileUnlinkedConsents(): Promise<ConsentReconciliationState> {
  const { user, profile } = await currentProfile();
  if (!["admin", "super-admin"].includes(String(profile.role))) throw new Error("Administrator access is required.");

  const [membersSnapshot, consentsSnapshot] = await Promise.all([
    getDocs(collection(db, "members")),
    getDocs(collection(db, "consentApplications"))
  ]);
  const membersByIdentity = new Map<string, ReconciliationCandidate[]>();
  for (const member of membersSnapshot.docs) {
    const data = member.data();
    const candidate: ReconciliationCandidate = {
      id: member.id,
      displayName: value(data, "displayName"),
      dateOfBirth: value(data, "dateOfBirth"),
      section: value(data, "section"),
      parentName: value(data, "parentName"),
      emailAddress: value(data, "emailAddress"),
      mobileNumber: value(data, "mobileNumber")
    };
    if (!candidate.displayName || !candidate.dateOfBirth) continue;
    const key = identity(candidate.displayName, candidate.dateOfBirth);
    membersByIdentity.set(key, [...(membersByIdentity.get(key) ?? []), candidate]);
  }

  const state: ConsentReconciliationState = { unresolved: [], ambiguous: [], linked: 0 };
  for (const consent of consentsSnapshot.docs) {
    const data = consent.data();
    if (data.formType !== "youth-activity-consent" || value(data, "memberId")) continue;
    const candidates = membersByIdentity.get(identity(value(data, "childName"), value(data, "childDOB"))) ?? [];
    if (candidates.length !== 1) {
      if (candidates.length > 1) state.ambiguous.push({ consentId: consent.id, candidateMemberIds: candidates.map((item) => item.id) });
      else state.unresolved.push(consent.id);
      continue;
    }
    await updateDoc(consent.ref, { memberId: candidates[0].id, linkedBy: user.uid, linkedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    await recordAuditEvent({
      category: "member", action: "Consent linked to member", targetId: candidates[0].id,
      targetLabel: candidates[0].displayName, section: candidates[0].section,
      description: `Automatically reconciled consent ${consent.id} using a unique exact name and date-of-birth identity match.`
    });
    state.linked += 1;
  }
  return state;
}

export async function loadReconciliationCandidates(): Promise<ReconciliationCandidate[]> {
  const { profile } = await currentProfile();
  if (profile.role !== "super-admin") throw new Error("Super Admin access is required.");
  const snapshot = await getDocs(collection(db, "members"));
  return snapshot.docs.map((member) => {
    const data = member.data();
    return {
      id: member.id, displayName: value(data, "displayName"), dateOfBirth: value(data, "dateOfBirth"),
      section: value(data, "section"), parentName: value(data, "parentName"),
      emailAddress: value(data, "emailAddress"), mobileNumber: value(data, "mobileNumber")
    };
  }).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function manuallyReconcileConsent(consentId: string, memberId: string, reason: string): Promise<void> {
  const { user, profile } = await currentProfile();
  if (profile.role !== "super-admin") throw new Error("Super Admin access is required.");
  if (!reason.trim()) throw new Error("A reconciliation reason is required.");

  const [consentSnapshot, memberSnapshot] = await Promise.all([
    getDoc(doc(db, "consentApplications", consentId)),
    getDoc(doc(db, "members", memberId))
  ]);
  if (!consentSnapshot.exists() || consentSnapshot.data().formType !== "youth-activity-consent") throw new Error("Consent record was not found.");
  if (!memberSnapshot.exists()) throw new Error("Member record was not found.");

  const previousMemberId = value(consentSnapshot.data(), "memberId");
  if (previousMemberId === memberId) return;
  const member = memberSnapshot.data();
  await updateDoc(consentSnapshot.ref, {
    memberId, linkedBy: user.uid, linkedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    reconciliationReason: reason.trim().slice(0, 500), reconciledBy: user.uid, reconciledAt: serverTimestamp()
  });
  await recordAuditEvent({
    category: "member", action: previousMemberId ? "Consent relationship corrected" : "Consent manually reconciled",
    targetId: consentId, targetLabel: value(member, "displayName"), section: value(member, "section"),
    description: `Consent relationship changed from ${previousMemberId || "unlinked"} to member ${memberId}. Reason: ${reason.trim().slice(0, 300)}`
  });
}
