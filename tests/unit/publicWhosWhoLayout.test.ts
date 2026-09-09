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

  it("places an already-public multi-section leader in each listed section without duplicating a section", () => {
    const multi = leader({ organisationSections: ["Beavers", "Cubs", "Beavers"] });
    assert.deepEqual(publicWhosWhoSections([multi]), ["Beavers", "Cubs"]);
    assert.deepEqual(publicLeadersForSection([multi], "Beavers").map((item) => item.uid), ["leader-1"]);
    assert.deepEqual(publicLeadersForSection([multi], "Cubs").map((item) => item.uid), ["leader-1"]);
  });
});
