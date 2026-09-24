import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

test("leader navigation contract declares unique IDs and destination page identities", async () => {
  const nav = await read("src/navigation/leaderNavigation.ts");
  const ids = [...nav.matchAll(/id: "([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(nav, new RegExp(`id: "${id}"[^\\n]+pageId: "[^"]+"`));
});

test("role-labelled destinations do not silently alias another role workspace", async () => {
  const nav = await read("src/navigation/leaderNavigation.ts");
  assert.match(nav, /id: "secretary-settings"[^\n]+path: "\/leader\/settings\?view=secretary"/);
  assert.match(nav, /id: "qm-settings"[^\n]+path: "\/leader\/settings\?view=quartermaster"/);
  assert.match(nav, /id: "qm-equipment-stores"[^\n]+path: "\/leader\/equipment\?view=quartermaster"/);
  assert.match(nav, /id: "group-equipment-stores"[^\n]+path: "\/leader\/equipment\?view=group-operations"/);
});
