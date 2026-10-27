import test from "node:test";
import assert from "node:assert/strict";
import { saveWeeklyMeetingWrites, saveWeeklyMeetingInBackground } from "../../src/services/weeklyMeetingSaveWrites.ts";
import type { WeeklyMeetingRecord } from "../../src/services/weeklyTracker";
const meeting = { id: "one", status: "closed", entries: [], injuries: [], notes: "Retained notes" } as unknown as WeeklyMeetingRecord;
test("closure waits for pending leader writes and cannot close after a leader-save rejection", async () => {
  const order: string[] = [];
  const writes = { saveLeaders: async () => { order.push("leaders"); }, updateOpen: async () => { order.push("closed"); }, updatePast: async () => { throw Error("wrong permission path"); } };
  await saveWeeklyMeetingWrites(meeting, false, writes); assert.deepEqual(order, ["leaders", "closed"]);
  order.length = 0;
  await assert.rejects(saveWeeklyMeetingWrites(meeting, false, { ...writes, saveLeaders: async () => { throw Error("leader write denied"); } }), /leader write denied/); assert.deepEqual(order, []);
});
test("past corrections use only the existing permitted operational fields and open saves preserve complete-write ordering", async () => {
  const order: string[] = [];
  await saveWeeklyMeetingWrites(meeting, true, { saveLeaders: async () => { order.push("leaders"); }, updateOpen: async () => { throw Error("wrong permission path"); }, updatePast: async (id, input) => { assert.equal(id, "one"); assert.deepEqual(Object.keys(input).sort(), ["entries", "injuries", "notes"]); order.push("past"); } });
  assert.deepEqual(order, ["past", "leaders"]); order.length = 0;
  await assert.rejects(saveWeeklyMeetingWrites({ ...meeting, status: "open" }, false, { saveLeaders: async () => { order.push("leaders"); }, updatePast: async () => {}, updateOpen: async () => { throw Error("meeting failure"); } }), /meeting failure/); assert.deepEqual(order, []);
});

test("background saves share the explicit write slot and cannot overwrite a later closure", async () => {
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const slot: { current: Promise<boolean> | null } = { current: null };
  const order: string[] = [];
  const writes = { updateOpen: async (_id: string, input: { status: string }) => { order.push(input.status); if (input.status === "open") await barrier; }, saveLeaders: async () => {}, updatePast: async () => {} };
  const background = saveWeeklyMeetingInBackground({ ...meeting, status: "open" }, slot, writes, () => { order.push("baseline"); });
  assert.ok(slot.current);
  assert.equal(await saveWeeklyMeetingInBackground({ ...meeting, status: "open" }, slot, writes, () => {}), false);
  const closing = (async () => { await slot.current; await saveWeeklyMeetingWrites(meeting, false, writes); })();
  assert.deepEqual(order, ["open"]); release(); await Promise.all([background, closing]);
  assert.deepEqual(order, ["open", "baseline", "closed"]); assert.equal(slot.current, null);
});
