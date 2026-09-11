import assert from "node:assert/strict";
import test from "node:test";
import { effectivePermissionsFor, PERMISSION_REGISTRY } from "../../src/security/permissionRegistry.ts";

test("permission registry uses stable unique identifiers and enforcement locations", () => {
  const ids = PERMISSION_REGISTRY.map((permission) => permission.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(PERMISSION_REGISTRY.every((permission) => permission.enforcement.length > 0));
  assert.ok(PERMISSION_REGISTRY.every((permission) => permission.protected));
});

test("ordinary leader does not gain admin or appointment-only group permissions", () => {
  const ids = new Set(effectivePermissionsFor("leader", "Scouter").map((permission) => permission.id));
  assert.ok(ids.has("members.read.section"));
  assert.ok(ids.has("members.write.section"));
  assert.ok(ids.has("equipment.read.group"));
  assert.ok(ids.has("equipment.loan.section"));
  assert.ok(ids.has("event-gallery.manage.section"));
  assert.equal(ids.has("roles.manage.admin"), false);
  assert.equal(ids.has("finance.manage.group"), false);
  assert.equal(ids.has("programme.manage.group"), false);
  assert.equal(ids.has("event-gallery.manage.group"), false);
  assert.equal(ids.has("audit.read"), false);
});

test("Group Leader appointment adds the effective group-wide Rules bundle without admin promotion", () => {
  const ids = new Set(effectivePermissionsFor("leader", "Group Leader").map((permission) => permission.id));
  assert.ok(ids.has("members.read.group"));
  assert.ok(ids.has("weekly-meetings.manage.group"));
  assert.ok(ids.has("meeting-records.read.group"));
  assert.ok(ids.has("programme.manage.group"));
  assert.ok(ids.has("event-gallery.manage.group"));
  assert.ok(ids.has("badgework.manage.group"));
  assert.ok(ids.has("finance.manage.group"));
  assert.ok(ids.has("equipment.manage"));
  assert.ok(ids.has("audit.read"));
  assert.equal(ids.has("roles.manage.admin"), false);
});

test("Group Secretary is read-oriented group-wide and does not inherit Group Leader writes", () => {
  const ids = new Set(effectivePermissionsFor("leader", "Group Secretary").map((permission) => permission.id));
  assert.ok(ids.has("members.read.group"));
  assert.ok(ids.has("meeting-records.read.group"));
  assert.ok(ids.has("badgework.read.group"));
  assert.ok(ids.has("audit.read"));
  assert.equal(ids.has("weekly-meetings.manage.group"), false);
  assert.equal(ids.has("programme.manage.group"), false);
  assert.equal(ids.has("badgework.manage.group"), false);
});

test("only Super Admin receives admin promotion permission", () => {
  assert.equal(effectivePermissionsFor("admin", "").some((permission) => permission.id === "roles.manage.admin"), false);
  assert.equal(effectivePermissionsFor("super-admin", "").some((permission) => permission.id === "roles.manage.admin"), true);
});

test("Super Admin receives every administrative and operational permission regardless of Scouting appointment", () => {
  const ids = new Set(effectivePermissionsFor("super-admin", "").map((permission) => permission.id));
  const expected = PERMISSION_REGISTRY
    .filter((permission) => permission.grantedBy.some((grant) => grant !== "parent"))
    .map((permission) => permission.id);

  assert.deepEqual([...ids].sort(), expected.sort());
  assert.ok(ids.has("weekly-meetings.manage.group"));
  assert.ok(ids.has("programme.manage.group"));
  assert.ok(ids.has("event-gallery.manage.group"));
  assert.ok(ids.has("badgework.manage.group"));
  assert.ok(ids.has("roles.delegate.operational"));
  assert.ok(ids.has("roles.manage.admin"));
  assert.ok(ids.has("system.superadmin.protect"));
  assert.equal(ids.has("members.read.linked"), false);
  assert.equal(ids.has("badgework.read.linked"), false);
});
