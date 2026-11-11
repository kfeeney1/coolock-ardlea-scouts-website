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
    if (path === "publicEvents/old-event" || path === "parentGalleryEvents/old-event") return { get: async () => ({ exists: false }) };
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

test("unauthenticated deletion is denied without any database access", async () => {
  await assert.rejects(handleEventDeletion({ doc: () => { throw new Error("database accessed"); } }, {}, { data: { action: "delete", eventId: "test" } }), /Sign in as Super Admin/);
});

test("inspection identifies hall and member audience evidence without allowing deletion", async () => {
  const db = { doc(path) {
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    if (path === "publicEvents/linked" || path === "parentGalleryEvents/linked") return { get: async () => ({ exists: false }) };
    assert.equal(path, "events/linked");
    return {
      get: async () => ({ exists: true, data: () => ({ title: "Linked", section: "Cubs", hallResource: "group-hall", audience: { memberIds: ["member-1"] } }) }),
      collection: () => ({ limit: () => ({ get: async () => ({ empty: true }) }) })
    };
  } };
  const bucket = { getFiles: async () => [[]] };
  const request = { auth: { uid: "root" }, data: { action: "inspect", eventId: "linked" } };
  const inspection = await handleEventDeletion(db, bucket, request);
  assert.ok(inspection.blockers.includes("hall booking association"));
  assert.ok(inspection.blockers.includes("member audience evidence"));
  await assert.rejects(handleEventDeletion(db, bucket, { ...request, data: { action: "delete", eventId: "linked" } }), /Deletion is blocked/);
});
