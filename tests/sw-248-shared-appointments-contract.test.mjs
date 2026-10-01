import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("src/pages/LeaderAccessManagement.tsx", "utf8");
const service = fs.readFileSync("src/services/leaderAccess.ts", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");

test("SW-248 Group appointments use Group scope when rendering and toggling", () => {
  assert.match(page, /assignmentScope = .*isGroupScopedAppointment\(appointment\) \? "Group" : appointmentScope\(record\)/);
  assert.match(page, /item\.scope === assignmentScope\(record, appointment\)/);
});

test("SW-248 appointments are persisted on the selected leader document only", () => {
  assert.match(service, /targetOrgRef = doc\(db, "organisationLeadership", record\.uid\)/);
  assert.match(service, /transaction\.set\(targetOrgRef, safeOrg\)/);
  assert.doesNotMatch(service, /where\([^\n]*scoutingRole/);
});

test("SW-248 does not encode a blanket cross-leader uniqueness rule", () => {
  assert.doesNotMatch(service, /appointment[^\n]*(already|taken|holder|unique)/i);
  assert.doesNotMatch(rules, /appointment[^\n]*(already|taken|holder|unique)/i);
});

test("SW-248 keeps authorization on appointment mutation", () => {
  assert.match(service, /canAssignScoutingAppointment\(actor, target, item\.appointment\)/);
  assert.match(service, /canClearScoutingAppointment\(actor, target\)/);
});
