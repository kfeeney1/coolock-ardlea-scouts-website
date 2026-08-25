import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const checkOnly = process.argv.includes("--check");

const VALID_SECTIONS = new Set(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Scouter", "All Sections"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isCanonicalSections(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "string" && VALID_SECTIONS.has(item.trim()));
}

const snapshot = await db.collection("adminUsers").get();
const migrations = [];
const unresolved = [];

for (const doc of snapshot.docs) {
  const data = doc.data();
  if (data.active !== true) continue;

  const hasCanonicalSections = isCanonicalSections(data.sections);
  const legacySection = text(data.section);
  const hasLegacySection = data.section !== undefined;

  if (hasCanonicalSections && !hasLegacySection) continue;

  if (hasCanonicalSections && hasLegacySection) {
    migrations.push({ id: doc.id, action: "remove-legacy-section" });
    if (!checkOnly) {
      await doc.ref.update({ section: FieldValue.delete() });
    }
    continue;
  }

  if (!hasCanonicalSections && VALID_SECTIONS.has(legacySection)) {
    migrations.push({ id: doc.id, action: `promote-${legacySection}` });
    if (!checkOnly) {
      await doc.ref.update({
        sections: [legacySection],
        section: FieldValue.delete()
      });
    }
    continue;
  }

  unresolved.push(doc.id);
}

for (const item of migrations) {
  console.log(`${checkOnly ? "Would migrate" : "Migrated"} adminUsers/${item.id}: ${item.action}`);
}

if (unresolved.length) {
  throw new Error(`Active adminUsers profiles cannot be reconciled without guessing: ${unresolved.join(", ")}`);
}

console.log(`${checkOnly ? "Admin user section reconciliation check" : "Admin user section reconciliation"} complete: ${migrations.length} safe migration(s), ${unresolved.length} unresolved.`);
