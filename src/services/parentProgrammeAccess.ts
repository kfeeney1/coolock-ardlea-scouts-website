import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
/** A reference to one of this parent's audience children, revalidated by Rules on every programme read. */
export async function registerParentProgrammeAccess(eventId: string, memberId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign-in is required.");
  const target = doc(db, "events", eventId, "programmeAccess", uid);
  const previous = await getDoc(target);
  if (previous.data()?.memberId !== memberId) await setDoc(target, {memberId});
}
