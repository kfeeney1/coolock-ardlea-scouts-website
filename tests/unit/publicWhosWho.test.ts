import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedPublicAppointment } from "../../src/services/publicWhosWhoLogic.ts";

describe("public Who's Who role policy", () => {
  it("allows the agreed Group executive roles", () => {
    for (const role of [
      "Group Leader",
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
    for (const role of ["Group Council Administrator", "Elected Member", "Deputy Group Leader", "Admin", "Super Admin"]) {
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
});
