import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const member = readFileSync("src/pages/MemberRecordPage.tsx", "utf8");
const medicationForm = readFileSync("src/components/consent/MedicationManagementForm.tsx", "utf8");
const parentEditor = readFileSync("src/components/parent/ParentConsentEditor.tsx", "utf8");
const parentConsent = readFileSync("src/services/parentConsent.ts", "utf8");
const consentService = readFileSync("src/services/consentApplications.ts", "utf8");
const display = readFileSync("src/components/admin/MedicationManagementPanel.tsx", "utf8");

test("SW-135 routes each indicator by its exact stable consent id with a mobile touch target", () => {
  assert.match(member, /to={`\/leader\/consents\/\$\{consent\.consentId\}`}/);
  assert.match(member, /fromMemberPath: location\.pathname/);
  assert.match(member, /open-medication-\$\{consent\.consentId\}/);
  assert.match(member, /minHeight: 44/);
});

test("SW-239 maps canonical linked identity without replacing medication-specific values", () => {
  assert.match(medicationForm, /hydrateMedicationIdentity/);
  assert.match(medicationForm, /memberName: identity\.memberName\?\.trim\(\) \|\| data\.memberName/);
  assert.match(medicationForm, /dateOfBirth: identity\.dateOfBirth\?\.trim\(\) \|\| data\.dateOfBirth/);
  assert.match(parentEditor, /sharedIdentity={{ memberName: form\.childName, dateOfBirth: form\.childDOB, address: form\.homeAddress }}/);
  assert.match(parentConsent, /memberName: childName/);
  assert.match(parentConsent, /dateOfBirth: childDOB/);
});

test("SW-240 persists multiple independent medications while retaining legacy first-entry compatibility", () => {
  assert.match(consentService, /medications\?: MedicationEntry\[\]/);
  assert.match(consentService, /medications: entries/);
  assert.match(medicationForm, /data-testid="add-medication"/);
  assert.match(medicationForm, /Remove medication/);
  assert.match(medicationForm, /entries\.map/);
  assert.match(display, /medication-display-entry-/);
});

test("SW-240 keeps doctor and pharmacy details shared rather than duplicating them per medication", () => {
  const entryType = consentService.slice(consentService.indexOf("export type MedicationEntry"), consentService.indexOf("export type MedicationManagementData"));
  assert.doesNotMatch(entryType, /doctorName|doctorTel|pharmacyName|pharmacyTel/);
  assert.match(medicationForm, /These details are shared across all medications for this member/);
});

test("legacy single-medication records are promoted to one entry instead of being discarded", () => {
  assert.match(medicationForm, /if \(Array\.isArray\(data\.medications\) && data\.medications\.length > 0\)/);
  assert.match(parentConsent, /if \(!Array\.isArray\(normalized\.medications\) \|\| normalized\.medications\.length === 0\)/);
});


test("SW-278 presents the complete normalized medication collection through one rendering path", () => {
  assert.match(display, /entries\.map\(\(entry, index\)/);
  assert.doesNotMatch(display, /entries\.slice\(1\)/);
  assert.match(display, /Medication \{index \+ 1\}/);
  assert.match(display, /Quantity Supplied:/);
  assert.match(display, /Other Information:/);
  assert.match(display, /Self Administration:/);
  assert.match(display, /Authorisation From:/);
  assert.match(display, /Authorisation To:/);
});
