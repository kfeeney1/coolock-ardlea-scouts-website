import test from "node:test";
import assert from "node:assert/strict";
import {canWriteEventHall, eventHallMetadata} from "../../src/services/eventHallSchedule.ts";
import {eventInput} from "../../src/services/eventManagementLogic.ts";
import type {EventRecord} from "../../src/services/eventAdmin.ts";
const interval = {date: "2026-11-05", startTime: "19:00", endDate: "2026-11-05", endTime: "20:00"};
test("event hall metadata preserves revision/ownership but rejects unsafe or invalid interval projections", () => {
  assert.deepEqual(eventHallMetadata({hallResource: "group-hall", hallRevision: 3, hallInterval: interval}), {hallResource: "group-hall", hallRevision: 3, hallInterval: interval});
  for (const hallInterval of [{...interval, private: "secret"}, {...interval, endTime: "18:00"}, {...interval, date: "2026-10-25", endDate: "2026-10-25", startTime: "01:30"}, null]) {
    assert.deepEqual(eventHallMetadata({hallResource: "group-hall", hallRevision: 3, hallInterval}), {hallResource: "group-hall", hallRevision: 3});
  }
  assert.deepEqual(eventHallMetadata({hallResource: "other", hallRevision: -1, hallInterval: interval}), {});
  assert.deepEqual(eventHallMetadata({hallRevision: 4}), {hallRevision: 4});
});
test("event source UI requires canonical write scope; group role alone never grants programme rights", () => {
  assert.equal(canWriteEventHall({role: "leader", sections: ["Cubs"]}, "Cub Scout"), true);
  assert.equal(canWriteEventHall({role: "leader", sections: ["Cubs"]}, "Scouts"), false);
  assert.equal(canWriteEventHall({role: "leader", sections: ["Group"]}, "Cubs"), false);
  assert.equal(canWriteEventHall({role: "admin", sections: ["Cubs"]}, "Scouts"), true);
  assert.equal(canWriteEventHall({role: "parent", sections: ["Cubs"]}, "Cubs"), false);
  assert.equal(canWriteEventHall(null, "Cubs"), false);
});
test("event copy/programme input never carries source hall ownership, interval or revision", () => {
  const source = {title: "Test", description: "", eventType: "Activity", section: "Cubs", location: "", meetingPoint: "", returnDetails: "", leaderNotes: "", startDate: interval.date, endDate: interval.endDate, status: "open", consentRequired: false, audience: null, hallResource: "group-hall", hallInterval: interval, hallRevision: 3} as EventRecord;
  const input = eventInput(source);
  assert.equal("hallResource" in input, false); assert.equal("hallInterval" in input, false); assert.equal("hallRevision" in input, false);
  assert.equal(input.startDate, source.startDate);
});
