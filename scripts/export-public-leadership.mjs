import { mkdir, writeFile } from "node:fs/promises";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const snapshot = await db.collection("organisationLeadership").get();
const leaders = snapshot.docs
  .map((item) => ({ uid: item.id, ...item.data() }))
  .filter((leader) => leader.active !== false && leader.showPublicly === true)
  .map((leader) => ({
    uid: leader.uid,
    displayName: typeof leader.displayName === "string" ? leader.displayName.trim() : "Leader",
    scoutingRole: typeof leader.scoutingRole === "string" ? leader.scoutingRole.trim() : "Leader",
    organisationSection: typeof leader.organisationSection === "string" ? leader.organisationSection.trim() : "Group",
    organisationOrder: typeof leader.organisationOrder === "number" ? leader.organisationOrder : 999,
    reportsToUid: typeof leader.reportsToUid === "string" ? leader.reportsToUid.trim() : "",
    showPublicly: true,
    active: true
  }))
  .sort((a, b) => a.organisationOrder - b.organisationOrder || a.displayName.localeCompare(b.displayName));

await mkdir("public", { recursive: true });
await writeFile("public/public-leadership.json", `${JSON.stringify(leaders, null, 2)}\n`, "utf8");
console.log(`Exported ${leaders.length} public organisation leader(s) to public/public-leadership.json.`);
