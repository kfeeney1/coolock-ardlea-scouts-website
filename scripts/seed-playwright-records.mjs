import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const marker = {
  testData: true,
  testSeed: "playwright-audit-hardening",
  createdBySeed: "TEST_SEED"
};

await db.collection("meetingRecords").doc("TEST_e2e_meeting_scout").set({
  title: "TEST E2E Scout Leader Meeting",
  meetingType: "leader",
  section: "Scouts",
  meetingDate: "2099-01-15T19:30",
  attendees: ["Aisling Ryan"],
  notes: "Baseline Playwright meeting minutes.",
  decisions: "Baseline decision.",
  actions: "Baseline action.",
  createdBy: "TEST_SEED",
  createdAt: FieldValue.serverTimestamp(),
  updatedBy: "TEST_SEED",
  updatedAt: FieldValue.serverTimestamp(),
  ...marker
});

await db.collection("weeklyMeetings").doc("TEST_e2e_weekly_scout").set({
  section: "Scouts",
  meetingDate: "2099-01-15",
  notes: "Baseline Playwright weekly record.",
  entries: [{
    memberId: "TEST_member_scout_01",
    memberName: "Sophie Ryan",
    attendance: "unrecorded",
    subsPaid: false,
    subsAmount: 0,
    badges: []
  }],
  createdBy: "TEST_SEED",
  createdAt: FieldValue.serverTimestamp(),
  updatedBy: "TEST_SEED",
  updatedAt: FieldValue.serverTimestamp(),
  ...marker
});

console.log("Playwright persistence fixtures seeded.");
