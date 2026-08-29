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
function parentProgramme(section, meetingDate, activityItems, badgeItems) {
  return {
    section,
    meetingDate,
    status: "closed",
    location: "Scout Den",
    theme: `${section} Test Theme`,
    activities: activityItems.map((item) => ({ name: item.activity, durationMinutes: item.durationMinutes })),
    badgework: badgeItems.map((item) => ({ name: item.badge, durationMinutes: item.durationMinutes })),
    updatedAt: FieldValue.serverTimestamp()
  };
}

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
  const secondId = `TEST_e2e_weekly_${key}_02`;
  await db.collection("weeklyMeetings").doc(primaryId).set({ ...base, meetingDate: primaryDate });
  await db.collection("weeklyMeetings").doc(secondId).set({ ...base, meetingDate: secondDate, notes: "Second deterministic historical meeting." });
  await db.collection("parentWeeklyMeetings").doc(primaryId).set(parentProgramme(section, primaryDate, activityItems, badgeItems));
  await db.collection("parentWeeklyMeetings").doc(secondId).set(parentProgramme(section, secondDate, activityItems, badgeItems));
}

await db.collection("events").doc("TEST_e2e_scout_consent").set({ title: "TEST Scout Consent Night", description: "Deterministic Scouts consent fixture for Playwright.", eventType: "Weekly Meeting", section: "Scouts", location: "Scout Den", meetingPoint: "Scout Den", returnDetails: "Scout Den", leaderNotes: "TEST DATA ONLY.", startDate: "2099-01-22", endDate: "2099-01-22", status: "open", consentRequired: true, attendance: { TEST_member_scout_01: "invited" }, consent: { TEST_member_scout_01: "required" }, createdBy: "TEST_SEED", createdAt: FieldValue.serverTimestamp(), updatedBy: "TEST_SEED", updatedAt: FieldValue.serverTimestamp(), ...marker });

// Minimal deterministic Equipment & Stores catalogue for emulator-backed UI and report testing.
// Keep these fixtures allocation-free so checkout/return tests remain isolated and can assert
// an empty holdings state after their own transient loans are returned.
const equipmentSeedItems = [
  { id: "TEST_equipment_tents", name: "TEST Patrol Tents", category: "Camping & Sleeping", trackingMode: "quantity", totalQuantity: 8, location: "Main Equipment Store", condition: "good", notes: "Four-person patrol tents used for weekend camps.", replacementValue: 220 },
  { id: "TEST_equipment_stoves", name: "TEST Camping Stoves", category: "Cooking", trackingMode: "individual", totalQuantity: 4, location: "Main Equipment Store", condition: "good", notes: "Portable gas stoves for section cooking activities.", replacementValue: 85 },
  { id: "TEST_equipment_ropes", name: "TEST Pioneering Ropes", category: "Pioneering", trackingMode: "quantity", totalQuantity: 12, location: "Equipment Trailer", condition: "good", notes: "Mixed ropes for pioneering and knot-work sessions.", replacementValue: 35 },
  { id: "TEST_equipment_compasses", name: "TEST Compasses", category: "Navigation", trackingMode: "individual", totalQuantity: 10, location: "Leader Store", condition: "good", notes: "Baseplate compasses for hillwalking and navigation skills.", replacementValue: 25 },
  { id: "TEST_equipment_first_aid", name: "TEST First Aid Kits", category: "Safety & First Aid", trackingMode: "individual", totalQuantity: 3, location: "Leader Store", condition: "needs-attention", notes: "One kit requires its consumables checklist reviewed before camp.", replacementValue: 60 },
  { id: "TEST_equipment_tables", name: "TEST Folding Tables", category: "Camp Furniture", trackingMode: "quantity", totalQuantity: 6, location: "Equipment Trailer", condition: "good", notes: "Folding camp tables used for cooking and programme bases.", replacementValue: 75 }
];
for (const item of equipmentSeedItems) {
  await db.collection("equipmentItems").doc(item.id).set({
    name: item.name,
    category: item.category,
    trackingMode: item.trackingMode,
    totalQuantity: item.totalQuantity,
    checkedOutQuantity: 0,
    unavailableQuantity: 0,
    location: item.location,
    condition: item.condition,
    notes: item.notes,
    replacementValue: item.replacementValue,
    archived: false,
    createdBy: "TEST_SEED",
    createdAt: FieldValue.serverTimestamp(),
    updatedBy: "TEST_SEED",
    updatedAt: FieldValue.serverTimestamp(),
    ...marker
  });
}

for (const [id, name] of [["TEST_equipment_location_main", "Main Equipment Store"], ["TEST_equipment_location_trailer", "Equipment Trailer"], ["TEST_equipment_location_leader", "Leader Store"]]) {
  await db.collection("equipmentLocations").doc(id).set({ name, createdBy: "TEST_SEED", createdAt: FieldValue.serverTimestamp(), ...marker });
}

console.log(`Playwright persistence fixtures seeded from canonical population identities, including varied structured weekly planner rows, parent-safe programme projections and ${equipmentSeedItems.length} allocation-free equipment items.`);
