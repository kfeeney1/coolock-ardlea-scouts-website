import assert from "node:assert/strict";
import test from "node:test";
import { settingsMenuDestination, settingsRouteAllowed } from "../../src/security/settingsNavigationPolicy.ts";
import { settingsAccessFor } from "../../src/security/settingsAccess.ts";
import { CANONICAL_SCOUTING_APPOINTMENTS } from "../../src/security/scoutingAppointments.ts";
import { leaderNavigationFilter } from "../../src/navigation/leaderNavigationPermissions.ts";
import { leaderNavGroups, redesignedNavigationGroups } from "../../src/navigation/leaderNavigation.ts";
import { resolveLeaderNavigation } from "../../src/navigation/leaderNavigationState.ts";

const profile = (scoutingRole: string, role = "leader", appointments?: unknown) => ({ role, scoutingRole, appointments });
const menu = (value: ReturnType<typeof profile>) => leaderNavGroups.map(group => ({ ...group, items: group.items.filter(leaderNavigationFilter(value)) })).filter(group => group.items.length);

test("direct Settings views match the approved per-area view policy for every role", () => {
  for (const role of ["leader", "admin", "super-admin", "parent", "member", "unknown"]) {
    for (const appointment of CANONICAL_SCOUTING_APPOINTMENTS) {
      const value = profile(appointment, role);
      assert.equal(settingsRouteAllowed(value, "?view=treasurer&section=Cubs"), settingsAccessFor(value, "subs").view);
      assert.equal(settingsRouteAllowed(value, "?section=Cubs&view=quartermaster"), settingsAccessFor(value, "equipment").view);
      assert.equal(settingsRouteAllowed(value, ""), settingsAccessFor(value, "session").view || settingsAccessFor(value, "subs").view);
      for (const search of ["?view=unknown", "?view=", "?view=quartermaster&view=treasurer"]) assert.equal(settingsRouteAllowed(value, search), false);
    }
  }
  assert.equal(settingsRouteAllowed(null, "?view=treasurer"), false);
});

test("users receive exactly one populated Settings menu entry, without an empty QM destination", () => {
  for (const role of ["leader", "admin", "super-admin"]) for (const appointment of CANONICAL_SCOUTING_APPOINTMENTS) {
    const value = profile(appointment, role);
    const visible = menu(value).flatMap(group => group.items).filter(item => ["settings", "treasurer-settings", "qm-settings"].includes(item.id));
    const expected = settingsMenuDestination(value);
    assert.deepEqual(visible.map(item => item.id), expected ? [expected] : [], `${role} ${appointment}`);
    for (const group of redesignedNavigationGroups(menu(value))) assert.ok(group.items.length > 0);
  }
  assert.equal(settingsMenuDestination(profile("Group Treasurer")), "treasurer-settings");
  assert.equal(settingsMenuDestination(profile("Group Treasurer", "admin")), "settings");
  assert.equal(settingsMenuDestination(profile("Deputy Group Leader")), "settings");
});

test("expired, inactive and section-scoped assignments never gain a Settings route or menu", () => {
  for (const status of [{ active: false }, { active: true, startDate: "2999-01-01" }, { active: true, endDate: "2000-01-01" }, { active: true, scope: "Scouts" }]) {
    const value = profile("Group Treasurer", "leader", [{ appointment: "Group Treasurer", scope: "Group", ...status }]);
    assert.equal(settingsRouteAllowed(value, "?view=treasurer"), false);
    assert.equal(settingsMenuDestination(value), null);
  }
});

test("multi-appointment Settings menu is deduplicated and legacy finance links highlight it", () => {
  const appointments = ["Group Treasurer", "Group Quartermaster / Bo'sun", "Group Secretary"].map(appointment => ({ appointment, scope: "Group", active: true }));
  for (const value of [profile("Group Treasurer", "leader", appointments), profile("Group Treasurer", "super-admin", appointments)]) {
    const groups = menu(value);
    for (const path of ["/leader/settings", "/leader/settings?section=Cubs&view=treasurer"]) {
      assert.equal(resolveLeaderNavigation(path, groups, [])?.item.id, settingsMenuDestination(value));
    }
    assert.equal(resolveLeaderNavigation("/leader/settings?view=quartermaster", groups, []), null);
  }
});
