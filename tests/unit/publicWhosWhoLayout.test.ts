import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PublicWhosWhoLeader } from "../../src/services/publicWhosWho.ts";
import { publicLeadersForSection, publicWhosWhoSections } from "../../src/services/publicWhosWhoLayout.ts";

function leader(overrides: Partial<PublicWhosWhoLeader> = {}): PublicWhosWhoLeader {
  return {
    uid: "leader-1",
    displayName: "Public Leader",
    scoutingRole: "Scouter",
    organisationSection: "Beavers",
    organisationSections: ["Beavers"],
    organisationOrder: 10,
    reportsToUid: "",
    publicAppointments: [{ role: "Scouter", section: "Beavers" }],
    ...overrides
  };
}

describe("public Who's Who layout", () => {
  it("orders Group and youth sections consistently", () => {
    const leaders = [
      leader({ uid: "scout", organisationSection: "Scouts", organisationSections: ["Scouts"] }),
      leader({ uid: "group", organisationSection: "Group", organisationSections: ["Group"], scoutingRole: "Group Leader" }),
      leader({ uid: "beaver", organisationSection: "Beavers", organisationSections: ["Beavers"] })
    ];
    assert.deepEqual(publicWhosWhoSections(leaders), ["Group", "Beavers", "Scouts"]);
  });

  it("places the Section Leader first while preserving deterministic ordering for remaining leaders", () => {
    const leaders = [
      leader({ uid: "programme", displayName: "Programme", organisationOrder: 1, publicAppointments: [{ role: "Programme Scouter", section: "Cubs" }], organisationSection: "Cubs", organisationSections: ["Cubs"] }),
      leader({ uid: "section-b", displayName: "Zulu", organisationOrder: 20, publicAppointments: [{ role: "Section Leader", section: "Cubs" }], organisationSection: "Cubs", organisationSections: ["Cubs"] }),
      leader({ uid: "section-a", displayName: "Alpha", organisationOrder: 10, publicAppointments: [{ role: "Section Leader", section: "Cubs" }], organisationSection: "Cubs", organisationSections: ["Cubs"] })
    ];
    assert.deepEqual(publicLeadersForSection(leaders, "Cubs").map((item) => item.uid), ["section-a", "section-b", "programme"]);
  });

  it("renders sections without a Section Leader in the existing deterministic order", () => {
    const leaders = [
      leader({ uid: "later", displayName: "Later", organisationOrder: 20 }),
      leader({ uid: "first", displayName: "First", organisationOrder: 10 })
    ];
    assert.deepEqual(publicLeadersForSection(leaders, "Beavers").map((item) => item.uid), ["first", "later"]);
  });

  it("prioritises a multi-section leader only in the section where they hold the Section Leader appointment", () => {
    const multi = leader({
      uid: "multi",
      organisationSections: ["Beavers", "Cubs"],
      organisationOrder: 20,
      publicAppointments: [
        { role: "Programme Scouter", section: "Beavers" },
        { role: "Section Leader", section: "Cubs" }
      ]
    });
    const earlier = leader({ uid: "earlier", organisationSections: ["Beavers", "Cubs"], organisationOrder: 10, publicAppointments: [{ role: "Programme Scouter", section: "Beavers" }, { role: "Programme Scouter", section: "Cubs" }] });
    assert.deepEqual(publicLeadersForSection([multi, earlier], "Beavers").map((item) => item.uid), ["earlier", "multi"]);
    assert.deepEqual(publicLeadersForSection([multi, earlier], "Cubs").map((item) => item.uid), ["multi", "earlier"]);
  });

  it("places an already-public multi-section leader in each listed section without duplicating a section", () => {
    const multi = leader({ organisationSections: ["Beavers", "Cubs", "Beavers"] });
    assert.deepEqual(publicWhosWhoSections([multi]), ["Beavers", "Cubs"]);
    assert.deepEqual(publicLeadersForSection([multi], "Beavers").map((item) => item.uid), ["leader-1"]);
    assert.deepEqual(publicLeadersForSection([multi], "Cubs").map((item) => item.uid), ["leader-1"]);
  });
});
