import test from "node:test";
import assert from "node:assert/strict";
import { hallInstant, hallInterval } from "../../src/services/hallBookingTime.ts";
import { hallOccurrences, hallOverlaps, publicHallOccupied, type HallBooking } from "../../src/services/hallBookingDomain.ts";

const booking = (changes: Partial<HallBooking> = {}): HallBooking => ({id: "booking-one", resourceId: "group-hall", kind: "internal", state: "confirmed", interval: {date: "2026-03-22", startTime: "19:00", endDate: "2026-03-22", endTime: "20:00"}, ...changes});

test("weekly bookings retain Dublin wall time across spring and autumn DST", () => {
  const spring = hallOccurrences(booking({recurrence: {frequency: "weekly", until: "2026-04-05"}}));
  assert.deepEqual(spring.map(value => new Date(value.start).toISOString()), ["2026-03-22T19:00:00.000Z", "2026-03-29T18:00:00.000Z", "2026-04-05T18:00:00.000Z"]);
  const autumn = hallOccurrences(booking({interval: {date: "2026-10-18", startTime: "19:00", endDate: "2026-10-18", endTime: "20:00"}, recurrence: {frequency: "weekly", until: "2026-11-01"}}));
  assert.deepEqual(autumn.map(value => new Date(value.start).getUTCHours()), [18, 19, 19]);
});

test("reject nonexistent and ambiguous Dublin local times, including later occurrences", () => {
  for (const date of ["2026-03-29", "2026-10-25"]) assert.throws(() => hallInstant(date, "01:30"), /clock change/);
  assert.throws(() => hallOccurrences(booking({interval: {date: "2026-03-22", startTime: "01:30", endDate: "2026-03-22", endTime: "03:00"}, recurrence: {frequency: "weekly", until: "2026-03-29"}})), /clock change/);
  // A deliberate exception can cancel the occurrence in the gap.
  assert.equal(hallOccurrences(booking({interval: {date: "2026-03-22", startTime: "01:30", endDate: "2026-03-22", endTime: "03:00"}, recurrence: {frequency: "weekly", until: "2026-03-29"}, exceptions: [{date: "2026-03-29", action: "cancel"}]})).length, 1);
});

test("weekly recurrence is inclusive, bounded and rejects invalid dates", () => {
  assert.equal(hallOccurrences(booking({recurrence: {frequency: "weekly", until: "2026-03-28"}})).length, 1);
  assert.equal(hallOccurrences(booking({recurrence: {frequency: "weekly", until: "2027-03-23"}})).length, 53);
  for (const until of ["2026-03-21", "2027-03-24", "2026-02-30", "2099-99-99"]) assert.throws(() => hallOccurrences(booking({recurrence: {frequency: "weekly", until}})));
  for (const [date, time] of [["2026-02-30", "19:00"], ["2026-3-22", "19:00"], ["1999-12-31", "19:00"], ["2026-03-22", "24:00"], ["2026-03-22", "9:00"]]) assert.throws(() => hallInstant(date, time));
});

test("one occurrence can be moved or cancelled without changing the series", () => {
  const input = booking({recurrence: {frequency: "weekly", until: "2026-04-05"}, exceptions: [{date: "2026-03-29", action: "cancel"}, {date: "2026-04-05", action: "replace", interval: {date: "2026-04-06", startTime: "18:00", endDate: "2026-04-06", endTime: "19:00"}}]});
  const before = JSON.stringify(input), occurrences = hallOccurrences(input);
  assert.deepEqual(occurrences.map(value => value.occurrenceDate), ["2026-03-22", "2026-04-05"]);
  assert.equal(new Date(occurrences[1].start).toISOString(), "2026-04-06T17:00:00.000Z");
  assert.equal(JSON.stringify(input), before);
  for (const exceptions of [[{date: "2026-03-23", action: "cancel" as const}], [{date: "2026-03-22", action: "cancel" as const}, {date: "2026-03-22", action: "cancel" as const}]]) assert.throws(() => hallOccurrences(booking({recurrence: {frequency: "weekly", until: "2026-04-05"}, exceptions})), /unique occurrence/);
});

test("moved occurrences cannot overlap their series or escape the bounded window", () => {
  for (const date of ["2026-03-22", "2028-04-05"]) assert.throws(() => hallOccurrences(booking({recurrence: {frequency: "weekly", until: "2026-04-05"}, exceptions: [{date: "2026-04-05", action: "replace", interval: {date, startTime: "19:00", endDate: date, endTime: "20:00"}}]})));
});

test("half-open intervals allow adjacency and detect contained and partial overlaps", () => {
  const a = {start: 10, end: 20};
  assert.equal(hallOverlaps(a, {start: 20, end: 30}), false);
  assert.equal(hallOverlaps(a, {start: 0, end: 10}), false);
  for (const b of [{start: 10, end: 20}, {start: 11, end: 12}, {start: 5, end: 15}, {start: 5, end: 25}]) assert.equal(hallOverlaps(a, b), true);
});

test("overnight intervals use real DST duration and reject zero, backwards or excessive duration", () => {
  const value = hallInterval({date: "2026-03-28", startTime: "23:00", endDate: "2026-03-29", endTime: "03:00"});
  assert.equal(value.end - value.start, 3 * 3_600_000);
  for (const interval of [{...booking().interval, endTime: "19:00"}, {...booking().interval, endTime: "18:00"}, {...booking().interval, endDate: "2026-03-30"}]) assert.throws(() => hallInterval(interval));
});

test("public projection is an exact allowlist; drafts and cancellations release occupancy", () => {
  const privateBooking = {...booking(), purpose: "Secret programme", hirer: "Private person", email: "private@example.com", leaderNotes: "Private notes", memberIds: ["protected-member"]};
  assert.deepEqual(publicHallOccupied([privateBooking, booking({state: "draft"}), booking({state: "cancelled"})]), [{start: "2026-03-22T19:00:00.000Z", end: "2026-03-22T20:00:00.000Z"}]);
  for (const kind of ["external", "blocked"] as const) assert.equal(hallOccurrences(booking({kind})).length, 1);
  assert.throws(() => hallOccurrences(booking({resourceId: "other-resource" as "group-hall"})));
});
