import { cert, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore } from "firebase-admin/firestore";
import { requireFirebaseMutationTarget } from "./firebase-operation-guard.mjs";

const credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const target = requireFirebaseMutationTarget({
  operation: "backfill-unlinked-youth-consent",
  credentialJson,
  allowProduction: true
});
const db = getFirestore(initializeApp({
  projectId: target.projectId,
  credential: cert(JSON.parse(credentialJson))
}));

// An explicit empty ID makes unlinked submissions queryable without giving
// leaders a section-wide read grant over linked consent.
const youth = db.collection("consentApplications")
  .where("formType", "==", "youth-activity-consent")
  .orderBy(FieldPath.documentId());
let cursor;
let updated = 0;
while (true) {
  const page = await (cursor ? youth.startAfter(cursor) : youth).select("memberId").limit(200).get();
  if (page.empty) break;
  for (const item of page.docs) {
    if (item.get("memberId") != null) continue;
    // A concurrent reconciliation must win over this compatibility write.
    try {
      await item.ref.update({ memberId: "" }, { lastUpdateTime: item.updateTime });
      updated++;
    } catch (error) {
      if (error.code !== 9) throw error;
      const current = await item.ref.get();
      if (current.exists && current.get("memberId") == null) throw error;
    }
  }
  cursor = page.docs.at(-1).id;
}
console.log(`Unlinked youth consent query compatibility updated ${updated} record(s).`);
