import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("record route families preload their list and record chunks", async () => {
  const source = await readFile("src/components/admin/LeaderRecordRoutePreloader.tsx", "utf8");
  for (const family of ["members", "events", "join", "consents"]) {
    assert.match(source, new RegExp(`prefix: "/leader/${family}"`));
  }
  for (const page of ["MemberRecordPage", "EventRecordPage", "JoinRecordPage", "ConsentRecordPage"]) {
    assert.match(source, new RegExp(`import\\("\\.\\./\\.\\./pages/${page}"\\)`));
  }
});

test("route scrolling restores list position when closing a record", async () => {
  const source = await readFile("src/components/RouteScrollManager.tsx", "utf8");
  assert.match(source, /recordParent\(previous\) === pathname/);
  assert.match(source, /navigationType === "POP" \|\| returningToRecordList/);
  assert.match(source, /scrollRestoration = "manual"/);
});
