import { collection, doc, getDoc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { MemberRecord } from "./memberAdmin";

export type MemberLeaderTransitionInvitation = {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  emailAddress: string;
  mobileNumber: string;
  section: string;
  endMemberMembership: boolean;
};

export async function createMemberLeaderTransitionInvitation(
  member: MemberRecord,
  endMemberMembership: boolean,
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("A signed-in leader is required.");
  if (!member.emailAddress.trim()) throw new Error("Add the member's email address before preparing a leader registration.");
  if (!member.firstName.trim() || !member.lastName.trim()) throw new Error("The member's name is required.");
  const invitation = doc(collection(db, "leaderTransitionInvitations"));
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  await setDoc(invitation, {
    memberId: member.id,
    firstName: member.firstName.trim(),
    lastName: member.lastName.trim(),
    displayName: member.displayName.trim(),
    emailAddress: member.emailAddress.trim(),
    mobileNumber: member.mobileNumber.trim(),
    section: member.section,
    endMemberMembership,
    status: "pending",
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    expiresAt,
  });
  return `${window.location.origin}/leader/register?transition=${encodeURIComponent(invitation.id)}`;
}

export async function loadMemberLeaderTransitionInvitation(id: string): Promise<MemberLeaderTransitionInvitation> {
  if (!/^[A-Za-z0-9_-]{15,40}$/.test(id)) throw new Error("This leader registration link is invalid.");
  const snapshot = await getDoc(doc(db, "leaderTransitionInvitations", id)).catch(() => {
    throw new Error("This leader registration link is unavailable or has expired.");
  });
  if (!snapshot.exists()) throw new Error("This leader registration link is unavailable or has expired.");
  const data = snapshot.data();
  if (data.status !== "pending" || !(data.expiresAt instanceof Timestamp) || data.expiresAt.toDate().getTime() <= Date.now()) {
    throw new Error("This leader registration link is unavailable or has expired.");
  }
  return {
    id: snapshot.id,
    memberId: String(data.memberId || ""),
    firstName: String(data.firstName || ""),
    lastName: String(data.lastName || ""),
    displayName: String(data.displayName || ""),
    emailAddress: String(data.emailAddress || ""),
    mobileNumber: String(data.mobileNumber || ""),
    section: typeof data.section === "string" ? data.section : "",
    endMemberMembership: data.endMemberMembership === true,
  };
}
