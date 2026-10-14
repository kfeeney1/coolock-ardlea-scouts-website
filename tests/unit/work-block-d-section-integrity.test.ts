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
  const start = rules.indexOf("function isApprovedParentForSection");
  const end = rules.indexOf("function isCanonicalAdventureSkillStage", start);
  const helper = rules.slice(start, end);
  assert.doesNotMatch(helper, /linkedSections/);
  assert.match(helper, /parentMemberCurrentlyInSection/);
  assert.match(helper, /"Group", "All Sections"/);
});

test("SW-386 meeting copy uses a dedicated route, authorised sections and resets operational history", () => {
  const weekly = readFileSync("src/pages/WeeklySectionTracker.tsx", "utf8");
  const copyPage = readFileSync("src/pages/WeeklyMeetingCopyPage.tsx", "utf8");
  const routes = readFileSync("src/App.tsx", "utf8");
  assert.match(routes, /path="\/leader\/weekly\/copy\/:sourceMeetingId"/);
  assert.match(weekly, /\/leader\/weekly\/copy\/\$\{encodeURIComponent\(current\.id\)\}/);
  assert.match(copyPage, /label="Destination section"/);
  assert.match(copyPage, /availableSections\.includes\(copySection\)/);
  assert.match(copyPage, /entries: attendancePreview/);
  assert.match(copyPage, /injuries: \[\]/);
  assert.match(copyPage, /notes: ""/);
  assert.match(copyPage, /activities: source\.activities\.map/);
  assert.match(copyPage, /badgeworkPlan: source\.badgeworkPlan\.map/);
  assert.doesNotMatch(weekly, /WeeklyMeetingCopyDialog/);
});
