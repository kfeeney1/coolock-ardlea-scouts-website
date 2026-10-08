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
  const logic=readFileSync("src/services/eventManagementLogic.ts","utf8");
  const rules=readFileSync("firestore.rules","utf8");
  const flowSeed=readFileSync("scripts/seed-flow-data.mjs","utf8");

  assert.match(admin,/mode: "sections" \| "members" \| "mixed"/);
  assert.match(admin,/const reconciledAttendance = \{ \.\.\.previousAttendance \}/);
  assert.match(admin,/const reconciledConsent = \{ \.\.\.previousConsent \}/);
  assert.match(admin,/reconciledAttendance\[id\] \?\?= "invited"/);
  assert.match(admin,/reconciledConsent\[id\] \?\?=/);
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

  assert.match(parentEvents,/where\("active", "==", true\)/);
  assert.match(parentEvents,/audienceMemberIds\.some\(\(id\) => linkedMemberIdSet\.has\(id\)\)/);
  assert.doesNotMatch(parentEvents,/where\("section", "in", uniqueSections\)/);
  assert.match(consent,/audienceMemberIds: event\.audience\?\.resolvedMemberIds \?\? \[\]/);
  assert.match(consent,/audienceVersion: 2/);
  assert.match(parentPortalSections,/const memberIds = selectedChild \? \[selectedChild\.id\] : \[\]/);
  assert.match(parentPortalSections,/memberIds=\{memberIds\}/);
  assert.match(parentPortal,/account\.memberIds/);
  assert.match(parentTasks,/loadParentEventConsentLinks\(memberIds\)/);
  assert.doesNotMatch(parentTasks,/loadParentEventConsentLinks\(sections\)/);
  assert.match(rules,/resource\.data\.active == true && isApprovedParent\(\)/);
  assert.match(flowSeed,/audienceVersion: 2, audienceMemberIds: \["TEST_member_beaver_01", "TEST_member_beaver_02"\]/);
  assert.match(flowSeed,/semantics: "snapshot".*resolvedMemberIds: \["TEST_member_beaver_01", "TEST_member_beaver_02"\]/);
});
