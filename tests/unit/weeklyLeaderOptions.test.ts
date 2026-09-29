import assert from "node:assert/strict";
import test from "node:test";
import { weeklyLeaderOptionsFromProfiles } from "../../src/services/weeklyLeaderOptions.ts";

test("weekly leaders use active appointments for each requested section", () => {
  const leaders = weeklyLeaderOptionsFromProfiles([
    { id: "multi", data: { active: true, displayName: "Alex Multi", appointments: [
      { appointment: "Scouter", scope: "Beavers", active: true },
      { appointment: "Assistant Section Leader", scope: "Cubs", active: true }
    ] } },
    { id: "group-and-section", data: { active: true, displayName: "Blair Group", appointments: [
      { appointment: "Group Leader", scope: "Group", active: true },
      { appointment: "Programme Scouter", scope: "Scouts", active: true }
    ] } },
    { id: "inactive-appointment", data: { active: true, displayName: "Casey Former", appointments: [
      { appointment: "Scouter", scope: "Cubs", active: false }
    ] } },
    { id: "expired-appointment", data: { active: true, displayName: "Drew Expired", appointments: [
      { appointment: "Section Leader", scope: "Cubs", active: true, endDate: "2020-01-01" }
    ] } },
    { id: "inactive-leader", data: { active: false, displayName: "Elliot Inactive", appointments: [
      { appointment: "Section Leader", scope: "Cubs", active: true }
    ] } },
    { id: "out-of-scope", data: { active: true, displayName: "Finley Other", appointments: [
      { appointment: "Section Leader", scope: "Ventures", active: true }
    ] } }
  ], ["Cubs", "Scouts"], false);

  assert.deepEqual(leaders.map(({ id, organisationSection }) => [id, organisationSection]), [
    ["multi", "Cubs"],
    ["group-and-section", "Scouts"]
  ]);
});

test("group-wide viewers receive the same eligible roster regardless of their own section", () => {
  const profiles = [
    { id: "beavers", data: { active: true, displayName: "Beavers Leader", appointments: [{ appointment: "Section Leader", scope: "Beavers" }] } },
    { id: "rover", data: { active: true, displayName: "Rover Leader", appointments: [{ appointment: "Scouter", scope: "Rovers" }] } }
  ];
  assert.deepEqual(
    weeklyLeaderOptionsFromProfiles(profiles, ["Beavers"], true).map(({ id, organisationSection }) => [id, organisationSection]),
    [["beavers", "Beavers"], ["rover", "Rovers"]]
  );
});
