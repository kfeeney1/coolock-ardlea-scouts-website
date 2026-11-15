/**
 * SW-595: read-only lookup of the six owner-approved production test events.
 * Never writes, deletes, or exports personal/member data.
 * Usage: FIREBASE_SERVICE_ACCOUNT_JSON='<JSON>' node scripts/lookup-six-test-events.mjs
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PRODUCTION_PROJECT = "coolock-ardlea-scouts";
const TARGETS = [
  { title: "Cub County weekend", start: "2026-09-18", end: "2026-09-20" },
  { title: "Test", start: "2026-09-22", end: "2026-09-23" },
  { title: "Test", start: "2026-10-02", end: "2026-10-02" },
  { title: "Test123", start: "2026-10-10", end: "2026-10-10" },
  { title: "Twst12", start: "2026-10-15", end: "2026-10-15" },
  { title: "Event123", start: "2056-10-12", end: "2056-10-12" },
];

function dateKey(value) {
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  }
  return null;
}

export function matchApprovedEvent(data) {
  const title = typeof data?.title === "string" ? data.title.trim() : "";
  const start = dateKey(data?.startDate);
  const end = dateKey(data?.endDate) ?? start;
  return TARGETS.findIndex(t => t.title === title && t.start === start && t.end === end);
}

async function main() {
  if (process.env.APPLY === "true" || process.argv.includes("--apply")) {
    throw new Error("This lookup is READ ONLY. No apply mode exists.");
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON to authorised production service account JSON.");
  const credentials = JSON.parse(raw);
  if (credentials.project_id !== PRODUCTION_PROJECT) {
    throw new Error(`Refusing credentials for ${credentials.project_id ?? "<unknown>"}; expected ${PRODUCTION_PROJECT}.`);
  }
  const app = initializeApp({ credential: cert(credentials), projectId: PRODUCTION_PROJECT });
  const db = getFirestore(app);
  const results = TARGETS.map(() => []);
  // Only fetch events with one of the four distinct titles, never the member collections.
  for (const title of [...new Set(TARGETS.map(t => t.title))]) {
    const snapshot = await db.collection("events").where("title", "==", title).get();
    for (const doc of snapshot.docs) {
      const index = matchApprovedEvent(doc.data());
      if (index >= 0) results[index].push(doc.id);
    }
  }
  console.log("READ-ONLY SW-595 production event lookup (no writes performed)");
  for (let i = 0; i < TARGETS.length; i++) {
    const t = TARGETS[i];
    const ids = results[i];
    console.log(`${i + 1}. ${t.title} | ${t.start} to ${t.end} | ${ids.length === 1 ? `events/${ids[0]}` : ids.length === 0 ? "NOT FOUND" : `AMBIGUOUS: ${ids.length} matches (${ids.join(", ")})`}`);
  }
  if (results.some(ids => ids.length !== 1) || new Set(results.flat()).size !== 6) {
    console.error("INCOMPLETE/AMBIGUOUS: do not proceed with any purge until all six are uniquely identified.");
    process.exitCode = 1;
  } else {
    console.log("Six unique event IDs identified. NO RECORDS WERE CHANGED. Inspect dependencies before any deletion.");
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
