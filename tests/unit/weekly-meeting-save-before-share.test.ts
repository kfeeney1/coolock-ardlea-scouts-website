import test from "node:test";
import assert from "node:assert/strict";
import { saveMeetingBeforeShare, weeklyMeetingSnapshotShareUrl } from "../../src/services/weeklyMeetingShareSnapshot.ts";
import type { WeeklyMeetingRecord } from "../../src/services/weeklyTracker.ts";
const meeting = (): WeeklyMeetingRecord => ({ id: "meeting", section: "Scouts", meetingDate: "2099-07-22", status: "open", location: "Den", theme: "Saved theme", activities: [{ id: "a", activity: "Public game", durationMinutes: 20, leader: "PRIVATE LEADER", equipment: "Cones", notes: "PRIVATE INSTRUCTIONS" }], badgeworkPlan: [], programmeNotes: "PRIVATE PROGRAMME NOTES", notes: "PRIVATE MEETING NOTES", entries: [{ memberId: "member", memberName: "PRIVATE MEMBER", attendance: "present", uniform: true, subsPaid: true, subsAmount: 10, badges: ["Teamwork", "teamwork"] }], injuries: [{ memberId: "member", memberName: "PRIVATE MEMBER", concern: "PRIVATE MEDICAL", severity: "minor", actionTaken: "PRIVATE ACTION", parentInformed: false, recordedAt: "2099-07-22T12:00:00Z" }] });

test("sharing waits for the complete save, freezes its snapshot and then loads canonical badgework", async () => {
  const record = meeting(); const order: string[] = [];
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  const result = saveMeetingBeforeShare(record, async snapshot => {
    order.push("meeting"); assert.equal(snapshot.theme, "Saved theme"); await ready; order.push("leader attendance"); return true;
  }, async (members, id) => { order.push("badgework"); assert.deepEqual(members, ["member"]); assert.equal(id, "meeting"); return ["Pioneering"]; });
  assert.deepEqual(order, ["meeting"]);
  record.theme = "Concurrent unsaved theme";
  release(); const text = new URL(await result).searchParams.get("text")!;
  assert.deepEqual(order, ["meeting", "leader attendance", "badgework"]);
  assert.match(text, /Saved theme/); assert.doesNotMatch(text, /Concurrent unsaved theme/);
});
test("failed writes and failed preparation never return a share URL", async () => {
  let loaded = false;
  await assert.rejects(() => saveMeetingBeforeShare(meeting(), async () => false, async () => { loaded = true; return []; }), /Sharing is blocked/);
  assert.equal(loaded, false);
  await assert.rejects(() => saveMeetingBeforeShare(meeting(), async () => true, async () => { throw new Error("badgework denied"); }), /badgework denied/);
});
test("the shared canonical payload contains programme content without private meeting or member data", () => {
  const text = new URL(weeklyMeetingSnapshotShareUrl(meeting(), ["Pioneering"])).searchParams.get("text")!;
  assert.match(text, /Public game/); assert.match(text, /Cones/); assert.match(text, /Pioneering/);
  assert.doesNotMatch(text, /PRIVATE|uniform|subsPaid|parentInformed/i);
});
