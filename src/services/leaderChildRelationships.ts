import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "../firebase";

export type LeaderChildRelationship = {
  id: string;
  leaderUid: string;
  memberId: string;
  active: boolean;
  updatedBy: string;
};

function actorUid(): string {
  const value = auth.currentUser?.uid;
  if (!value) throw new Error("You must be signed in to manage leader family relationships.");
  return value;
}

function relationshipId(leaderUid: string, memberId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(leaderUid) || !/^[A-Za-z0-9_-]{1,128}$/.test(memberId)) {
    throw new Error("Leader and member records must use canonical identifiers.");
  }
  return `${leaderUid}--${memberId}`;
}

export async function loadLeaderChildRelationships(leaderUid: string): Promise<LeaderChildRelationship[]> {
  const snapshot = await getDocs(query(collection(db, "leaderChildRelationships"), where("leaderUid", "==", leaderUid)));
  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      leaderUid: String(data.leaderUid ?? ""),
      memberId: String(data.memberId ?? ""),
      active: data.active === true,
      updatedBy: String(data.updatedBy ?? "")
    };
  }).filter((item) => item.leaderUid === leaderUid);
}

export async function setLeaderChildRelationship(leaderUid: string, memberId: string, active: boolean): Promise<void> {
  const actor = actorUid();
  const id = relationshipId(leaderUid, memberId);
  const relationshipRef = doc(db, "leaderChildRelationships", id);
  const leaderRef = doc(db, "adminUsers", leaderUid);
  const memberRef = doc(db, "members", memberId);
  const auditRef = doc(collection(db, "auditLog"));

  await runTransaction(db, async (transaction) => {
    const [leaderSnapshot, memberSnapshot, currentSnapshot] = await Promise.all([
      transaction.get(leaderRef),
      transaction.get(memberRef),
      transaction.get(relationshipRef)
    ]);
    if (!leaderSnapshot.exists() || leaderSnapshot.data().active !== true || leaderSnapshot.data().role !== "leader") {
      throw new Error("Select an active leader account.");
    }
    if (!memberSnapshot.exists() || memberSnapshot.data().status !== "active") {
      throw new Error("Select an active youth member.");
    }
    if (currentSnapshot.exists() && currentSnapshot.data().active === active) return;

    transaction.set(relationshipRef, {
      leaderUid,
      memberId,
      active,
      createdBy: currentSnapshot.exists() ? currentSnapshot.data().createdBy : actor,
      createdAt: currentSnapshot.exists() ? currentSnapshot.data().createdAt : serverTimestamp(),
      updatedBy: actor,
      updatedAt: serverTimestamp()
    });
    transaction.set(auditRef, {
      category: "leader-access",
      action: active ? "leader-child-linked" : "leader-child-unlinked",
      actorUid: actor,
      targetId: id,
      targetLabel: memberSnapshot.data().displayName,
      description: active ? "Leader linked to child member." : "Leader unlinked from child member.",
      section: memberSnapshot.data().section,
      createdAt: serverTimestamp()
    });
  });
}
