import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appointments = fs.readFileSync("src/security/scoutingAppointments.ts", "utf8");
const leaderService = fs.readFileSync("src/services/leaderAccess.ts", "utf8");
const leaderPage = fs.readFileSync("src/pages/LeaderAccessManagement.tsx", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");

test("Block A keeps Account sections multi-select and persists Primary separately", () => {
  assert.match(leaderPage, /Account sections/);
  assert.match(leaderPage, /Primary section/);
  assert.match(leaderService, /primarySection:/);
  assert.match(rules, /primarySection in get\(\/databases\/\$\(database\)\/documents\/adminUsers\/\$\(leaderId\)\)\.data\.sections/);
});

test("Block A supports Group-only without inventing a second section model", () => {
  assert.match(leaderPage, /"Rovers", "Group"/);
  assert.match(leaderService, /sections,/);
  assert.doesNotMatch(leaderPage, /label="Organisation section"/);
});

test("Block A adds Group Trainer once to the canonical appointment catalogue", () => {
  assert.equal((appointments.match(/"Group Trainer"/g) || []).length >= 2, true);
  assert.match(appointments, /"group trainer": "Group Trainer"/);
  assert.match(appointments, /canonical === "Group Trainer"/);
});

test("Block A permits member transfer from an authorised source without destination access", () => {
  assert.match(rules, /function canTransferMember\(fromSection, toSection\)/);
  assert.match(rules, /hasSection\(fromSection\)/);
  assert.match(rules, /hasSection\(request\.resource\.data\.section\) \|\| canTransferMember/);
  assert.match(rules, /hasSection\(request\.resource\.data\.toSection\) \|\| canTransferMember/);
});
