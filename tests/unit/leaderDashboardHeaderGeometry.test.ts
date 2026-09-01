import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("leader dashboard header owns viewport-based geometry", () => {
  const header = source("src/components/admin/LeaderDashboardHeader.tsx");
  assert.ok(header.includes('data-testid="leader-dashboard-header"'));
  assert.ok(header.includes('"calc(100vw - 32px)"'));
  assert.ok(header.includes('"calc(100vw - 48px)"'));
  assert.ok(header.includes('maxWidth: 1536'));
  assert.ok(header.includes('transform: "translateX(-50%)"'));
});

test("leader dashboard navigation keeps nested record routes matched to their parent item", () => {
  const header = source("src/components/admin/LeaderDashboardHeader.tsx");
  assert.ok(header.includes('pathname.startsWith(`${itemPath}/`)'));
});
