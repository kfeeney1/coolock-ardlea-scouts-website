import { test } from "node:test";
import assert from "node:assert/strict";
import { eventAudienceDates, eventParentProgramme } from "../../src/services/eventParentProgramme.ts";
import type { EventInput } from "../../src/services/eventAdmin.ts";
test("parent programme excludes Leader, participant and consent data while dates follow source publication", () => {
  const input = {title: " Camp ", description: " Programme ", eventType: "Camp", section: "Cubs", location: "Den", startDate: "2026-10-22", endDate: "2026-10-24", status: "open", leaderNotes: "Private", attendance: {other: "attending"}, consent: {other: "received"}} as unknown as EventInput;
  const programme = eventParentProgramme("source", input);
  assert.equal(programme.title, "Camp");
  assert.deepEqual(Object.keys(programme).sort(), ["eventId", "title", "description", "eventType", "section", "location", "startDate", "endDate", "status"].sort());
  assert.deepEqual(eventAudienceDates({...input, status: "draft"}), {startDate: input.startDate, endDate: input.endDate, programmeVisible: false});
  assert.equal(eventAudienceDates({...input, status: "completed"}).programmeVisible, true);
});
