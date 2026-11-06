import assert from "node:assert/strict";
import test from "node:test";
import { settingsAccessFor, type SettingsArea } from "../../src/security/settingsAccess.ts";
import { CANONICAL_SCOUTING_APPOINTMENTS } from "../../src/security/scoutingAppointments.ts";
import { CURRENT_SCOUTING_APPOINTMENTS } from "../../src/security/permissionRegistry.ts";

const areas: SettingsArea[] = ["session", "features", "subs", "equipment", "maintenance-directory", "monitoring"];
const visible = (role: string, scoutingRole = "", appointments?: unknown) => areas.filter(area => settingsAccessFor({ role, scoutingRole, appointments }, area).view);

test("approved Settings matrix covers every canonical appointment without title-based oversight", () => {
  assert.deepEqual(CURRENT_SCOUTING_APPOINTMENTS, CANONICAL_SCOUTING_APPOINTMENTS);
  for (const appointment of CANONICAL_SCOUTING_APPOINTMENTS) {
    const expected = ["Group Leader", "Deputy Group Leader"].includes(appointment) ? ["subs", "equipment"]
      : appointment === "Group Treasurer" ? ["subs"]
      : appointment === "Group Quartermaster / Bo'sun" ? ["equipment"] : [];
    assert.deepEqual(visible("leader", appointment), expected, appointment);
  }
});

test("system grants preserve Admin limits and monitoring is explicitly read-only", () => {
  assert.deepEqual(visible("admin"), ["session", "subs", "equipment", "maintenance-directory"]);
  assert.deepEqual(visible("super-admin"), areas);
  const monitoring = settingsAccessFor({ role: "super-admin", scoutingRole: "" }, "monitoring");
  assert.equal(monitoring.menu, true);
  for (const action of ["edit", "create", "delete", "reset"] as const) assert.equal(monitoring[action], false);
  for (const role of ["leader", "admin", "super-admin"]) for (const area of areas) {
    const access = settingsAccessFor({ role, scoutingRole: "Group Leader" }, area);
    assert.equal(access.delete, false);
    assert.equal(access.reset, false);
  }
});

test("parent, unknown and missing identities never inherit Settings from appointment labels", () => {
  for (const role of ["parent", "member", "unknown", ""]) assert.deepEqual(visible(role, "Group Leader"), []);
  for (const area of areas) assert.equal(settingsAccessFor(null, area).view, false);
  assert.equal(settingsAccessFor({ role: "super-admin", scoutingRole: "" }, "constructor" as SettingsArea).view, false);
});

test("all valid appointments union without duplication and removal retains overlapping grants", () => {
  const appointments = [
    { appointment: "Group Treasurer", scope: "Group", active: true },
    { appointment: "Group Quartermaster / Bo'sun", scope: "Group", active: true },
    { appointment: "Group Leader", scope: "Group", active: true }
  ];
  assert.deepEqual(visible("leader", "", appointments), ["subs", "equipment"]);
  assert.deepEqual(visible("leader", "", appointments.slice(0, 2)), ["subs", "equipment"]);
  assert.deepEqual(visible("leader", "", appointments.slice(0, 1)), ["subs"]);
  const lateSlot = Array.from({ length: 11 }, (_, i) => ({ appointment: "Scouter", scope: `Section ${i}`, active: true }));
  assert.deepEqual(visible("leader", "", [...lateSlot, appointments[0]]), ["subs"]);
});

test("inactive, future, expired and section-scoped assignments cannot revive legacy authority", () => {
  for (const state of [{ active: false }, { active: true, startDate: "2999-01-01" }, { active: true, endDate: "2000-01-01" }, { active: true, scope: "Cubs" }]) {
    assert.deepEqual(visible("leader", "Group Leader", [{ appointment: "Group Leader", scope: "Group", ...state }]), []);
    assert.ok(visible("admin", "Group Leader", [{ appointment: "Group Leader", scope: "Group", ...state }]).includes("session"));
  }
});
