import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { planEquipmentImport } from "./equipment-import-core.mjs";

const execute=process.argv.includes("--execute"), rollback=process.argv.includes("--rollback");
const manifestArg=process.argv.find((arg)=>arg.startsWith("--manifest="));
if (!manifestArg || (execute && rollback)) throw new Error("Usage: node scripts/import-equipment.mjs --manifest=/reviewed/equipment.json [--execute|--rollback]");
const credentials=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "null");
if (!credentials?.project_id) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON with project_id is required for comparison and mutation.");
const { cert, initializeApp }=await import("firebase-admin/app"); const { FieldValue, getFirestore }=await import("firebase-admin/firestore");
initializeApp({credential:cert(credentials)}); const db=getFirestore();
const manifest=JSON.parse(await readFile(manifestArg.slice(11),"utf8"));
if (manifest.version!==1 || !Array.isArray(manifest.records) || (manifest.preparationRejected||[]).length) throw new Error("Manifest is invalid or contains unresolved rejected source rows.");
const snapshot=await db.collection("equipmentItems").get(); const existing=snapshot.docs.map((doc)=>({id:doc.id,...doc.data()}));
const plan=planEquipmentImport(manifest,existing); const review={batch:manifest.batch,creates:plan.creates.map(({id,importSourceRef})=>({id,importSourceRef})),matches:plan.matches,conflicts:plan.conflicts,rejected:plan.rejected};
const digest=createHash("sha256").update(JSON.stringify(review)).digest("hex");
console.log(JSON.stringify({mode:rollback?"rollback":execute?"execute":"dry-run",projectId:credentials.project_id,creates:plan.creates.length,matches:plan.matches.length,conflicts:plan.conflicts.length,rejected:plan.rejected.length,manifestSha256:digest},null,2));
if (!execute && !rollback) process.exit(0);
if (plan.conflicts.length || plan.rejected.length) throw new Error("Refusing mutation while conflicts or rejected rows remain.");
if (process.env.PROD_EQUIPMENT_IMPORT_CONFIRM_PROJECT!==credentials.project_id || Number(process.env.PROD_EQUIPMENT_IMPORT_EXPECTED_CREATE_COUNT)!==plan.creates.length || process.env.PROD_EQUIPMENT_IMPORT_EXPECTED_MANIFEST_SHA256!==digest) throw new Error("Reviewed project, create count or manifest digest does not match.");
const backupUri=process.env.PROD_EQUIPMENT_IMPORT_BACKUP_URI, backupVerifiedAt=process.env.PROD_EQUIPMENT_IMPORT_BACKUP_VERIFIED_AT;
const backupAge=Date.now()-Date.parse(backupVerifiedAt || "");
if (!backupUri?.startsWith("gs://") || !backupUri.includes("firestore-backups") || !Number.isFinite(backupAge) || backupAge < 0 || backupAge > 192*60*60*1000) throw new Error("A reviewed Firestore backup URI verified within 192 hours is required.");
if (rollback) {
  let removed=0;
  for (const item of plan.creates) { const ref=db.collection("equipmentItems").doc(item.id); const current=await ref.get(); if (!current.exists) continue; const data=current.data(); if (data.source!=="spreadsheet-import" || data.importBatch!==manifest.batch || data.importSourceRef!==item.importSourceRef) throw new Error(`Rollback provenance mismatch for ${item.id}.`); await ref.delete(); removed++; }
  console.log(`Rollback complete: ${removed} imported equipment records removed.`); process.exit(0);
}
const optionId=(kind,value)=>`equipment-import-${kind}-${createHash("sha256").update(value.toLocaleLowerCase("en-IE")).digest("hex").slice(0,20)}`;
for (const [collectionName,kind,values] of [
  ["equipmentCategories","category",new Set(plan.creates.map((item)=>item.category))],
  ["equipmentLocations","location",new Set(plan.creates.map((item)=>item.location))]
]) for (const name of values) await db.collection(collectionName).doc(optionId(kind,name)).set({name,createdBy:"CONTROLLED_EQUIPMENT_IMPORT",createdAt:FieldValue.serverTimestamp()},{merge:true});
for (const item of plan.creates) { const {id,...data}=item; await db.collection("equipmentItems").doc(id).create({...data,checkedOutQuantity:0,unavailableQuantity:0,archived:false,createdBy:"CONTROLLED_EQUIPMENT_IMPORT",createdAt:FieldValue.serverTimestamp(),updatedBy:"CONTROLLED_EQUIPMENT_IMPORT",updatedAt:FieldValue.serverTimestamp()}); }
console.log(`Import complete: ${plan.creates.length} created; ${plan.matches.length} unchanged.`);
