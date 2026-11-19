import { watchEventDocuments } from "./eventDiscovery";
import { registerParentProgrammeAccess } from "./parentProgrammeAccess";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { loadParentAccount } from "./parentPortal";
/** Audience changes must clear an already-open programme, without waiting for a Rules re-evaluation. */
export function watchParentProgrammeDetail(id: string, next: (data: Record<string, unknown> | null) => void, failed: () => void) {
  let active = true; let generation = 0; let stopAudience = () => {}; let stopProgramme = () => {};
  void loadParentAccount(auth.currentUser?.uid || "").then(async parent => {
    if (!active) return;
    if (!parent || parent.status !== "approved" || !parent.memberIds.length) {next(null); return;}
    const children = await Promise.all(parent.memberIds.map(memberId => getDoc(doc(db, "members", memberId))));
    if (!active) return;
    const memberIds = children.filter(child => child.data()?.status === "active").map(child => child.id);
    if (!memberIds.length) {next(null); return;}
    stopAudience = watchEventDocuments("audienceMembers", [["eventId", "==", id], ["memberId", "in", memberIds]], documents => {
      if (!active) return;
      const current = ++generation; stopProgramme(); next(null);
      if (!documents.length) return;
      void registerParentProgrammeAccess(id, documents[0].data().memberId).then(() => {
        if (!active || generation !== current) return;
        stopProgramme = onSnapshot(doc(db, "events", id, "programmes", "parent"), {includeMetadataChanges: true}, programme => {
          if (active && generation === current && !programme.metadata.fromCache && !programme.metadata.hasPendingWrites) next(programme.data() || null);
        }, () => {if (active && generation === current) failed();});
      }).catch(() => {if (active && generation === current) failed();});
    }, () => {if (active) failed();});
  }).catch(() => {if (active) failed();});
  return () => {active = false; stopAudience(); stopProgramme();};
}
