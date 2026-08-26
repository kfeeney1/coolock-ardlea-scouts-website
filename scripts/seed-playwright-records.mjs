import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const marker = { testData: true, testSeed: "playwright-persistence-v1", createdBySeed: "TEST_SEED" };
const activityMarker = "weekly-activities-v1";
const badgeworkMarker = "weekly-badgework-v1";
const programmeMarker = "weekly-programme-v1";

async function requireDoc(collection, id) {
  const snapshot = await db.collection(collection).doc(id).get();
  if (!snapshot.exists) throw new Error(`Canonical population must create ${collection}/${id} before Playwright persistence seeding.`);
  return snapshot.data();
}

function activity(id, name, leader, equipment, durationMinutes, notes = "") {
  return { id, activity: name, leader, equipment, durationMinutes, notes };
}
function plannedBadgework(id, badge, leader, equipment, durationMinutes, notes = "") {
  return { id, badge, leader, equipment, durationMinutes, notes };
}
function activities(items) { return JSON.stringify({ marker: activityMarker, items }); }
function badgework(items) { return JSON.stringify({ marker: badgeworkMarker, items }); }
function programme(theme, notes) { return JSON.stringify({ marker: programmeMarker, theme, notes }); }

const scoutMember = await requireDoc("members", "TEST_member_scout_01");
const scoutMemberName = scoutMember.displayName;
if (typeof scoutMemberName !== "string" || !scoutMemberName.trim()) throw new Error("TEST_member_scout_01 must have a canonical displayName.");
const scoutLeader = await requireDoc("organisationLeadership", "TEST_uid_scout_programme_scouter");
const groupLeader = await requireDoc("organisationLeadership", "TEST_uid_group_leader");

await db.collection("meetingRecords").doc("TEST_e2e_meeting_scout").set({ title: "TEST E2E Scout Leader Meeting", meetingType: "leader", section: "Scouts", meetingDate: "2099-01-15T19:30", attendees: [scoutLeader.displayName], notes: "Baseline Playwright meeting minutes.", decisions: "Baseline decision.", actions: "Baseline action.", createdBy: "TEST_SEED", createdAt: FieldValue.serverTimestamp(), updatedBy: "TEST_SEED", updatedAt: FieldValue.serverTimestamp(), ...marker });
await db.collection("meetingRecords").doc("TEST_e2e_meeting_group_council").set({ title: "TEST E2E Group Council Meeting", meetingType: "group", section: "Group", meetingDate: "2099-01-16T20:00", attendees: [groupLeader.displayName], notes: "Baseline Group Council minutes for Playwright role access checks.", decisions: "Baseline Group Council decision.", actions: "Baseline Group Council action.", createdBy: "TEST_SEED", createdAt: FieldValue.serverTimestamp(), updatedBy: "TEST_SEED", updatedAt: FieldValue.serverTimestamp(), ...marker });

const sectionPlans = [
  ["Beavers", "beaver", "2098-12-01", "2098-12-08", 1, 1],
  ["Cubs", "cub", "2098-12-02", "2098-12-09", 2, 2],
  ["Scouts", "scout", "2099-01-15", "2098-12-10", 3, 1],
  ["Ventures", "venture", "2098-12-04", "2098-12-11", 2, 0],
  ["Rovers", "rover", "2098-12-05", "2098-12-12", 1, 3]
];
for (const [section, key, primaryDate, secondDate, activityCount, badgeCount] of sectionPlans) {
  const member = await requireDoc("members", `TEST_member_${key}_01`);
  const activityItems = [
    activity(`${key}-a1`, "Opening game", "Section Leader", "Cones", 15, "Fast opener"),
    activity(`${key}-a2`, "Team challenge", "Programme Scouter", "Rope", 25, "Patrol rotation"),
    activity(`${key}-a3`, "Closing game", "Scouter", "Ball", 15, "Short finish")
  ].slice(0, Number(activityCount));
  const badgeItems = [
    plannedBadgework(`${key}-b1`, "Adventure Skills", "Programme Scouter", "Skills equipment", 30, "Core badgework"),
    plannedBadgework(`${key}-b2`, "Teamwork", "Section Leader", "Patrol resources", 20, "Small-group work"),
    plannedBadgework(`${key}-b3`, "Community", "Scouter", "Project materials", 25, "Follow-up activity")
  ].slice(0, Number(badgeCount));
  const base = {
    section,
    status: "closed",
    location: "Scout Den",
    plannedActivities: activities(activityItems),
    plannedBadgework: badgework(badgeItems),
    programmeNotes: programme(`${section} Test Theme`, "Reusable programme template for Playwright."),
    notes: "Historical post-meeting note that must not be copied.",
    entries: [{ memberId: `TEST_member_${key}_01`, memberName: member.displayName, attendance: "present", subsPaid: true, subsAmount: 5, badges: ["TEST Completed Badge"] }],
    injuries: [{ memberId: `TEST_member_${key}_01`, memberName: member.displayName, concern: "TEST minor graze", severity: "minor", actionTaken: "Cleaned and covered", parentInformed: true, recordedAt: "2098-12-01T19:45:00.000Z" }],
    createdBy: "TEST_SEED", createdAt: FieldValue.serverTimestamp(), updatedBy: "TEST_SEED", updatedAt: FieldValue.serverTimestamp(), ...marker
  };
  const primaryId = section === "Scouts" ? "TEST_e2e_weekly_scout" : `TEST_e2e_weekly_${key}_01`;
  await db.collection("weeklyMeetings").doc(primaryId).set({ ...base, meetingDate: primaryDate });
  await db.collection("weeklyMeetings").doc(`TEST_e2e_weekly_${key}_02`).set({ ...base, meetingDate: secondDate, notes: "Second deterministic historical meeting." });
}

await db.collection("events").doc("TEST_e2e_scout_consent").set({ title: "TEST Scout Consent Night", description: "Deterministic Scouts consent fixture for Playwright.", eventType: "Weekly Meeting", section: "Scouts", location: "Scout Den", meetingPoint: "Scout Den", returnDetails: "Scout Den", leaderNotes: "TEST DATA ONLY.", startDate: "2099-01-22", endDate: "2099-01-22", status: "open", consentRequired: true, attendance: { TEST_member_scout_01: "invited" }, consent: { TEST_member_scout_01: "required" }, createdBy: "TEST_SEED", createdAt: FieldValue.serverTimestamp(), updatedBy: "TEST_SEED", updatedAt: FieldValue.serverTimestamp(), ...marker });

console.log("Playwright persistence fixtures seeded from canonical population identities, including varied structured weekly planner rows with duration-based activities and mirrored badgework planning.");
