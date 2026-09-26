import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("parent current programme scope is derived from canonical linked member records", () => {
  const portal = readFileSync("src/services/parentPortal.ts", "utf8");
  assert.match(portal, /account\.memberIds\.map\(\(memberId\) => getDoc\(doc\(db, "members", memberId\)\)\)/);
  assert.match(portal, /status === "active"/);
  assert.doesNotMatch(portal, /return account;\n}\n\nexport async function loadParentAccounts/);
});

test("parent section rules do not authorise from persisted linkedSections", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const start = rules.indexOf("function isApprovedParentForSection");
  const end = rules.indexOf("function isCanonicalAdventureSkillStage", start);
  const helper = rules.slice(start, end);
  assert.doesNotMatch(helper, /linkedSections/);
  assert.match(helper, /documents\/members/);
});

test("meeting copy exposes authorised destination section and resets operational history", () => {
  const weekly = readFileSync("src/pages/WeeklySectionTracker.tsx", "utf8");
  assert.match(weekly, /label="Destination section"/);
  assert.match(weekly, /availableSections\.includes\(copySection\)/);
  assert.match(weekly, /entries:roster\.length\?roster:fallback,injuries:\[\]/);
  assert.match(weekly, /notes:""/);
});
