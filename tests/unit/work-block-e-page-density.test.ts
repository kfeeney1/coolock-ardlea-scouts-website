import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

test("SW-132 removes representative generic refresh controls while preserving scoped recovery", async () => {
  const files = await Promise.all([
    read("src/pages/LeaderAccessManagement.tsx"),
    read("src/pages/LeaderRequests.tsx"),
    read("src/pages/MemberManagement.tsx"),
    read("src/pages/EventsManagement.tsx"),
    read("src/pages/ConsentManagement.tsx"),
    read("src/pages/ActivityLog.tsx"),
    read("src/pages/ParentAccessManagement.tsx"),
    read("src/pages/EventRecordPage.tsx")
  ]);
  for (const source of files) {
    assert.doesNotMatch(source, />Refresh<\/Button>/);
    assert.doesNotMatch(source, />Reload<\/Button>/);
  }
  const members = files[2];
  assert.doesNotMatch(files[5], /actions=\{<Button[^>]*>Refresh<\/Button>\}/);
  assert.doesNotMatch(files[6], />Refresh<\/Button>/);
  assert.doesNotMatch(files[7], />Refresh<\/Button>/);
  assert.match(members, /Retry loading member records/);
  assert.match(members, /onAction=\{\(\) => void load\(\)\}/);
});

test("SW-174 shared page header renders no visible title tile and keeps compact actions", async () => {
  const header = await read("src/components/admin/LeaderPageHeader.tsx");
  assert.match(header, /position: "absolute"/);
  assert.match(header, /data-testid="leader-page-actions"/);
  assert.doesNotMatch(header, /<Paper/);
  assert.doesNotMatch(header, /description\}/);
  const weekly = await read("src/pages/WeeklySectionTracker.tsx");
  assert.match(weekly, />Create Meeting<\/Button>/);
});

test("SW-146 keeps operational headers compact and retains meaningful safety guidance", async () => {
  const expectations = [
    ["src/pages/MemberManagement.tsx", /<LeaderPageHeader title="Member Management" actions=/],
    ["src/pages/EventsManagement.tsx", /<LeaderPageHeader title="Events & Activities" actions=/],
    ["src/pages/ConsentManagement.tsx", /<LeaderPageHeader title="Consent Management" \/>/],
    ["src/pages/SubsManagement.tsx", /<LeaderPageHeader title="Subs" \/>/],
    ["src/pages/LeaderReports.tsx", /<LeaderPageHeader title="Reports & Exports" \/>/],
    ["src/pages/EquipmentManagement.tsx", /<LeaderPageHeader title=\{pageTitle\} \/>/]
  ] as const;
  for (const [file, pattern] of expectations) assert.match(await read(file), pattern);

  const reports = await read("src/pages/LeaderReports.tsx");
  assert.match(reports, /Default exports deliberately exclude medical details/);
  const equipment = await read("src/pages/EquipmentManagement.tsx");
  assert.match(equipment, /Stock records and moves remain restricted/);
  const policies = await read("src/pages/PolicyDocuments.tsx");
  assert.match(policies, /Upload only an approved PDF/);
});

test("public activities no longer spends the first viewport on generic intro copy", async () => {
  const activities = await read("src/pages/Activities.tsx");
  assert.doesNotMatch(activities, /content\.activities\.intro/);
  assert.match(activities, /content\.activities\.emptyMessage/);
  assert.match(activities, /Unable to load upcoming activities at the moment/);
});
