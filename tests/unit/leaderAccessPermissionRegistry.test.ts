import assert from "node:assert/strict";
import test from "node:test";
import { effectivePermissionsFor } from "../../src/security/permissionRegistry.ts";

function ids(role: string, appointment: string) {
  return new Set(effectivePermissionsFor(role, appointment).map((permission) => permission.id));
}

test("Group Leader and Deputy Group Leader receive delegated assignment permission without Admin management", () => {
  for (const appointment of ["Group Leader", "Deputy Group Leader"]) {
    const permissions = ids("leader", appointment);
    assert.equal(permissions.has("roles.delegate.operational"), true);
    assert.equal(permissions.has("roles.manage.operational"), false);
    assert.equal(permissions.has("roles.manage.admin"), false);
    assert.equal(permissions.has("system.superadmin.protect"), false);
  }
});

test("Admin keeps ordinary access management while Super Admin alone keeps system-role promotion", () => {
  const admin = ids("admin", "");
  const superAdmin = ids("super-admin", "");
  assert.equal(admin.has("roles.manage.operational"), true);
  assert.equal(admin.has("roles.manage.admin"), false);
  assert.equal(superAdmin.has("roles.manage.operational"), true);
  assert.equal(superAdmin.has("roles.manage.admin"), true);
});
