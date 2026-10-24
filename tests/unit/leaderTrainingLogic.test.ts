import test from "node:test";
import assert from "node:assert/strict";
import { trainingCategories, trainingDatesError, trainingStatus } from "../../src/services/leaderTrainingLogic.ts";

test("all training categories handle empty, partial and explicit dates without assumed renewal periods", () => {
  assert.equal(trainingCategories.length, 3);
  for (const category of trainingCategories) {
    assert.equal(trainingStatus(undefined, "2026-10-24"), "Not recorded", category);
    assert.equal(trainingStatus({ completedDate: "", expiryDate: "" }, "2026-10-24"), "Not recorded");
    assert.equal(trainingStatus({ completedDate: "2026-10-01", expiryDate: "" }, "2026-10-24"), "Incomplete");
    assert.equal(trainingStatus({ completedDate: "", expiryDate: "2027-01-01" }, "2026-10-24"), "Incomplete");
    assert.equal(trainingStatus({ completedDate: "2027-01-01", expiryDate: "2027-01-02" }, "2026-10-24"), "Incomplete");
  }
});
test("expiry is current through its date, expired the next day, including year and leap boundaries", () => {
  for (const [expiry, next] of [["2026-12-31", "2027-01-01"], ["2024-02-29", "2024-03-01"], ["2026-10-24", "2026-10-25"]]) {
    const record = { completedDate: "2024-01-01", expiryDate: expiry };
    assert.equal(trainingStatus(record, expiry), "Current");
    assert.equal(trainingStatus(record, next), "Expired");
  }
});
test("validation rejects invalid calendar dates, timestamps and reversed ordering; partial records remain explicit", () => {
  for (const value of ["2026-02-29", "2026-04-31", "24-10-2026", "2026-10-24T00:00:00Z", "junk"]) {
    assert.ok(trainingDatesError({ completedDate: value, expiryDate: "" }));
    assert.ok(trainingDatesError({ completedDate: "", expiryDate: value }));
  }
  assert.ok(trainingDatesError({ completedDate: "2026-10-25", expiryDate: "2026-10-24" }));
  for (const dates of [{ completedDate: "", expiryDate: "" }, { completedDate: "2026-10-24", expiryDate: "" }, { completedDate: "", expiryDate: "2026-10-24" }, { completedDate: "2026-10-24", expiryDate: "2026-10-24" }]) assert.equal(trainingDatesError(dates), "");
});
