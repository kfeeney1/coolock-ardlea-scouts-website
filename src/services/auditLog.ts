import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export type AuditCategory = "parent-access" | "leader-request" | "leader-access" | "member" | "event" | "event-consent" | "equipment" | "finance" | "system";

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
const AUDIT_CATEGORIES = ["parent-access", "leader-request", "leader-access", "member", "event", "event-consent", "equipment", "finance", "system"] as const;

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
    console.error("Unable to record audit event:", error);
  }
}

export async function loadAuditLog(maxEntries = 100): Promise<AuditLogEntry[]> {
  const snapshot = await getDocs(query(collection(db, "auditLog"), orderBy("createdAt", "desc"), limit(maxEntries)));
  return snapshot.docs.flatMap((item) => {
    const data = item.data();
    const category = data.category as AuditCategory;
    if (!AUDIT_CATEGORIES.includes(category)) return [];
    const required = ["action", "actorUid", "actorEmail", "targetId", "targetLabel", "description", "section"] as const;
    if (required.some((key) => typeof data[key] !== "string")) return [];
    return [{
      id: item.id,
      category,
      action: data.action,
      actorUid: data.actorUid,
      actorEmail: data.actorEmail,
      targetId: data.targetId,
      targetLabel: data.targetLabel,
      description: data.description,
      section: data.section,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null
    }];
  });
}
