import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

const roles = new Set(["group leader", "deputy group leader", "deputy-group-leader", "deputy grouplead", "dgl",
  "group quartermaster", "group quartermaster/bo'sun", "group quartermaster / bo'sun", "group bo'sun"]);
const labelKey = value => typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
const canonicalDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const dateAllows = (value, today, end) => value === "" || (canonicalDate(value) && (end ? value >= today : value <= today));

export function equipmentManager(profile, organisation, today) {
  if (profile?.active !== true || !Array.isArray(profile.sections) || !profile.sections.length || Object.hasOwn(profile, "section")) return false;
  if (["admin", "super-admin"].includes(profile.role)) return true;
  if (profile.role !== "leader" || organisation?.active !== true) return false;
  const appointments = Object.hasOwn(organisation, "appointments") ? organisation.appointments : [];
  if (!Array.isArray(appointments) || appointments.length > 12) return false;
  if (!appointments.length) return roles.has(organisation.scoutingRole?.toLowerCase?.());
  return appointments.some(item => item && typeof item === "object" && !Array.isArray(item)
    && (!Object.hasOwn(item, "scope") || item.scope === "Group")
    && (!Object.hasOwn(item, "active") || item.active === true)
    && roles.has(item.appointment?.toLowerCase?.())
    && dateAllows(Object.hasOwn(item, "startDate") ? item.startDate : "", today, false)
    && dateAllows(Object.hasOwn(item, "endDate") ? item.endDate : "", today, true));
}

export async function mutateEquipmentOption(db, uid, data) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to manage equipment options.");
  const { kind, id, expectedName, action, name } = data ?? {};
  const nextName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!["categories", "locations"].includes(kind) || typeof id !== "string" || !/^[^/]{1,128}$/.test(id)
    || id === "." || id === ".." || typeof expectedName !== "string" || !labelKey(expectedName)
    || !["rename", "delete"].includes(action) || (action === "rename" && (!nextName || nextName.length > 120))) {
    throw new HttpsError("invalid-argument", "Choose a valid equipment option and action.");
  }
  const category = kind === "categories";
  const field = category ? "category" : "location";
  const catalogue = db.collection(category ? "equipmentCategories" : "equipmentLocations");
  const option = catalogue.doc(id);
  const retired = db.doc(`equipmentOptionRetirements/${kind}`);
  const previousKey = labelKey(expectedName);
  const nextKey = labelKey(nextName);
  const stamp = FieldValue.serverTimestamp();

  return db.runTransaction(async tx => {
    const [profile, organisation] = await tx.getAll(db.doc(`adminUsers/${uid}`), db.doc(`organisationLeadership/${uid}`));
    if (!equipmentManager(profile.data(), organisation.data(), new Date().toISOString().slice(0, 10))) {
      throw new HttpsError("permission-denied", "You cannot manage equipment options.");
    }
    const [current, blocked] = await tx.getAll(option, retired);
    if (current.get("name") !== expectedName) throw new HttpsError("failed-precondition", "This option changed. Reload the equipment catalogue.");
    const names = blocked.get("names") ?? {};
    if (action === "rename" && Object.hasOwn(names, `label:${nextKey}`)) throw new HttpsError("failed-precondition", "That name is reserved by a retired option.");
    const options = await tx.get(catalogue.limit(1001));
    if (options.size > 1000) throw new HttpsError("failed-precondition", "The catalogue is too large for this operation.");
    if (options.docs.some(entry => entry.id !== id && [previousKey, nextKey].includes(labelKey(entry.get("name"))))) {
      throw new HttpsError("failed-precondition", "Resolve duplicate equipment option names before continuing.");
    }
    // Cap the inventory read and fail closed when it cannot be checked in one transaction.
    const inventory = await tx.get(db.collection("equipmentItems").limit(1001));
    if (inventory.size > 1000) throw new HttpsError("failed-precondition", "The inventory is too large for this operation.");
    const affected = inventory.docs.filter(item => labelKey(item.get(field)) === previousKey);
    if (action === "delete" && affected.length) throw new HttpsError("failed-precondition", "Equipment still uses this option.");
    if (action === "rename" && nextKey !== previousKey && inventory.docs.some(item => labelKey(item.get(field)) === nextKey)) {
      throw new HttpsError("already-exists", "Equipment already uses the new name.");
    }
    if (affected.length > 248) throw new HttpsError("failed-precondition", "Too many equipment records use this option for a single rename.");
    if (action === "delete" || previousKey !== nextKey) tx.set(retired, { names: { ...names, [`label:${previousKey}`]: true } });
    if (action === "delete") {
      tx.delete(option);
      return { changed: 0 };
    }
    tx.update(option, { name: nextName, updatedBy: uid, updatedAt: stamp });
    for (const item of affected) {
      tx.update(item.ref, { [field]: nextName, updatedBy: uid, updatedAt: stamp });
      tx.create(db.collection("equipmentHistory").doc(), {
        itemId: item.id, itemName: item.get("name"), type: "item-updated", quantity: item.get("totalQuantity"),
        section: "Group", fromLocation: item.get("location"), toLocation: category ? item.get("location") : nextName,
        details: `${category ? "Category" : "Store"} renamed from ${expectedName} to ${nextName}. Equipment assignment preserved.`,
        sourceId: id, linkedItemId: "", createdBy: uid, createdAt: stamp
      });
    }
    return { changed: affected.length };
  });
}
