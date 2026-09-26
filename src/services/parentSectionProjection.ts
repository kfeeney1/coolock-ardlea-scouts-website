import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";

import { db } from "../firebase";

const CURRENT_PARENT_SECTIONS = new Set(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]);

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export async function syncParentSectionProjectionsForMembers(memberIds: readonly string[]): Promise<void> {
  const uniqueMemberIds = [...new Set(memberIds.map((memberId) => memberId.trim()).filter(Boolean))];
  if (uniqueMemberIds.length === 0) return;

  const parentSnapshots = await Promise.all(
    uniqueMemberIds.map((memberId) => getDocs(query(collection(db, "parentAccounts"), where("memberIds", "array-contains", memberId))))
  );
  const parents = [...new Map(parentSnapshots.flatMap((snapshot) => snapshot.docs).map((parent) => [parent.id, parent])).values()];

  await Promise.all(parents.map(async (parent) => {
    const linkedMemberIds = stringArray(parent.data().memberIds);
    const memberSnapshots = await Promise.all(linkedMemberIds.map((memberId) => getDocs(query(collection(db, "members"), where("__name__", "==", memberId)))));
    const linkedSections = [...new Set(memberSnapshots.flatMap((snapshot) => snapshot.docs.flatMap((member) => {
      const data = member.data();
      const section = typeof data.section === "string" ? data.section.trim() : "";
      return data.status === "active" && CURRENT_PARENT_SECTIONS.has(section) ? [section] : [];
    })))].sort();

    await updateDoc(doc(db, "parentAccounts", parent.id), {
      linkedSections,
      updatedAt: serverTimestamp()
    });
  }));
}
