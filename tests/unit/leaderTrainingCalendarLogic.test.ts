import test from "node:test";
import assert from "node:assert/strict";
import { trainingCalendarEntry } from "../../src/services/leaderTrainingCalendarLogic.ts";
import { trainingCategories } from "../../src/services/leaderTrainingLogic.ts";
import { calendarEntriesForDay } from "../../src/services/groupCalendar.ts";
test("renewals use canonical category identity, explicit lapse date and correct permitted destination", () => {
  for (const category of trainingCategories) {
    const record = {completedDate: "", expiryDate: "2040-06-15", revision: 1, showOnCalendar: true};
    const entry = trainingCalendarEntry("leader", "A Leader", category, record, false)!;
    assert.equal(entry.date, "2040-06-15"); assert.equal(entry.path, `/leader/access/leader#training-${category}`);
    assert.equal(trainingCalendarEntry("leader", "A Leader", category, {...record, expiryDate: "2040-06-16"}, false)!.id, entry.id);
    assert.equal(trainingCalendarEntry("leader", "A Leader", category, record, true)!.path, `/leader/profile#training-${category}`);
    assert.equal(calendarEntriesForDay([entry], "2040-06-15", "training", "Group").length, 1);
    assert.equal(calendarEntriesForDay([entry], "2040-06-16", "all", "").length, 0);
    for (const override of [{showOnCalendar: false}, {showOnCalendar: undefined}, {expiryDate: ""}, {expiryDate: "2040-02-30"}, {completedDate: "2041-01-01"}]) assert.equal(trainingCalendarEntry("leader", "A Leader", category, {...record, ...override}, false), null);
  }
});
