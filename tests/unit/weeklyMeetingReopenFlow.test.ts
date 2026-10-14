import assert from "node:assert/strict";
import test from "node:test";
import { reopenWeeklyMeetingAndNavigate } from "../../src/services/weeklyMeetingReopenFlow.ts";
import type { WeeklyMeetingRecord } from "../../src/services/weeklyTracker.ts";

const record = {
  id: "meeting / exact-id",
  section: "Scouts",
  meetingDate: "2098-10-14",
  status: "closed",
  location: "Scout Den",
  theme: "Navigation",
  activities: [],
  badgeworkPlan: [],
  programmeNotes: "",
  notes: "",
  entries: [],
  injuries: []
} satisfies WeeklyMeetingRecord;

test("reopen persistence completes before navigation and audit is secondary", async () => {
  const events: string[] = [];
  let resolveAuditReported!: () => void;
  const auditReported = new Promise<void>((resolve) => { resolveAuditReported = resolve; });
  await reopenWeeklyMeetingAndNavigate(
    record,
    async (id) => { assert.equal(id, record.id); events.push("persisted"); },
    (path) => events.push(`navigate:${path}`),
    async () => { events.push("audit"); throw new Error("audit unavailable"); },
    () => { events.push("audit-reported"); resolveAuditReported(); }
  );
  await auditReported;
  assert.equal(events.join("|"), [
    "persisted",
    "navigate:/leader/weekly?meeting=meeting%20%2F%20exact-id",
    "audit",
    "audit-reported"
  ].join("|"));
});

test("a failed reopen does not navigate or start an audit", async () => {
  const events: string[] = [];
  await assert.rejects(reopenWeeklyMeetingAndNavigate(
    record,
    async () => { events.push("reopen-failed"); throw new Error("write rejected"); },
    (path) => events.push(`navigate:${path}`),
    async () => { events.push("audit"); },
    () => events.push("audit-reported")
  ), /write rejected/);
  assert.deepEqual(events, ["reopen-failed"]);
});
