import assert from "node:assert/strict";
import test from "node:test";
import { deleteCandidatesIndependently, groupLocalDate, isFutureClosedMeeting, sameCleanupCandidateIds } from "../../src/services/futureClosedMeetingCleanupLogic.ts";

test("group local date follows Europe/Dublin across UTC midnight and DST changes", () => {
  assert.equal(groupLocalDate(new Date("2026-10-15T23:30:00.000Z")), "2026-10-16");
  assert.equal(groupLocalDate(new Date("2026-10-25T00:30:00.000Z")), "2026-10-25");
  assert.equal(groupLocalDate(new Date("2026-03-29T00:30:00.000Z")), "2026-03-29");
});

test("only valid future-dated closed meetings qualify", () => {
  const today = "2026-10-16";
  assert.equal(isFutureClosedMeeting({ status: "closed", meetingDate: "2026-10-17" }, today), true);
  assert.equal(isFutureClosedMeeting({ status: "open", meetingDate: "2026-10-17" }, today), false);
  assert.equal(isFutureClosedMeeting({ status: "closed", meetingDate: today }, today), false);
  assert.equal(isFutureClosedMeeting({ status: "closed", meetingDate: "2026-10-15" }, today), false);
  assert.equal(isFutureClosedMeeting({ status: "closed", meetingDate: "16-10-2027" }, today), false);
  assert.equal(isFutureClosedMeeting({ status: "closed", meetingDate: "2026-02-30" }, today), false);
});

test("confirmation candidate set comparison ignores order but detects additions and removals", () => {
  assert.equal(sameCleanupCandidateIds(["b", "a", "a"], ["a", "b"]), true);
  assert.equal(sameCleanupCandidateIds(["a"], ["a", "b"]), false);
  assert.equal(sameCleanupCandidateIds(["a", "b"], ["b"]), false);
});

test("partial deletion keeps successes complete and retries only remaining candidates", async () => {
  const candidates = [{ id: "one" }, { id: "two" }];
  const completed = new Set<string>();
  const first = await deleteCandidatesIndependently(candidates, async ({ id }) => {
    if (id === "two") throw new Error("temporary failure");
    completed.add(id);
  });
  assert.deepEqual(first, { deleted: ["one"], failed: ["two"] });
  const retryCandidates = candidates.filter(({ id }) => first.failed.includes(id));
  const second = await deleteCandidatesIndependently(retryCandidates, async ({ id }) => { completed.add(id); });
  assert.deepEqual(second, { deleted: ["two"], failed: [] });
  assert.deepEqual([...completed].sort(), ["one", "two"]);
});
