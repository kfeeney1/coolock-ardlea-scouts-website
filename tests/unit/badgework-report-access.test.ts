import assert from "node:assert/strict";
import test from "node:test";
import { badgeworkReportAccess } from "../../src/security/badgeworkReportAccess.ts";

test("badgework group viewing grants do not extend section export grants", () => {
  const secretary = { appointment: "Group Secretary", scope: "Group" };
  const programme = { appointment: "Programme Scouter", scope: "Scouts" };
  assert.deepEqual(badgeworkReportAccess({ role: "leader", sections: ["Cubs", "Scouts"], appointments: [secretary, programme] }),
    { group: true, exportSections: ["Scouts"], canOpen: true });
  assert.deepEqual(badgeworkReportAccess({ role: "super-admin" }), { group: true, exportSections: [], canOpen: true });
  assert.deepEqual(badgeworkReportAccess({ role: "admin", sections: ["Scouts"] }), { group: false, exportSections: [], canOpen: false });
  assert.equal(badgeworkReportAccess({ role: "leader", sections: ["Scouts"], appointments: [{ ...programme, active: false }] }).canOpen, false);
});
