import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { recordAuditEvent } from "./auditLog";
import { notifyEquipmentIncident } from "./emailNotifications";
import { recordEquipmentHistory } from "./equipmentHistory";
import type {
  EquipmentIncidentResolution,
  EquipmentIncidentStatus,
  EquipmentIncidentType,
  EquipmentNotificationState
} from "./equipmentIncidentLogic";
import {
  incidentRequiresUrgentNotification,
  incidentResolutionLabel,
  resolvedEquipmentQuantities,
  validateIncidentResolution
} from "./equipmentIncidentLogic";

export type EquipmentIncident = {
  id: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  itemLocation: string;
  quantity: number;
  type: EquipmentIncidentType;
  status: EquipmentIncidentStatus;
  section: string;
  loanId: string;
  description: string;
  reportedBy: string;
  reportedAt: Date | null;
  updatedBy: string;
  updatedAt: Date | null;
  notificationState: EquipmentNotificationState;
  notificationSentAt: Date | null;
  resolutionType: EquipmentIncidentResolution | "";
  resolutionNotes: string;
  resolvedBy: string;
  resolvedAt: Date | null;
};

export type ReportEquipmentIncidentRequest = {
  itemId: string;
  quantity: number;
  type: EquipmentIncidentType;
  section: string;
  loanId?: string;
  description: string;
};

function currentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to manage an equipment issue.");
  return uid;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function integer(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function mapIncident(id: string, data: Record<string, unknown>): EquipmentIncident | null {
  if (typeof data.itemId !== "string" || typeof data.itemName !== "string" || typeof data.section !== "string") return null;
  if (!Number.isInteger(data.quantity) || Number(data.quantity) <= 0) return null;
  if (!["damaged", "lost", "missing", "maintenance"].includes(String(data.type))) return null;
  if (!["reported", "investigating", "resolved"].includes(String(data.status))) return null;
  const notificationState = ["pending", "sent", "failed"].includes(String(data.notificationState))
    ? data.notificationState as EquipmentNotificationState
    : "pending";
  const resolutionType = ["found-returned", "repaired", "replaced", "written-off", "no-action"].includes(String(data.resolutionType))
    ? data.resolutionType as EquipmentIncidentResolution
    : "";
  return {
    id,
    itemId: data.itemId,
    itemName: data.itemName,
    itemCategory: text(data.itemCategory),
    itemLocation: text(data.itemLocation),
    quantity: Number(data.quantity),
    type: data.type as EquipmentIncidentType,
    status: data.status as EquipmentIncidentStatus,
    section: data.section,
    loanId: text(data.loanId),
    description: text(data.description),
    reportedBy: text(data.reportedBy),
    reportedAt: data.reportedAt instanceof Timestamp ? data.reportedAt.toDate() : null,
    updatedBy: text(data.updatedBy),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
    notificationState,
    notificationSentAt: data.notificationSentAt instanceof Timestamp ? data.notificationSentAt.toDate() : null,
    resolutionType,
    resolutionNotes: text(data.resolutionNotes),
    resolvedBy: text(data.resolvedBy),
    resolvedAt: data.resolvedAt instanceof Timestamp ? data.resolvedAt.toDate() : null
  };
}

export async function loadEquipmentIncidents(): Promise<EquipmentIncident[]> {
  const snapshot = await getDocs(collection(db, "equipmentIncidents"));
  return snapshot.docs
    .map((entry) => mapIncident(entry.id, entry.data()))
    .filter((entry): entry is EquipmentIncident => entry !== null)
    .sort((a, b) => (b.reportedAt?.getTime() ?? 0) - (a.reportedAt?.getTime() ?? 0));
}

export async function reportEquipmentIncident(request: ReportEquipmentIncidentRequest): Promise<string> {
  const uid = currentUid();
  const section = request.section.trim();
  const description = request.description.trim();
  const loanId = request.loanId?.trim() || "";
  if (!section) throw new Error("Choose the section connected to this issue.");
  if (!description) throw new Error("Describe what happened to the equipment.");
  if (!Number.isInteger(request.quantity) || request.quantity <= 0) throw new Error("Issue quantity must be a whole number greater than zero.");

  const incidentRef = doc(collection(db, "equipmentIncidents"));
  const itemRef = doc(db, "equipmentItems", request.itemId);
  let itemName = "Equipment";
  let itemLocation = "";

  await runTransaction(db, async (transaction) => {
    const itemSnapshot = await transaction.get(itemRef);
    if (!itemSnapshot.exists()) throw new Error("That equipment item no longer exists.");
    const itemData = itemSnapshot.data();
    itemName = text(itemData.name) || "Equipment";
    itemLocation = text(itemData.location);
    const totalQuantity = integer(itemData.totalQuantity);
    const checkedOutQuantity = integer(itemData.checkedOutQuantity);
    const unavailableQuantity = integer(itemData.unavailableQuantity);
    if (itemData.archived === true) throw new Error(`${itemName} is archived and cannot have a new issue reported.`);

    if (loanId) {
      const loanRef = doc(db, "equipmentLoans", loanId);
      const loanSnapshot = await transaction.get(loanRef);
      if (!loanSnapshot.exists()) throw new Error("That equipment checkout no longer exists.");
      const loanData = loanSnapshot.data();
      if (loanData.status !== "open" || text(loanData.section) !== section || !Array.isArray(loanData.lines)) {
        throw new Error("That checkout is not open for the selected section.");
      }

      const nextLines = loanData.lines.map((rawLine: unknown) => {
        if (!rawLine || typeof rawLine !== "object") return rawLine;
        const line = rawLine as Record<string, unknown>;
        if (line.itemId !== request.itemId) return rawLine;
        const quantity = integer(line.quantity);
        const returnedQuantity = integer(line.returnedQuantity);
        const incidentQuantity = integer(line.incidentQuantity);
        const outstanding = Math.max(0, quantity - returnedQuantity - incidentQuantity);
        if (request.quantity > outstanding) throw new Error(`Only ${outstanding} × ${itemName} remain on that checkout.`);
        return { ...line, incidentQuantity: incidentQuantity + request.quantity };
      });

      const matchingLine = loanData.lines.find((rawLine: unknown) => rawLine && typeof rawLine === "object" && (rawLine as Record<string, unknown>).itemId === request.itemId) as Record<string, unknown> | undefined;
      if (!matchingLine) throw new Error(`${itemName} is not part of that checkout.`);
      if (request.quantity > checkedOutQuantity) throw new Error(`The checked-out stock count for ${itemName} is inconsistent. Ask the Quartermaster to review it.`);

      const complete = nextLines.every((rawLine: unknown) => {
        if (!rawLine || typeof rawLine !== "object") return false;
        const line = rawLine as Record<string, unknown>;
        return integer(line.quantity) - integer(line.returnedQuantity) - integer(line.incidentQuantity) <= 0;
      });
      transaction.update(loanRef, {
        lines: nextLines,
        status: complete ? "returned" : "open",
        updatedBy: uid,
        updatedAt: serverTimestamp()
      });
      transaction.update(itemRef, {
        checkedOutQuantity: checkedOutQuantity - request.quantity,
        unavailableQuantity: unavailableQuantity + request.quantity,
        updatedBy: uid,
        updatedAt: serverTimestamp()
      });
    } else {
      const available = Math.max(0, totalQuantity - checkedOutQuantity - unavailableQuantity);
      if (request.quantity > available) throw new Error(`Only ${available} × ${itemName} are currently available to report from the store.`);
      transaction.update(itemRef, {
        unavailableQuantity: unavailableQuantity + request.quantity,
        updatedBy: uid,
        updatedAt: serverTimestamp()
      });
    }

    transaction.set(incidentRef, {
      itemId: request.itemId,
      itemName,
      itemCategory: text(itemData.category),
      itemLocation,
      quantity: request.quantity,
      type: request.type,
      status: "reported",
      section,
      loanId,
      description,
      reportedBy: uid,
      reportedAt: serverTimestamp(),
      updatedBy: uid,
      updatedAt: serverTimestamp(),
      notificationState: incidentRequiresUrgentNotification(request.type) ? "pending" : "sent",
      notificationSentAt: incidentRequiresUrgentNotification(request.type) ? null : serverTimestamp(),
      resolutionType: "",
      resolutionNotes: "",
      resolvedBy: "",
      resolvedAt: null
    });
  });

  await recordEquipmentHistory({
    itemId: request.itemId,
    itemName,
    type: "incident-reported",
    quantity: request.quantity,
    section,
    fromLocation: loanId ? section : itemLocation,
    toLocation: "Unavailable",
    details: `Reported ${request.quantity} × ${itemName} as ${request.type} for ${section}: ${description}`,
    sourceId: incidentRef.id,
    linkedItemId: ""
  });
  await recordAuditEvent({
    category: "equipment",
    action: `incident-${request.type}`,
    targetId: incidentRef.id,
    targetLabel: itemName,
    description: `Reported ${request.quantity} × ${itemName} as ${request.type} for ${section}.`,
    section
  });

  return incidentRef.id;
}

export async function startEquipmentIncidentInvestigation(incident: EquipmentIncident): Promise<void> {
  const uid = currentUid();
  if (incident.status !== "reported") throw new Error("Only newly reported equipment issues can be moved to investigating.");
  await updateDoc(doc(db, "equipmentIncidents", incident.id), {
    status: "investigating",
    updatedBy: uid,
    updatedAt: serverTimestamp()
  });
  await recordEquipmentHistory({
    itemId: incident.itemId,
    itemName: incident.itemName,
    type: "incident-investigating",
    quantity: incident.quantity,
    section: incident.section,
    fromLocation: incident.itemLocation,
    toLocation: "Unavailable",
    details: `Started investigating ${incident.quantity} × ${incident.itemName} for ${incident.section}.`,
    sourceId: incident.id,
    linkedItemId: ""
  });
  await recordAuditEvent({
    category: "equipment",
    action: "incident-investigating",
    targetId: incident.id,
    targetLabel: incident.itemName,
    description: `Started investigating ${incident.quantity} × ${incident.itemName} for ${incident.section}.`,
    section: incident.section
  });
}

export async function resolveEquipmentIncident(
  incident: EquipmentIncident,
  resolution: EquipmentIncidentResolution,
  notes: string
): Promise<void> {
  const uid = currentUid();
  const safeNotes = notes.trim();
  const validation = validateIncidentResolution(resolution, safeNotes);
  if (validation) throw new Error(validation);
  if (incident.status === "resolved") throw new Error("This equipment issue has already been resolved.");

  const incidentRef = doc(db, "equipmentIncidents", incident.id);
  const itemRef = doc(db, "equipmentItems", incident.itemId);
  await runTransaction(db, async (transaction) => {
    const [incidentSnapshot, itemSnapshot] = await Promise.all([
      transaction.get(incidentRef),
      transaction.get(itemRef)
    ]);
    if (!incidentSnapshot.exists()) throw new Error("That equipment issue no longer exists.");
    if (!itemSnapshot.exists()) throw new Error("The linked equipment item no longer exists.");
    const incidentData = incidentSnapshot.data();
    if (incidentData.status === "resolved") throw new Error("This equipment issue has already been resolved.");
    const quantity = integer(incidentData.quantity);
    const itemData = itemSnapshot.data();
    const next = resolvedEquipmentQuantities({
      totalQuantity: integer(itemData.totalQuantity),
      checkedOutQuantity: integer(itemData.checkedOutQuantity),
      unavailableQuantity: integer(itemData.unavailableQuantity)
    }, quantity, resolution);

    transaction.update(itemRef, {
      totalQuantity: next.totalQuantity,
      unavailableQuantity: next.unavailableQuantity,
      updatedBy: uid,
      updatedAt: serverTimestamp()
    });
    transaction.update(incidentRef, {
      status: "resolved",
      resolutionType: resolution,
      resolutionNotes: safeNotes,
      resolvedBy: uid,
      resolvedAt: serverTimestamp(),
      updatedBy: uid,
      updatedAt: serverTimestamp()
    });
  });

  await recordEquipmentHistory({
    itemId: incident.itemId,
    itemName: incident.itemName,
    type: "incident-resolved",
    quantity: incident.quantity,
    section: incident.section,
    fromLocation: "Unavailable",
    toLocation: resolution === "written-off" ? "Written off" : incident.itemLocation,
    details: `Resolved ${incident.quantity} × ${incident.itemName} as ${incidentResolutionLabel(resolution)} for ${incident.section}${safeNotes ? `: ${safeNotes}` : "."}`,
    sourceId: incident.id,
    linkedItemId: ""
  });
  await recordAuditEvent({
    category: "equipment",
    action: `incident-resolved-${resolution}`,
    targetId: incident.id,
    targetLabel: incident.itemName,
    description: `Resolved ${incident.quantity} × ${incident.itemName} as ${incidentResolutionLabel(resolution)} for ${incident.section}${safeNotes ? `: ${safeNotes}` : "."}`,
    section: incident.section
  });
}

export async function sendEquipmentIncidentNotification(incidentId: string): Promise<void> {
  try {
    await notifyEquipmentIncident(incidentId);
    await updateDoc(doc(db, "equipmentIncidents", incidentId), {
      notificationState: "sent",
      notificationSentAt: serverTimestamp()
    });
  } catch (error) {
    try {
      await updateDoc(doc(db, "equipmentIncidents", incidentId), { notificationState: "failed" });
    } catch (markerError) {
      console.error("Unable to mark equipment incident notification failure:", markerError);
    }
    throw error;
  }
}
