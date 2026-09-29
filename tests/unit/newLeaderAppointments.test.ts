import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_NEW_LEADER_APPOINTMENT,
  newLeaderAppointments,
} from "../../src/services/newLeaderAppointmentLogic.ts";

test("new leaders default to the canonical Programme Scouter appointment", () => {
  assert.equal(DEFAULT_NEW_LEADER_APPOINTMENT, "Programme Scouter");
  assert.deepEqual(newLeaderAppointments("Cubs"), [{
    id: "programme-scouter--cubs",
    appointment: "Programme Scouter",
    scope: "Cubs",
    active: true,
  }]);
});

test("an administrator can remove or replace the new-leader default before approval", () => {
  assert.deepEqual(newLeaderAppointments("Cubs", []), []);
  assert.deepEqual(newLeaderAppointments("Cubs", ["Section Leader", "Programme Scouter"]), [
    { id: "section-leader--cubs", appointment: "Section Leader", scope: "Cubs", active: true },
    { id: "programme-scouter--cubs", appointment: "Programme Scouter", scope: "Cubs", active: true },
  ]);
});

test("group appointments retain canonical Group scope", () => {
  assert.deepEqual(newLeaderAppointments("Scouts", ["Group Treasurer"]), [{
    id: "group-treasurer--group",
    appointment: "Group Treasurer",
    scope: "Group",
    active: true,
  }]);
});

test("unsupported appointment values cannot be persisted", () => {
  assert.throws(() => newLeaderAppointments("Cubs", ["Super Admin"]), /Unsupported Scouting appointment/);
});

test("leader approval persists canonical appointments in the same transaction as access", () => {
  const source = readFileSync("src/services/leaderRegistrations.ts", "utf8");
  assert.match(source, /const appointments = newLeaderAppointments\(section, selectedAppointments\)/);
  assert.match(source, /transaction\.set\(adminRef/);
  assert.match(source, /transaction\.set\(organisationRef/);
  assert.match(source, /scoutingRole: appointments\[0\]\?\.appointment \|\| ""/);
  assert.match(source, /appointments,/);
});
