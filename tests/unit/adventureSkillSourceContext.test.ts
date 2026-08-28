import assert from "node:assert/strict";
import test from "node:test";

import {
  badgeworkSourceContextFromParams,
  badgeworkSourceHref,
  sourceBacklink,
  sourceLabel
} from "../../src/services/adventureSkillSourceContext.ts";

test("weekly meeting handoff keeps source, attendees and backlink", () => {
  const href = badgeworkSourceHref({
    sourceType: "weeklyMeeting",
    sourceId: "meeting-123",
    memberIds: ["member-a", "member-b", "member-a"],
    returnTo: "/leader/weekly?meeting=meeting-123"
  });
  const query = href.slice(href.indexOf("?") + 1);
  const context = badgeworkSourceContextFromParams(new URLSearchParams(query));
  assert.deepEqual(context, {
    sourceType: "weeklyMeeting",
    sourceId: "meeting-123",
    memberIds: ["member-a", "member-b"],
    returnTo: "/leader/weekly?meeting=meeting-123"
  });
});

test("event and activity sources link back to their event record", () => {
  assert.equal(sourceBacklink("event", "event 1"), "/leader/events?event=event%201");
  assert.equal(sourceBacklink("activity", "event 2"), "/leader/events?event=event%202");
  assert.equal(sourceLabel("activity"), "Activity");
});

test("manual, migration and malformed source contexts are not accepted as handoffs", () => {
  assert.equal(badgeworkSourceContextFromParams(new URLSearchParams("sourceType=manual&sourceId=x")), null);
  assert.equal(badgeworkSourceContextFromParams(new URLSearchParams("sourceType=migration&sourceId=x")), null);
  assert.equal(badgeworkSourceContextFromParams(new URLSearchParams("sourceType=weeklyMeeting")), null);
});

test("unsafe return targets are replaced with canonical leader backlinks", () => {
  const context = badgeworkSourceContextFromParams(new URLSearchParams("sourceType=event&sourceId=e1&returnTo=https%3A%2F%2Fevil.example"));
  assert.equal(context?.returnTo, "/leader/events?event=e1");
});
