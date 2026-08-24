import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const marker = { testData: true, testSeed: "weekly-meetings-v2", createdBySeed: "TEST_SEED" };
const sections = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];

async function roster(section) {
  const snapshot = await db.collection("members").where("section", "==", section).where("status", "==", "active").limit(4).get();
  return snapshot.docs.map((item, index) => ({
    memberId: item.id,
    memberName: item.data().displayName,
    attendance: index === 3 ? "absent" : "present",
    subsPaid: false,
    subsAmount: 0,
    badges: index === 0 ? ["TEST Skills Badge"] : []
  }));
}

async function replace(id, data) {
  await db.collection("weeklyMeetings").doc(id).set({
    ...data,
    ...marker,
    createdBy: "TEST_SEED",
    createdAt: FieldValue.serverTimestamp(),
    updatedBy: "TEST_SEED",
    updatedAt: FieldValue.serverTimestamp()
  });
}

for (const section of sections) {
  const entries = await roster(section);
  const key = section.toLowerCase();
  await replace(`TEST_weekly_${key}_closed`, {
    section,
    meetingDate: "2026-08-17",
    location: "Scout Den",
    status: "closed",
    plannedActivities: ["TEST Warm-up game", "TEST Team challenge"],
    plannedBadgework: ["TEST Skills Badge"],
    medicalIssues: [],
    notes: "TEST closed weekly meeting.",
    entries
  });
  await replace(`TEST_weekly_${key}_planned`, {
    section,
    meetingDate: "2099-01-15",
    location: section === "Scouts" ? "TEST Alternate Hall" : "Scout Den",
    status: "planned",
    plannedActivities: ["TEST Future game"],
    plannedBadgework: ["TEST Future Badge"],
    medicalIssues: [],
    notes: "",
    entries: entries.map((entry) => ({ ...entry, attendance: "unrecorded", badges: [] }))
  });
}

console.log("Canonical weekly meeting lifecycle fixtures seeded.");
