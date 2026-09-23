import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("SW-147 and SW-148 share one canonical source and Super Admin route", async () => {
  const [source, page, app, nav, guard] = await Promise.all([
    "src/operations/systemInformation.ts",
    "src/pages/SystemInformation.tsx",
    "src/App.tsx",
    "src/components/admin/LeaderDashboardHeader.tsx",
    "src/components/admin/ProtectedSuperAdminRoute.tsx",
  ].map((file) => readFile(file, "utf8")));

  assert.match(page, /SYSTEM_INFORMATION as info, buildAiHandoverPrompt/);
  assert.match(source, /SW-164 Hall Hire/);
  assert.match(source, /production deployment is manual/i);
  assert.match(source, /live GitHub, Firebase and Jira state is authoritative/i);
  assert.ok(app.includes('path="/leader/system"'));
  assert.ok(app.includes("protectedSuperAdminRoute"));
  assert.match(guard, /role !== "super-admin"/);
  assert.ok(nav.includes("System Information"));
  assert.ok(nav.includes("superAdminOnly: true"));
  assert.match(page, /Clipboard access is unavailable/);
  assert.doesNotMatch(source, /BEGIN PRIVATE KEY|ghp_[A-Za-z0-9]+/);
});
