import { hallSourcePath } from "../../src/services/hallBookingAdministration.ts";
import { maintenanceHallSourcePath } from "../../src/services/hallBookingAdministration.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { editHallOccurrence, hallBookingInput, hallOccurrenceInterval, hallSeriesDates, newHallBooking, rescheduleHallSeries, validateHallBookingInput } from "../../src/services/hallBookingAdministration.ts";
const initial = {...newHallBooking("test", "2026-10-22"), title: "Cubs meeting", state: "confirmed" as const, recurrence: {frequency: "weekly" as const, until: "2026-11-05"}};
test("new draft does not reserve time, metadata is stripped from writes and required details validate", () => {
  const draft = newHallBooking("test", "2026-10-22");
  assert.equal(draft.state, "draft"); assert.match(validateHallBookingInput(draft), /title/);
  assert.equal(validateHallBookingInput(initial), "");
  assert.equal("revision" in hallBookingInput({...initial, revision: 9} as typeof initial), false);
  assert.match(validateHallBookingInput({...initial, notes: "a".repeat(3001)}), /Shorten/);
});
test("occurrence editing retains all other exceptions and cannot target an invented date", () => {
  const cancelled = editHallOccurrence(initial, "2026-10-29", hallOccurrenceInterval(initial, "2026-10-29"), true);
  const moved = editHallOccurrence(cancelled, "2026-11-05", {date: "2026-11-06", startTime: "18:00", endDate: "2026-11-06", endTime: "19:00"}, false);
  assert.deepEqual(moved.exceptions?.map(item => [item.date, item.action]), [["2026-10-29", "cancel"], ["2026-11-05", "replace"]]);
  assert.equal(hallOccurrenceInterval(moved, "2026-11-05").date, "2026-11-06");
  assert.deepEqual(hallSeriesDates(moved), ["2026-10-22", "2026-10-29", "2026-11-05"]);
  assert.throws(() => editHallOccurrence(initial, "2026-10-23", initial.interval, true));
  assert.equal(initial.exceptions, undefined);
});
test("rescheduling a series moves exception identities and replacement dates together", () => {
  const withExceptions = editHallOccurrence(initial, "2026-11-05", {date: "2026-11-06", startTime: "18:00", endDate: "2026-11-06", endTime: "19:00"}, false);
  const next = rescheduleHallSeries({...withExceptions, interval: {...initial.interval, date: "2026-10-23", endDate: "2026-10-23"}, recurrence: {frequency: "weekly", until: "2026-11-06"}}, withExceptions);
  assert.equal(next.exceptions?.[0].date, "2026-11-06");
  const replacement = next.exceptions?.[0];
  assert.equal(replacement?.action === "replace" && replacement.interval.date, "2026-11-07");
  assert.throws(() => rescheduleHallSeries({...withExceptions, recurrence: undefined}, withExceptions), /unique occurrence/);
  assert.throws(() => hallSeriesDates({...initial, recurrence: {frequency: "weekly", until: "2028-01-01"}}));
});

test("maintenance source navigation resolves canonical owners without accepting unknown paths", () => {
  assert.equal(maintenanceHallSourcePath({collection: "maintenance/group/appointments", id: "maintenance-appointment-001"}), "/calendar/maintenance/maintenance-appointment-001");
  assert.equal(maintenanceHallSourcePath({collection: "maintenance/group/appointments", id: "task-maintenance-source-001"}), "/maintenance/tasks/maintenance-source-001");
  assert.equal(maintenanceHallSourcePath({collection: "members", id: "maintenance-appointment-001"}), null);
  assert.equal(maintenanceHallSourcePath({collection: "maintenance/group/appointments", id: "../../members/private"}), null);
});

test("weekly meeting source routes preserve protected canonical scope and reject path injection", () => {
  assert.equal(hallSourcePath({collection: "weeklyMeetings", id: "meeting-one"}), "/leader/weekly?meeting=meeting-one");
  assert.equal(hallSourcePath({collection: "weeklyMeetings", id: "../members/private"}), null);
  assert.equal(hallSourcePath({collection: "members", id: "member"}), null);
});

test("event source navigation uses the existing protected record route and rejects path injection", () => {
  assert.equal(hallSourcePath({collection: "events", id: "event-one"}), "/leader/events/event-one");
  assert.equal(hallSourcePath({collection: "events", id: "../members/private"}), null);
  assert.equal(hallSourcePath({collection: "events", id: "event?other=private"}), null);
});
