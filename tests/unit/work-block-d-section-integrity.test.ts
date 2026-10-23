import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("parent current programme scope is derived from canonical linked member records", () => {
  const portal = readFileSync("src/services/parentPortal.ts", "utf8");
  assert.match(portal, /account\.memberIds\.map\(\(memberId\) => getDoc\(doc\(db, "members", memberId\)\)\)/);
  assert.match(portal, /status === "active"/);
  assert.doesNotMatch(portal, /return account;\n}\n\nexport async function loadParentAccounts/);
});

test("parent current programme scope is refreshed from members before section projections are queried", () => {
  const portal = readFileSync("src/services/parentPortal.ts", "utf8");
  assert.match(portal, /return \{ \.\.\.account, linkedSections: currentSections \}/);
  const rules = readFileSync("firestore.rules", "utf8");
  const helper = rules.match(/function isApprovedParentForSection\(section\) \{[\s\S]*?^ {4,6}\}/m)?.[0] ?? "";
  assert.doesNotMatch(helper, /linkedSections/);
  assert.match(helper, /parentMemberCurrentlyInSection/);
  assert.match(helper, /"Group", "All Sections"/);
});

test("meeting copy exposes authorised destination section and resets operational history", () => {
  const copyPage = readFileSync("src/pages/CopyWeeklyMeetingPage.tsx", "utf8");
  assert.ok(copyPage.includes('label="Destination section"'));
  assert.ok(copyPage.includes("availableSections.includes(copySection)"));
  assert.ok(copyPage.includes("entries: attendancePreview"));
  assert.ok(copyPage.includes("injuries: []"));
  assert.ok(!copyPage.includes("entries:roster.length?roster:fallback"));
  assert.ok(copyPage.includes('notes: ""'));
  assert.ok(copyPage.includes("createWeeklyMeeting(input)"));
});
