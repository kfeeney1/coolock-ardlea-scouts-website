import assert from "node:assert/strict";
import test from "node:test";
import { eventConsentReportAccess } from "../../src/security/eventConsentReportAccess.ts";
import { recordedEventConsent } from "../../src/services/eventConsentReport.ts";

test("event consent reporting combines only active approved appointments", () => {
  assert.equal(eventConsentReportAccess({ role: "super-admin" }).group, true);
  assert.equal(eventConsentReportAccess({ role: "leader", scoutingRole: "Group Leader" }).group, true);
  assert.equal(eventConsentReportAccess({ role: "admin" }).canOpen, false);
  assert.deepEqual(eventConsentReportAccess({ role: "leader", sections: ["Beavers", "Cubs"], appointments: [
    { appointment: "Section Leader", scope: "Beavers" },
    { appointment: "Programme Scouter", scope: "Cubs" }
  ] }), { group: false, sections: ["Beavers"], canOpen: true });
});

test("event consent status counts only persisted, eligible roster members", () => {
  const event = { id: "event", title: "Camp", startDate: "2026-11-25", section: "Scouts", status: "open",
    consentRequired: true, attendance: { signed: "attending", declined: "not-attending", waiting: "invited" },
    consent: { signed: "received", declined: "required", exempt: "not-required", consentOnly: "required" } };
  assert.deepEqual(recordedEventConsent(event), [
    { id: "signed", received: true }, { id: "waiting", received: false }, { id: "consentOnly", received: false }
  ]);
  assert.deepEqual(recordedEventConsent({ ...event, consentRequired: false }), []);
});
