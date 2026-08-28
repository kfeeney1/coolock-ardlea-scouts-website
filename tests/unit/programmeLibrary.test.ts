import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanProgrammeLibraryInput,
  filterProgrammeLibrary,
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

test("filters programme library across names, notes, equipment and leaders", () => {
  const items = [
    base,
    { ...base, id: "two", name: "Relay", leader: "Sam Scouter", equipment: "Batons", durationMinutes: 10 },
    { ...base, id: "three", kind: "badgework" as const, name: "Pioneering", notes: "Practice square lashings", equipment: "Rope", durationMinutes: 40 }
  ];
  assert.deepEqual(filterProgrammeLibrary(items, { search: "rope" }).map((item) => item.id), ["three"]);
  assert.deepEqual(filterProgrammeLibrary(items, { search: "sam" }).map((item) => item.id), ["two"]);
});

test("filters programme library by type and useful duration bands", () => {
  const items = [
    { ...base, id: "quick", name: "Quick Game", durationMinutes: 15 },
    { ...base, id: "standard", name: "Standard Game", durationMinutes: 30 },
    { ...base, id: "long", kind: "badgework" as const, name: "Long Badge", durationMinutes: 45 }
  ];
  assert.deepEqual(filterProgrammeLibrary(items, { duration: "quick" }).map((item) => item.id), ["quick"]);
  assert.deepEqual(filterProgrammeLibrary(items, { duration: "standard" }).map((item) => item.id), ["standard"]);
  assert.deepEqual(filterProgrammeLibrary(items, { duration: "long", kind: "badgework" }).map((item) => item.id), ["long"]);
});
