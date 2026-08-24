import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const marker = {
  testData: true,
  testSeed: "playwright-persistence-v1",
  createdBySeed: "TEST_SEED"
};

const scoutMember = await db.collection("members").doc("TEST_member_scout_01").get();
if (!scoutMember.exists) throw new Error("Canonical population must create TEST_member_scout_01 before Playwright persistence seeding.");
const scoutMemberName = scoutMember.data().displayName;
if (typeof scoutMemberName !== "string" || !scoutMemberName.trim()) throw new Error("TEST_member_scout_01 must have a canonical displayName.");

const scoutLeader = await db.collection("organisationLeadership").doc("TEST_uid_scout_programme_scouter").get();
if (!scoutLeader.exists) throw new Error("Canonical population must create TEST_uid_scout_programme_scouter before Playwright persistence seeding.");
const scoutLeaderName = scoutLeader.data().displayName;
if (typeof scoutLeaderName !== "string" || !scoutLeaderName.trim()) throw new Error("TEST_uid_scout_programme_scouter must have a canonical displayName.");

await db.collection("meetingRecords").doc("TEST_e2e_meeting_scout").set({
  title: "TEST E2E Scout Leader Meeting",
  meetingType: "leader",
  section: "Scouts",
  meetingDate: "2099-01-15T19:30",
  attendees: [scoutLeaderName],
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
    memberName: scoutMemberName,
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

await db.collection("events").doc("TEST_e2e_scout_consent").set({
  title: "TEST Scout Consent Night",
  description: "Deterministic Scouts consent fixture for Playwright.",
  eventType: "Weekly Meeting",
  section: "Scouts",
  location: "Scout Den",
  meetingPoint: "Scout Den",
  returnDetails: "Scout Den",
  leaderNotes: "TEST DATA ONLY.",
  startDate: "2099-01-22",
  endDate: "2099-01-22",
  status: "open",
  consentRequired: true,
  attendance: {
    TEST_member_scout_01: "invited"
  },
  consent: {
    TEST_member_scout_01: "required"
  },
  createdBy: "TEST_SEED",
  createdAt: FieldValue.serverTimestamp(),
  updatedBy: "TEST_SEED",
  updatedAt: FieldValue.serverTimestamp(),
  ...marker
});

console.log("Playwright persistence fixtures seeded from canonical population identities.");
