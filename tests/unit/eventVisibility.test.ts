import test from "node:test";
import assert from "node:assert/strict";
import { canViewEventByVisibility, isCanonicalEventVisibilityAdmin, isEventHidden } from "../../src/services/eventVisibility.ts";

const superAdmin = { active: true, role: "super-admin", sections: ["Group"] };

test("legacy and explicitly visible events remain visible", () => {
  assert.equal(isEventHidden({ title: "Legacy" }), false);
  assert.equal(canViewEventByVisibility({ hidden: false }, null), true);
  assert.equal(canViewEventByVisibility({ title: "Legacy" }, { role: "parent" }), true);
});

test("only canonical active Super Admin can view hidden events", () => {
  assert.equal(isCanonicalEventVisibilityAdmin(superAdmin), true);
  assert.equal(isCanonicalEventVisibilityAdmin({ active: true, role: "super-admin" }), true);
  assert.equal(isCanonicalEventVisibilityAdmin({ active: true, role: "super-admin", section: "Group" }), true);
  assert.equal(canViewEventByVisibility({ hidden: true }, superAdmin), true);
  for (const profile of [
    null, { active: true, role: "admin", sections: ["Group"] },
    { active: true, role: "leader", sections: ["Cubs"] },
    { active: false, role: "super-admin", sections: ["Group"] },
    { active: true, role: "super-admin ", sections: ["Group"] }
  ]) {
    assert.equal(canViewEventByVisibility({ hidden: true }, profile), false);
  }
});

test("only explicit boolean true hides an event", () => {
  for (const value of ["true", 1, null, undefined, false]) {
    assert.equal(isEventHidden({ hidden: value }), false);
  }
});
