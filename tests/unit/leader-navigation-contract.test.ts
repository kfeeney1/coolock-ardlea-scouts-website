import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

test("leader navigation contract declares unique IDs and destination page identities", async () => {
  const nav = await read("src/navigation/leaderNavigation.ts");
  const itemLines = nav.split("\n").filter((line) => line.includes("path:") && line.includes("pageId:"));
  const ids = itemLines.flatMap((line) => [...line.matchAll(/id: "([^"]+)"/g)].map((match) => match[1]));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(itemLines.length, ids.length);
  for (const line of itemLines) assert.match(line, /id: "[^"]+".*path: "[^"]+".*pageId: "[^"]+"/);
});

test("role-labelled destinations do not silently alias another role workspace", async () => {
  const nav = await read("src/navigation/leaderNavigation.ts");
  assert.match(nav, /id: "treasurer-settings"[^\n]+path: "\/leader\/settings\?view=treasurer"/);
  assert.match(nav, /id: "qm-settings"[^\n]+path: "\/leader\/settings\?view=quartermaster"/);
  assert.match(nav, /id: "qm-equipment-stores"[^\n]+path: "\/leader\/equipment\?view=quartermaster"/);
  assert.match(nav, /id: "group-equipment-stores"[^\n]+path: "\/leader\/equipment\?view=group-operations"/);
});


test("canonical navigation has no duplicate complete destinations", async () => {
  const nav = await read("src/navigation/leaderNavigation.ts");
  const itemLines = nav.split("\n").filter((line) => line.includes("path:") && line.includes("pageId:"));
  const destinations = itemLines.map((line) => line.match(/path: "([^"]+)"/)?.[1]).filter((value): value is string => Boolean(value));
  assert.equal(new Set(destinations).size, destinations.length, "Every independently labelled navigation item must have a unique pathname + search + hash");
});

test("all role-shared workspaces preserve originating navigation context", async () => {
  const nav = await read("src/navigation/leaderNavigation.ts");
  const expected = new Map([
    ["treasurer-subs", "/leader/subs?view=treasurer"],
    ["group-subs", "/leader/subs?view=group-operations"],
    ["treasurer-floats", "/leader/finance?view=treasurer"],
    ["group-section-floats", "/leader/finance?view=group-operations"],
    ["secretary-meeting-records", "/leader/meetings?view=secretary"],
    ["group-meeting-records", "/leader/meetings?view=group-operations"],
    ["treasurer-reports", "/leader/reports?view=treasurer"],
    ["reports-exports", "/leader/reports?view=insights"],
    ["treasurer-settings", "/leader/settings?view=treasurer"],
    ["qm-settings", "/leader/settings?view=quartermaster"],
    ["settings", "/leader/settings"],
    ["qm-equipment-stores", "/leader/equipment?view=quartermaster"],
    ["group-equipment-stores", "/leader/equipment?view=group-operations"],
    ["family-billing", "/leader/subs#family-billing"],
  ]);
  const itemLines = nav.split("\n").filter((line) => line.includes("path:") && line.includes("pageId:"));
  for (const [id, destination] of expected) {
    const line = itemLines.find((candidate) => candidate.includes('id: "' + id + '"'));
    assert.ok(line, "Missing navigation item " + id);
    assert.ok(line.includes('path: "' + destination + '"'), id + " must route to " + destination);
  }
});

test("Treasurer owns finance destinations while Secretary owns meeting records only", async () => {
  const nav = await read("src/navigation/leaderNavigation.ts");
  const treasurerGroup = nav.slice(nav.indexOf('{ id: "treasurer"'), nav.indexOf('{ id: "secretary"'));
  const secretaryGroup = nav.slice(nav.indexOf('{ id: "secretary"'), nav.indexOf('{ id: "quartermaster"'));
  for (const label of ["Subs", "Floats", "Reports", "Settings"]) assert.match(treasurerGroup, new RegExp(`label: "${label}"`));
  assert.match(treasurerGroup, /appointments: \["Group Treasurer"\]/);
  assert.match(secretaryGroup, /label: "Meeting Records"/);
  assert.doesNotMatch(secretaryGroup, /label: "(Subs|Floats|Reports|Settings)"/);
});
