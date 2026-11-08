import { collection, doc, getDocsFromServer, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import { UserFacingError } from "./applicationErrors.ts";
import { equipmentLabelKey } from "./equipmentLogic.ts";

export async function renameEquipmentOption(
  db: Firestore,
  uid: string,
  kind: "categories" | "locations",
  option: { id: string; name: string },
  name: string
): Promise<number> {
  const category = kind === "categories";
  const field = category ? "category" : "location";
  const label = category ? "Category" : "Store";
  const optionRef = doc(db, category ? "equipmentCategories" : "equipmentLocations", option.id);
  const history = collection(db, "equipmentHistory");
  const previousKey = equipmentLabelKey(option.name);
  const inventory = await getDocsFromServer(collection(db, "equipmentItems"));
  const affected = inventory.docs.filter(item => {
    const value = item.get(field);
    return typeof value === "string" && equipmentLabelKey(value) === previousKey;
  });

  return runTransaction(db, async transaction => {
    const current = await transaction.get(optionRef);
    if (current.get("name") !== option.name) {
      throw new UserFacingError("This option changed. Reload the equipment catalogue before renaming it.");
    }
    const items = await Promise.all(affected.map(item => transaction.get(item.ref)));
    const changed = items.filter(item => {
      const value = item.get(field);
      return typeof value === "string" && equipmentLabelKey(value) === previousKey;
    });
    const updatedAt = serverTimestamp();
    transaction.update(optionRef, { name, updatedBy: uid, updatedAt });
    for (const item of changed) {
      transaction.update(item.ref, { [field]: name, updatedBy: uid, updatedAt });
      transaction.set(doc(history), {
        itemId: item.id,
        itemName: item.get("name"),
        type: "item-updated",
        quantity: item.get("totalQuantity"),
        section: "Group",
        fromLocation: item.get("location"),
        toLocation: category ? item.get("location") : name,
        details: `${label} renamed from ${option.name} to ${name}. Equipment assignment preserved.`,
        sourceId: option.id,
        linkedItemId: "",
        createdBy: uid,
        createdAt: updatedAt
      });
    }
    return changed.length;
  });
}
