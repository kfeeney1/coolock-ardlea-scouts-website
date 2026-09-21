import assert from "node:assert/strict";
import test from "node:test";
import type { ConsentAdminRecord } from "../../src/services/consentAdmin.ts";
import { displayValue, formatFieldName } from "../../src/services/consentManagementLogic.ts";
import { medicalPresentationGroups } from "../../src/services/medicalPresentation.ts";
function sample(data: Record<string, unknown>): ConsentAdminRecord {
  return { id:"sample", type:"youth", section:"Cubs", memberName:"Sample Member", memberId:"sample-member", status:"active", submittedAt:null, updatedAt:null, parentUpdatedAt:null, updatedByParent:false, consentFrom:"2026-09-01", consentTo:"2027-08-31", hasMedicationManagement:false, hasMedicalAlert:true, data };
}
test("medical presentation order is deterministic", () => {
  const first=sample({gpName:"Example GP",medicalFurtherInfo:"Example note",allergies:"Yes"});
  const second=sample({allergies:"Yes",medicalFurtherInfo:"Example note",gpName:"Example GP"});
  const keys=(r:ConsentAdminRecord)=>medicalPresentationGroups(r,formatFieldName,displayValue).flatMap(g=>g.items.map(i=>i.key));
  assert.deepEqual(keys(first),keys(second));
  assert.ok(keys(first).indexOf("allergies") < keys(first).indexOf("medicalFurtherInfo"));
  assert.ok(keys(first).indexOf("medicalFurtherInfo") < keys(first).indexOf("gpName"));
});
test("unknown legacy text remains in neutral supporting group", () => {
  const groups=medicalPresentationGroups(sample({legacyMedicalNote:"Example legacy note"}),formatFieldName,displayValue);
  assert.equal(groups.flatMap(g=>g.items).find(i=>i.key==="legacyMedicalNote")?.group,"supporting");
});
