import { describe, expect, it } from "vitest";
import { isAllowedPublicAppointment } from "../../src/services/publicWhosWho";

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
      expect(isAllowedPublicAppointment(role, "Group")).toBe(true);
    }
  });

  it("rejects internal Group administration titles", () => {
    for (const role of ["Group Council Administrator", "Elected Member", "Deputy Group Leader", "Admin", "Super Admin"]) {
      expect(isAllowedPublicAppointment(role, "Group")).toBe(false);
    }
  });

  it("allows legitimate section leadership titles", () => {
    for (const section of ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]) {
      for (const role of ["Section Leader", "Assistant Section Leader", "Programme Scouter", "Scouter"]) {
        expect(isAllowedPublicAppointment(role, section)).toBe(true);
      }
    }
  });
});
