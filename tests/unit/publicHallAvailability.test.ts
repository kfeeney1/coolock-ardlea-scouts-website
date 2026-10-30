import test from "node:test";
import assert from "node:assert/strict";
import { hallEnquiryLink, publicHallDay, publicHallTime } from "../../src/services/publicHallAvailability.ts";
import { hallVenueFacts } from "../../src/services/hallVenueFacts.ts";
const slot = (start: string, end: string) => ({start: `2026-11-05T${start}:00.000Z`, end: `2026-11-05T${end}:00.000Z`});
test("partial-day occupied slots leave exact unreserved ranges and adjacent slots merge", () => {
  const day = publicHallDay("2026-11-05", {occupied: [slot("20:00", "21:00"), slot("19:00", "20:00"), slot("10:00", "12:00")]});
  assert.deepEqual(day.occupied, [slot("10:00", "12:00"), slot("19:00", "21:00")]);
  assert.deepEqual(day.available, [slot("00:00", "10:00"), slot("12:00", "19:00"), {start: "2026-11-05T21:00:00.000Z", end: "2026-11-06T00:00:00.000Z"}]);
});
test("Dublin full-day availability respects 23/25-hour clock-change days and midnight labels", () => {
  for (const [date, hours] of [["2026-03-29", 23], ["2026-10-25", 25]] as const) {
    const day = publicHallDay(date), range = day.available[0];
    assert.equal(Date.parse(range.end) - Date.parse(range.start), hours * 3600000);
    assert.equal(publicHallTime(range.start, date), "00:00"); assert.equal(publicHallTime(range.end, date, true), "24:00");
    assert.deepEqual(publicHallDay(date, {occupied: [range]}).available, []);
  }
});
test("malformed/private/out-of-day availability fails closed rather than claiming free time", () => {
  for (const value of [{occupied: [], purpose: "Private"}, {occupied: [{...slot("10:00", "12:00"), hirer: "Private"}]}, {occupied: [{start: "2026-11-05", end: "2026-11-06"}]}, {occupied: [slot("12:00", "10:00")]}, {occupied: [{start: "2026-11-04T23:00:00.000Z", end: "2026-11-05T01:00:00.000Z"}]}, {occupied: "free"}]) assert.throws(() => publicHallDay("2026-11-05", value));
});
test("enquiry opens the published email address and explicitly does not confirm a booking", () => {
  const uri = new URL(hallEnquiryLink("group@example.com", "2026-11-05", "19:00", "20:00"));
  assert.equal(uri.protocol, "mailto:"); assert.equal(uri.pathname, "group@example.com");
  assert.match(uri.searchParams.get("subject")!, /05-11-2026/);
  assert.match(uri.searchParams.get("body")!, /does not confirm a booking/);
  assert.match(uri.searchParams.get("body")!, /19:00–20:00/);
  assert.throws(() => hallEnquiryLink("group@example.com?bcc=private@example.com", "2026-11-05"));
  assert.throws(() => hallEnquiryLink("group@example.com", "2026-11-05", "20:00", "19:00"));
});
test("unknown or unconfirmed venue facts are never presented as confirmed public content", () => {
  assert.equal(hallVenueFacts(), null); assert.equal(hallVenueFacts({confirmed: false, name: "Sample"}), null);
  assert.equal(hallVenueFacts({confirmed: true, name: "Sample", leaderNotes: "Private"}), null);
  assert.equal(hallVenueFacts({confirmed: true, imageUrl: "https://example.com/hall.jpg"}), null);
  assert.equal(hallVenueFacts({confirmed: true, imageUrl: "javascript:alert(1)", imageAlt: "Hall"}), null);
  assert.deepEqual(hallVenueFacts({confirmed: true, name: "Confirmed hall", facilities: ["Confirmed facility"]})?.facilities, ["Confirmed facility"]);
  assert.equal(hallVenueFacts({confirmed: true})?.address, "");
});
