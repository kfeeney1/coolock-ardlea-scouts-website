import { collection, doc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";

/** A reference to canonical data, never a cached grant; rules revalidate the source. */
export async function checkMaintenanceMembership() {
  return registerGroupMembership("maintenance");
}
/** References carry no grant: Security Rules revalidate the canonical source. */
export async function registerGroupMembership(capability: "maintenance" | "calendar") {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const ref = doc(db, `${capability}/group/access`, uid);
  const register = async (kind: string, sourceId: string) => {
    try { await setDoc(ref, {kind, sourceId}); return true; }
    catch (error) {
      if ((error as {code?: string}).code === "permission-denied") return false;
      throw error;
    }
  };
  if (await register("leader", uid) || await register("parent", uid)) return true;
  const linked = await getDocs(query(collection(db, "members"), where("accountUid", "==", uid), where("status", "==", "active"), limit(1)));
  return linked.empty ? false : register("member", linked.docs[0].id);
}
