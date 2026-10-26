import test from "node:test";
import assert from "node:assert/strict";
import { weeklyMeetingPlanSources } from "../../src/services/weeklyMeetingPlanSources.ts";
import { decodeWeeklyBadgeworkSources } from "../../src/services/weeklyTrackerLogic.ts";
const legacy = { theme: "Old theme", programmeNotes: "Old notes", plannedActivities: "Old activity" };
test("canonical saved programme supersedes mixed legacy fields and preserves deliberate clearing", () => {
  const rawActivity = [{ id: "one", activity: "Old activity" }];
  const plannedActivities = JSON.stringify({ marker: "weekly-activities-v1", items: [] });
  const plannedBadgework = JSON.stringify({ marker: "weekly-badgework-v1", authoritative: true, items: [] });
  const data = { theme: "Stale theme", activities: rawActivity, badgeworkPlan: [{ id: "old", badge: "Stale badge" }], plannedActivities, plannedBadgework, programmeNotes: JSON.stringify({ marker: "weekly-programme-v1", theme: "", notes: "" }) };
  const plan = weeklyMeetingPlanSources(data, legacy);
  assert.equal(plan.theme, ""); assert.equal(plan.programmeNotes, ""); assert.equal(plan.activitySource, plannedActivities);
  assert.deepEqual(decodeWeeklyBadgeworkSources(plan.badgeworkSources), []);
  assert.deepEqual(data.activities, rawActivity); assert.equal(data.theme, "Stale theme");
});
test("unmarked legacy fields retain fallback compatibility and malformed marked values cannot suppress raw rows", () => {
  const activities = [{ activity: "Legacy raw activity" }]; const badgeworkPlan = [{ badge: "Legacy badge" }];
  const data = { theme: " Raw theme ", activities, badgeworkPlan, programmeNotes: "Legacy programme notes", plannedActivities: '{"marker":"weekly-activities-v1","items":null}', plannedBadgework: '{"marker":"weekly-badgework-v1","items":null}' };
  const plan = weeklyMeetingPlanSources(data, legacy);
  assert.equal(plan.theme, "Raw theme"); assert.equal(plan.programmeNotes, "Legacy programme notes"); assert.equal(plan.activitySource, activities); assert.equal(plan.badgeworkSources, data);
  assert.equal(weeklyMeetingPlanSources({}, legacy).activitySource, "Old activity");
});

test("historical mixed Badgework sources remain merged until an explicit complete canonical save", () => {
  const data = { badgework: [{ badgeName: "Pioneering" }], plannedBadgework: JSON.stringify({ marker: "weekly-badgework-v1", items: [{ badge: "Navigation" }] }) };
  const plan = weeklyMeetingPlanSources(data, legacy);
  assert.equal(plan.canonicalBadgework, false);
  assert.deepEqual(decodeWeeklyBadgeworkSources(plan.badgeworkSources).map(item => item.badge), ["Navigation", "Pioneering"]);
});
