import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "firebase/firestore";

import { ServiceFailure } from "./applicationErrors.ts";
import { auth, db } from "../firebase";
import { memberSectionStorageAliases } from "./memberSectionCore.mjs";
import { mapMemberConsentSummary, type MemberConsentSummary } from "./memberConsentSummaryLogic";

export type { MemberConsentSummary } from "./memberConsentSummaryLogic";

type MemberConsentScope = { id: string; sections: string[] };

export async function loadMemberConsentSummaries(member: MemberConsentScope): Promise<MemberConsentSummary[]> {
  if (!member.sections.length) return [];

  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");
  const profileSnapshot = await getDoc(doc(db, "adminUsers", user.uid));
  const isAdmin = profileSnapshot.exists() && ["admin", "super-admin"].includes(String(profileSnapshot.data().role));
  const snapshots = isAdmin
    ? [await getDocs(collection(db, "consentApplications"))]
    : await Promise.all([
        getDocs(query(collection(db, "consentApplications"), where("memberId", "==", member.id))),
        ...member.sections.flatMap((section) => memberSectionStorageAliases(section)).map((section) =>
          getDocs(query(collection(db, "consentApplications"), where("section", "==", section)))
        )
      ]);
  const documents = [...new Map(snapshots.flatMap((snapshot) => snapshot.docs).map((item) => [item.id, item])).values()];

  return documents.flatMap((item) => {
    const summary = mapMemberConsentSummary(item.id, item.data(), member.id);
    return summary ? [summary] : [];
  }).sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
}
