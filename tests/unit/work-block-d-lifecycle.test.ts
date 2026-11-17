import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Block D uses stable IDs and permits same-date meetings", () => {
  const weekly=readFileSync("src/pages/WeeklySectionTracker.tsx","utf8");
  const service=readFileSync("src/services/weeklyTracker.ts","utf8");
  assert.doesNotMatch(weekly,/records\.some\(r=>r\.section===.*meetingDate/);
  assert.match(service,/doc\(collection\(db,"weeklyMeetings"\)\)/);
  assert.match(service,/reopenWeeklyMeeting/);
  assert.match(service,/status:"open"/);
});

test("Block D provides dedicated full-page creation and event editing routes", () => {
  const app=readFileSync("src/App.tsx","utf8");
  const weekly=readFileSync("src/pages/WeeklySectionTracker.tsx","utf8");
  const event=readFileSync("src/pages/EventRecordPage.tsx","utf8");
  assert.match(app,/leader\/weekly\/create/);
  assert.match(app,/leader\/events\/:eventId\/edit/);
  assert.match(weekly,/to="\/leader\/weekly\/create"/);
  assert.match(event,/\/edit/);
});

test("selected-member audiences reconcile by stable member IDs without destructive response reset", () => {
  const admin=readFileSync("src/services/eventAdmin.ts","utf8");
  const writer=readFileSync("email-worker/src/productionRoutes.js","utf8");
  const logic=readFileSync("src/services/eventManagementLogic.ts","utf8");
  const rules=readFileSync("firestore.rules","utf8");
  const flowSeed=readFileSync("scripts/seed-flow-data.mjs","utf8");

  assert.match(admin,/mode: "sections" \| "members" \| "mixed"/);
  assert.match(admin,/saveEventAudience\("update"/);
  assert.match(writer,/const previousAttendance = operation === "update" \? firestoreMap\(currentEvent, "attendance"\) : \{\}/);
  assert.match(writer,/const previousConsent = operation === "update" \? firestoreMap\(currentEvent, "consent"\) : \{\}/);
  assert.match(writer,/const attendance = \{ \.\.\.previousAttendance \}/);
  assert.match(writer,/const consent = \{ \.\.\.previousConsent \}/);
  assert.match(writer,/attendance\[id\] \?\?= "invited"/);
  assert.match(writer,/consent\[id\] \?\?=/);
  assert.match(writer,/currentDocument: existingRow\?\.updateTime/);
  assert.match(logic,/memberBelongsToSection\(member, section\).*selected\.has\(member\.id\)/s);
  assert.match(rules,/"audience"/);
});


test("Block E parent event consent uses canonical member audience snapshots", () => {
  const parentEvents=readFileSync("src/services/parentEvents.ts","utf8");
  const consent=readFileSync("src/services/eventConsent.ts","utf8");
  const parentPortal=readFileSync("src/pages/ParentPortal.tsx","utf8");
  const parentPortalSections=readFileSync("src/components/parent/ParentPortalSections.tsx","utf8");
  const parentTasks=readFileSync("src/components/parent/ParentThingsToDo.tsx","utf8");
  const rules=readFileSync("firestore.rules","utf8");
  const flowSeed=readFileSync("scripts/seed-flow-data.mjs","utf8");

  assert.match(parentEvents,/readEventDocuments\("audienceMembers", \[\["memberId", "in", linkedMemberIds\]\]\)/);
  assert.match(parentEvents,/readEventDocuments\("eventConsentLinks", \[\["section", "==", section\], \["active", "==", true\]\]\)/);
  assert.match(parentEvents,/event\.audienceMemberIds\.filter\(id => linkedMemberIds\.includes\(id\)\)/);
  assert.doesNotMatch(parentEvents,/getDoc\(doc\(db, "events"/);
  assert.match(consent,/audienceMemberIds: \[\]/);
  assert.match(consent,/audienceVersion: 3/);
  assert.match(parentPortalSections,/const memberIds = selectedChild \? \[selectedChild\.id\] : \[\]/);
  assert.match(parentPortalSections,/memberIds=\{memberIds\}/);
  assert.match(parentPortal,/account\.memberIds/);
  assert.match(parentTasks,/loadParentEventConsentLinks\(memberIds, sections\)/);
  assert.match(rules,/resource\.data\.audienceVersion in \[1, 2\]/);
  assert.match(rules,/consentEventIsVisible\(resource\.data\.eventId\)/);
  assert.match(rules,/isApprovedParentForSection\(resource\.data\.section\)/);
  assert.match(rules,/resource\.data\.audienceVersion == 3/);
  assert.match(rules,/isApprovedParentForEventRecord\(resource\.data\.eventId\)/);
  assert.match(flowSeed,/audienceVersion: 2, audienceMemberIds: \["TEST_member_beaver_01", "TEST_member_beaver_02"\]/);
  assert.match(flowSeed,/semantics: "snapshot".*resolvedMemberIds: \["TEST_member_beaver_01", "TEST_member_beaver_02"\]/);
});
