import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPublicLeadershipAppointments, isAllowedPublicAppointment, isCurrentPublicProjection, PUBLIC_PROJECTION_VERSION, shouldPublishLeader } from "../../src/services/publicWhosWhoLogic.ts";

describe("public Who's Who role policy", () => {
  it("allows the agreed Group executive roles", () => {
    for (const role of [
      "Group Leader",
      "Deputy Group Leader",
      "Group Chairperson",
      "Group Secretary",
      "Group Treasurer",
      "Group Quartermaster / Bo'sun",
      "Group Youth Champion"
    ]) {
      assert.equal(isAllowedPublicAppointment(role, "Group"), true);
    }
  });

  it("rejects internal Group administration titles", () => {
    for (const role of ["Group Council Administrator", "Elected Member", "Admin", "Super Admin"]) {
      assert.equal(isAllowedPublicAppointment(role, "Group"), false);
    }
  });

  it("allows legitimate section leadership titles", () => {
    for (const section of ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]) {
      for (const role of ["Section Leader", "Assistant Section Leader", "Programme Scouter", "Scouter"]) {
        assert.equal(isAllowedPublicAppointment(role, section), true);
      }
    }
  });

  it("accepts only current leader-sourced public projections", () => {
    assert.equal(isCurrentPublicProjection({ publicProjectionVersion: PUBLIC_PROJECTION_VERSION, sourceAccessRole: "leader" }), true);
    assert.equal(isCurrentPublicProjection({ sourceAccessRole: "leader" }), false);
    assert.equal(isCurrentPublicProjection({ publicProjectionVersion: PUBLIC_PROJECTION_VERSION - 1, sourceAccessRole: "leader" }), false);
    assert.equal(isCurrentPublicProjection({ publicProjectionVersion: PUBLIC_PROJECTION_VERSION, sourceAccessRole: "admin" }), false);
    assert.equal(isCurrentPublicProjection({ publicProjectionVersion: PUBLIC_PROJECTION_VERSION, sourceAccessRole: "super-admin" }), false);
  });

  it("publishes from an eligible organisational appointment rather than a technical system role", () => {
    assert.equal(shouldPublishLeader({ active: true, showPublicly: true, scoutingRole: "Group Leader", organisationSection: "Group" }), true);
    assert.equal(shouldPublishLeader({ active: true, showPublicly: true, scoutingRole: "Admin", organisationSection: "Group" }), false);
    assert.equal(shouldPublishLeader({ active: false, showPublicly: true, scoutingRole: "Group Leader", organisationSection: "Group" }), false);
    assert.equal(shouldPublishLeader({ active: true, showPublicly: false, scoutingRole: "Group Leader", organisationSection: "Group" }), false);
  });

  it("projects group appointments to Group even when organisation placement is section-scoped", () => {
    assert.deepEqual(
      buildPublicLeadershipAppointments({
        appointments: [{ appointment: "Group Chairperson", scope: "Scouts", active: true }],
        organisationSection: "Scouts",
        accountSections: ["Scouts"]
      }),
      [{ role: "Group Chairperson", section: "Group" }]
    );
  });

  it("projects multi-section Programme Scouters across authorised youth sections without exposing account data", () => {
    assert.deepEqual(
      buildPublicLeadershipAppointments({
        appointments: [{ appointment: "Programme Scouter", scope: "Cubs", active: true }],
        organisationSection: "Cubs",
        accountSections: ["Cubs", "Scouts", "Group"]
      }),
      [
        { role: "Programme Scouter", section: "Cubs" },
        { role: "Programme Scouter", section: "Scouts" }
      ]
    );
  });

  it("projects multiple appointments without excluding a mixed Group and section leader", () => {
    assert.deepEqual(
      buildPublicLeadershipAppointments({
        appointments: [
          { appointment: "Group Leader", scope: "Cubs", active: true },
          { appointment: "Section Leader", scope: "Cubs", active: true },
          { appointment: "Programme Scouter", scope: "Cubs", active: true }
        ],
        organisationSection: "Cubs",
        accountSections: ["Beavers", "Cubs", "Ventures", "Group"]
      }).map((item) => item.section),
      ["Group", "Cubs", "Beavers", "Ventures", "Cubs", "Beavers", "Ventures"]
    );
  });
});
