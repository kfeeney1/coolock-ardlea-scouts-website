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
  assert.match(admin,/mode: "sections" \| "members"/);
  assert.match(admin,/previousAttendance\[id\] \?\? "invited"/);
  assert.match(admin,/previousConsent\[id\]/);
  assert.match(logic,/selected\.size > 0 \? selected\.has\(member\.id\) : sections\.has\(member\.section\)/);
  assert.match(rules,/"audience"/);
});
