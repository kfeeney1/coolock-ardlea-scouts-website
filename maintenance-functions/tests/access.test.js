import assert from "node:assert/strict";
import test from "node:test";
import { activeLeader, groupMember } from "../src/access.js";
function database(leader, parent, linked = false) {
  return { doc(path) { return { async get() { return { data: () => path.startsWith("adminUsers/") ? leader : parent }; } }; }, collection() { return { where() { return this; }, limit() { return this; }, async get() { return { empty: !linked }; } }; } };
}
test("membership uses active canonical leader, approved parent or active account-linked member", async () => {
  for (const role of ["leader", "admin", "super-admin"]) assert.equal(await groupMember(database({active: true, role, sections: ["Group"]}), "a"), true);
  assert.equal(await groupMember(database(null, {status: "approved"}), "a"), true);
  assert.equal(await groupMember(database(null, null, true), "a"), true);
  for (const role of [undefined, "parent", "unknown"]) assert.equal(activeLeader({active: true, role, sections: ["Group"]}), false);
  assert.equal(activeLeader({active: true, role: "leader", section: "Scouts", sections: ["Scouts"]}), false);
  for (const parent of [null, {status: "pending"}, {status: "revoked"}]) assert.equal(await groupMember(database({active: false, role: "leader", sections: ["Scouts"]}, parent), "a"), false);
});
