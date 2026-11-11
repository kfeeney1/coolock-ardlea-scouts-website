import test from "node:test";
import assert from "node:assert/strict";
import { isCanonicalSuperAdmin, handleEventDeletion } from "../src/eventDeletion.js";

test("only active canonical Super Admin is authorised", () => {
  assert.equal(isCanonicalSuperAdmin({ active: true, role: "super-admin", sections: ["Group"] }), true);
  for (const profile of [
    { active: false, role: "super-admin", sections: ["Group"] },
    { active: true, role: "admin", sections: ["Group"] },
    { active: true, role: "leader", sections: ["Group"] },
    { active: true, role: "super-admin", sections: [] },
    { active: true, role: "super-admin", sections: ["Group"], section: "Group" },
    null
  ]) assert.equal(isCanonicalSuperAdmin(profile), false);
});

test("crafted requests from non-Super Admin are denied before event lookup", async () => {
  const db = { doc(path) {
    assert.equal(path, "adminUsers/attacker");
    return { get: async () => ({ data: () => ({ active: true, role: "admin", sections: ["Group"] }) }) };
  } };
  await assert.rejects(handleEventDeletion(db, {}, { auth: { uid: "attacker" }, data: { action: "delete", eventId: "test-event" } }), /Super Admin access required/);
});

test("even clean-looking events cannot be deleted before external evidence reconciliation", async () => {
  const db = { doc(path) {
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    assert.equal(path, "events/old-event");
    return {
      get: async () => ({ exists: true, data: () => ({ title: "Old event", section: "Cubs", attendance: {}, consent: {} }) }),
      collection: () => ({ limit: () => ({ get: async () => ({ empty: true }) }) })
    };
  } };
  const bucket = { getFiles: async () => [[]] };
  const auth = { auth: { uid: "root" }, data: { action: "delete", eventId: "old-event" } };
  await assert.rejects(handleEventDeletion(db, bucket, auth), /Deletion is blocked/);
  const inspection = await handleEventDeletion(db, bucket, { ...auth, data: { ...auth.data, action: "inspect" } });
  assert.ok(inspection.blockers.includes("cross-collection evidence verification pending"));
});
