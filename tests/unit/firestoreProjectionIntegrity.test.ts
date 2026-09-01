import assert from "node:assert/strict";
import test from "node:test";

import { validateProjectionIntegrity } from "../../scripts/firestore-projection-integrity.mjs";

const map = (entries: Record<string, Record<string, unknown>>) => new Map(Object.entries(entries));

function validCollections() {
  return new Map([
    ["programmeLibrary", map({ p1: { kind: "activity", section: "Cubs", name: "Game", leader: "", notes: "", equipment: "", durationMinutes: 15 } })],
    ["weeklyMeetings", map({ w1: { section: "Cubs", meetingDate: "2026-09-08" } })],
    ["parentWeeklyMeetings", map({ w1: { section: "Cubs", meetingDate: "2026-09-08", status: "open", activities: [], badgework: [] } })],
    ["events", map({ e1: { title: "Camp", eventType: "Camp", section: "Scouts", startDate: "2026-09-10", endDate: "2026-09-12", status: "open" } })],
    ["parentGalleryEvents", map({ e1: { eventId: "e1", title: "Camp", eventType: "Camp", section: "Scouts", startDate: "2026-09-10", endDate: "2026-09-12", status: "open" } })],
    ["siteSettings", map({ session: { parentInactivityMinutes: 20, leaderDesktopInactivityMinutes: 20, leaderPhoneInactivityMinutes: 90, updatedBy: "admin1" } })]
  ]);
}

test("accepts current parent projections, programme items and settings", () => {
  assert.deepEqual(validateProjectionIntegrity(validCollections()), []);
});

test("reports orphaned and drifted projections plus invalid settings", () => {
  const collections = validCollections();
  collections.get("parentWeeklyMeetings")!.get("w1")!.section = "Scouts";
  collections.get("parentGalleryEvents")!.get("e1")!.status = "draft";
  collections.get("programmeLibrary")!.get("p1")!.durationMinutes = 500;
  collections.get("siteSettings")!.get("session")!.parentInactivityMinutes = 1;
  collections.get("parentGalleryEvents")!.set("orphan", { eventId: "orphan" });

  const errors = validateProjectionIntegrity(collections);
  assert.ok(errors.some((error: string) => error.includes("section differs from source meeting")));
  assert.ok(errors.some((error: string) => error.includes("status differs from source event")));
  assert.ok(errors.some((error: string) => error.includes("durationMinutes")));
  assert.ok(errors.some((error: string) => error.includes("parentInactivityMinutes")));
  assert.ok(errors.some((error: string) => error.includes("has no events source")));
});
