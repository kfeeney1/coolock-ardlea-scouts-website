import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export type AuditCategory = "parent-access" | "leader-request" | "leader-access" | "member" | "event" | "event-consent" | "system";

export type AuditLogEntry = {
  id: string;
  category: AuditCategory;
  action: string;
  actorUid: string;
  actorEmail: string;
  targetId: string;
  targetLabel: string;
  description: string;
  section: string;
  createdAt: Date | null;
};

type AuditWrite = Omit<AuditLogEntry, "id" | "actorUid" | "actorEmail" | "createdAt">;

export async function recordAuditEvent(event: AuditWrite) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(db, "auditLog"), {
      ...event,
      actorUid: user.uid,
      actorEmail: user.email || "",
      createdAt: serverTimestamp()
    });
  } catch (error) {
    // Audit logging must never make the business action appear to fail after it succeeded.
    console.error("Unable to record audit event:", error);
  }
}

export async function loadAuditLog(maxEntries = 100): Promise<AuditLogEntry[]> {
  const snapshot = await getDocs(query(collection(db, "auditLog"), orderBy("createdAt", "desc"), limit(maxEntries)));
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      category: (data.category || "system") as AuditCategory,
      action: data.action || "",
      actorUid: data.actorUid || "",
      actorEmail: data.actorEmail || "",
      targetId: data.targetId || "",
      targetLabel: data.targetLabel || "",
      description: data.description || "",
      section: data.section || "",
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null
    };
  });
}
