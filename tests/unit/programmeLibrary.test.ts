import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanProgrammeLibraryInput,
  isProgrammeLibraryItemForSection,
  programmeLibraryItemToActivity,
  programmeLibraryItemToBadgework,
  sortProgrammeLibrary
} from "../../src/services/programmeLibrary.ts";

const base = {
  id: "template-1",
  kind: "activity" as const,
  section: "Scouts",
  name: "Wide game",
  leader: "Alex Leader",
  notes: "Use the full hall.",
  equipment: "Cones, bibs",
  durationMinutes: 25
};

test("cleans programme library inputs to weekly meeting field limits", () => {
  const cleaned = cleanProgrammeLibraryInput({
    kind: "activity",
    section: " Scouts ",
    name: " Wide game ",
    leader: " Alex Leader ",
    notes: " Notes ",
    equipment: " Cones ",
    durationMinutes: 999
  });
  assert.equal(cleaned.section, "Scouts");
  assert.equal(cleaned.name, "Wide game");
  assert.equal(cleaned.durationMinutes, 360);
});

test("converts a saved activity into a fresh weekly activity item", () => {
  const first = programmeLibraryItemToActivity(base);
  const second = programmeLibraryItemToActivity(base);
  assert.equal(first.activity, base.name);
  assert.equal(first.leader, base.leader);
  assert.equal(first.notes, base.notes);
  assert.equal(first.equipment, base.equipment);
  assert.equal(first.durationMinutes, base.durationMinutes);
  assert.notEqual(first.id, base.id);
  assert.notEqual(first.id, second.id);
});

test("converts badgework without carrying meeting state", () => {
  const badge = programmeLibraryItemToBadgework({ ...base, kind: "badgework", name: "Adventure Skills" });
  assert.deepEqual(
    { badge: badge.badge, leader: badge.leader, notes: badge.notes, equipment: badge.equipment, durationMinutes: badge.durationMinutes },
    { badge: "Adventure Skills", leader: base.leader, notes: base.notes, equipment: base.equipment, durationMinutes: base.durationMinutes }
  );
});

test("keeps programme library items section-scoped and sorted", () => {
  assert.equal(isProgrammeLibraryItemForSection(base, "Scouts"), true);
  assert.equal(isProgrammeLibraryItemForSection(base, "Cubs"), false);
  const sorted = sortProgrammeLibrary([
    { ...base, id: "b", kind: "badgework", name: "Pioneering" },
    { ...base, id: "a", kind: "activity", name: "Relay" },
    { ...base, id: "c", kind: "activity", name: "Capture the Flag" }
  ]);
  assert.deepEqual(sorted.map((item) => item.name), ["Capture the Flag", "Relay", "Pioneering"]);
});
