import assert from "node:assert/strict";
import test from "node:test";

import {
  completeStageDraft,
  draftSelectionState,
  setDraftRequirement
} from "../../src/services/adventureSkillDraftLogic.ts";

test("draft selection falls back to persisted mixed state until changed", () => {
  const draft = new Map<string, boolean>();
  assert.equal(draftSelectionState(draft, "req-1", "some"), "some");

  const completed = setDraftRequirement(draft, "req-1", true);
  assert.equal(draftSelectionState(completed, "req-1", "some"), "all");

  const cleared = setDraftRequirement(completed, "req-1", false);
  assert.equal(draftSelectionState(cleared, "req-1", "some"), "none");
});

test("full stage completion adds every stage requirement to the draft", () => {
  const initial = new Map<string, boolean>([["existing", false]]);
  const draft = completeStageDraft(initial, ["req-1", "req-2", "req-3"]);

  assert.equal(draft.get("existing"), false);
  assert.equal(draft.get("req-1"), true);
  assert.equal(draft.get("req-2"), true);
  assert.equal(draft.get("req-3"), true);
  assert.equal(draft.size, 4);
});

test("draft helpers do not mutate the previous map", () => {
  const original = new Map<string, boolean>([["req-1", true]]);
  const changed = setDraftRequirement(original, "req-2", false);

  assert.equal(original.has("req-2"), false);
  assert.equal(changed.get("req-2"), false);
});
