import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appointments = fs.readFileSync("src/security/scoutingAppointments.ts", "utf8");
const permissions = fs.readFileSync("src/security/permissionRegistry.ts", "utf8");
const service = fs.readFileSync("src/services/leaderAccess.ts", "utf8");
const page = fs.readFileSync("src/pages/LeaderAccessManagement.tsx", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");

test("SW-111 keeps legacy scalar reads while establishing canonical appointment assignments", () => {
  assert.match(appointments, /normalizeScoutingAppointmentAssignments/);
  assert.match(appointments, /legacyAppointment/);
  assert.match(service, /org\?\.appointments, org\?\.scoutingRole/);
  assert.match(service, /appointments,/);
});

test("SW-111 effective permission resolver unions active appointments", () => {
  assert.match(permissions, /activeScoutingAppointments/);
  assert.match(permissions, /appointmentNames\.some/);
  assert.match(permissions, /grantMatches\(grant, role, appointment\)/);
});

test("SW-111 UI is a multi-select rather than a single Scouting appointment select", () => {
  assert.match(page, /role="group"/);
  assert.match(page, /<Checkbox checked=\{selected\}/);
  assert.doesNotMatch(page, /TextField select label="Scouting appointment"/);
});

test("SW-111 public projection does not expose private appointment arrays", () => {
  const publicWrite = service.slice(service.indexOf("transaction.set(publicRef"));
  assert.match(publicWrite, /displayName: safeOrg\.displayName/);
  assert.doesNotMatch(publicWrite.slice(0, publicWrite.indexOf("});") + 3), /\.\.\.safeOrg/);
});

test("SW-111 rules bound canonical appointment arrays", () => {
  assert.match(rules, /request\.resource\.data\.appointments is list/);
  assert.match(rules, /appointments\.size\(\) <= 12/);
});
