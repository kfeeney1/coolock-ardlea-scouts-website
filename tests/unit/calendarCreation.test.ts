import assert from "node:assert/strict";
import test from "node:test";
import { calendarCreationDate } from "../../src/services/calendarCreation.ts";
import { calendarReturnPath } from "../../src/services/calendarSourceLogic.ts";
test("Calendar date hint accepts real dates only, independently of safe return context", () => {
  assert.equal(calendarCreationDate({calendarDate: "2040-02-29"}), "2040-02-29");
  for (const value of [null, {}, {calendarDate: 1}, {calendarDate: "2041-02-29"}, {calendarDate: "24-10-2026"}, {calendarDate: "2200-01-01"}]) assert.equal(calendarCreationDate(value), "");
  const context = {calendarDate: "2040-06-15", calendarReturnTo: "/calendar?month=2040-06&type=meeting&section=Scouts"};
  assert.equal(calendarReturnPath(context), context.calendarReturnTo);
  assert.equal(calendarReturnPath({...context, calendarReturnTo: "https://example.com"}), null);
});
