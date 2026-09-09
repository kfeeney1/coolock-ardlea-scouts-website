import { createHash } from "node:crypto";

const text = (value) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
const key = (value) => text(value).toLocaleLowerCase("en-IE");

export function equipmentImportId(batch, sourceRef) {
  return `equipment-import-${createHash("sha256").update(`${batch}:${sourceRef}`).digest("hex").slice(0, 24)}`;
}

export function validateEquipmentImportRecord(record) {
  const errors = [];
  if (!text(record.name)) errors.push("missing-name");
  if (!Number.isInteger(record.totalQuantity) || record.totalQuantity < 0) errors.push("invalid-quantity");
  if (!text(record.category)) errors.push("missing-category");
  if (!text(record.location)) errors.push("missing-location");
  if (record.trackingMode !== "quantity" && record.trackingMode !== "individual") errors.push("invalid-tracking-mode");
  if (!["not-recorded", "good", "needs-attention", "repair", "missing", "lost", "retired"].includes(record.condition)) errors.push("invalid-condition");
  if (record.replacementValue !== null && (typeof record.replacementValue !== "number" || record.replacementValue < 0)) errors.push("invalid-replacement-value");
  return errors;
}

export function planEquipmentImport(manifest, existing) {
  const creates = [], matches = [], conflicts = [], rejected = [];
  const byId = new Map(existing.map((item) => [item.id, item]));
  const byName = new Map(existing.map((item) => [key(item.name), item]));
  for (const source of manifest.records || []) {
    const errors = validateEquipmentImportRecord(source);
    if (errors.length) { rejected.push({ sourceRef: source.importSourceRef, reasons: errors }); continue; }
    const item = { ...source, id: equipmentImportId(manifest.batch, source.importSourceRef) };
    const current = byId.get(item.id);
    if (current) {
      const comparable = ["name", "category", "trackingMode", "totalQuantity", "location", "condition", "replacementValue", "purchaseDate", "disposalDate", "replacementValueNote", "assetRegisterSection", "source", "importBatch", "importSourceRef"];
      if (comparable.every((field) => (current[field] ?? "") === (item[field] ?? ""))) matches.push(item.id);
      else conflicts.push({ sourceRef: item.importSourceRef, reason: "id-content-conflict" });
      continue;
    }
    if (byName.has(key(item.name))) { conflicts.push({ sourceRef: item.importSourceRef, reason: "name-conflict" }); continue; }
    creates.push(item);
  }
  return { creates, matches, conflicts, rejected };
}
