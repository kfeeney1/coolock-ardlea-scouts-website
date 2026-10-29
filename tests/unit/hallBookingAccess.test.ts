import test from "node:test";
import assert from "node:assert/strict";
import { canManageHallBookings } from "../../src/security/hallBookingAccess.ts";
import { CANONICAL_SCOUTING_APPOINTMENTS } from "../../src/security/scoutingAppointments.ts";
import { effectivePermissionsFor } from "../../src/security/permissionRegistry.ts";
const account = {active: true, role: "leader", sections: ["Cubs"]};
const organisation = (appointment: string) => ({active: true, appointments: [{appointment, scope: "Cubs", active: true}]});
test("permission catalogue does not imply a Superuser-only Council override", () => {
  for (const role of ["leader", "admin", "super-admin"]) {
    assert.equal(effectivePermissionsFor(role, "Scouter").some(permission => permission.id === "hall.bookings.manage"), false);
    assert.equal(effectivePermissionsFor(role, "Assistant Section Leader").some(permission => permission.id === "hall.bookings.manage"), true);
  }
});
test("Council hall authority includes section leadership and Group appointments only", () => {
  for (const appointment of CANONICAL_SCOUTING_APPOINTMENTS) assert.equal(canManageHallBookings(account, organisation(appointment), "2026-10-29"), !["Scouter", "Programme Scouter"].includes(appointment), appointment);
  assert.equal(canManageHallBookings(account, {active: true, scoutingRole: "Section Leader", organisationSection: "Cubs"}), true);
  assert.equal(canManageHallBookings(account, {active: true, scoutingRole: "DGL"}), true);
});
test("hall authority fails closed for inactive, unknown, revoked and expired appointments", () => {
  for (const role of ["leader", "admin", "super-admin"]) assert.equal(canManageHallBookings({...account, role}, organisation("Scouter")), false);
  for (const profile of [null, {...account, active: false}, {...account, role: "parent"}, {...account, sections: []}, {...account, section: "Cubs"}]) assert.equal(canManageHallBookings(profile, organisation("Section Leader")), false);
  for (const record of [null, {...organisation("Section Leader"), active: false}, organisation("Unknown"), {active: true, scoutingRole: "Section Leader", appointments: []}]) assert.equal(canManageHallBookings(account, record), false);
  for (const fields of [{active: false}, {active: "true"}, {startDate: "2026-10-30"}, {endDate: "2026-10-28"}, {startDate: "2026-02-30"}, {endDate: 2027}, {startDate: "2026-10-29", endDate: "2026-10-28"}]) assert.equal(canManageHallBookings(account, {active: true, appointments: [{appointment: "Section Leader", scope: "Cubs", active: true, ...fields}]}, "2026-10-29"), false);
  assert.equal(canManageHallBookings(account, {active: true, appointments: [{appointment: "Section Leader", active: true, startDate: "2026-10-29", endDate: "2026-10-29"}]}, "2026-10-29"), true);
});
