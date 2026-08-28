import assert from "node:assert/strict";
import test from "node:test";

import {
    activeSummaryFilter,
    consentRecordPrintHtml,
    consentTotals,
    displayValue,
    filterConsentRecords,
    filtersForSummary,
    formatFieldName
} from "../../src/services/consentManagementLogic.ts";

const records = [
    { id: "1", memberName: "Alex Example", memberId: "member1", section: "Cubs", type: "youth", status: "approved", consentTo: "2099-01-01", submittedAt: new Date("2026-01-01T10:00:00Z"), updatedAt: new Date("2026-01-01T10:00:00Z"), parentUpdatedAt: null, updatedByParent: false, hasMedicalAlert: true, hasMedicationManagement: false, data: { medicalInfo: "Asthma" } },
    { id: "2", memberName: "Casey Scouter", memberId: "", section: "Scouter", type: "scouter", status: "approved", consentTo: "2099-01-01", submittedAt: new Date("2026-01-02T10:00:00Z"), updatedAt: new Date("2026-01-02T10:00:00Z"), parentUpdatedAt: null, updatedByParent: false, hasMedicalAlert: false, hasMedicationManagement: true, data: { medicationManagement: { enabled: true, medicineName: "Example" } } }
] as any[];

test("filterConsentRecords preserves type, section, alert and search filtering", () => {
    assert.deepEqual(filterConsentRecords(records, "Alex", "youth", "Cubs", "medical").map((record) => record.id), ["1"]);
    assert.deepEqual(filterConsentRecords(records, "medicineName", "all", "all", "medication").map((record) => record.id), ["2"]);
});

test("consentTotals summarises operational attention categories", () => {
    const totals = consentTotals(records);
    assert.equal(totals.total, 2);
    assert.equal(totals.youth, 1);
    assert.equal(totals.scouter, 1);
    assert.equal(totals.medical, 1);
    assert.equal(totals.medication, 1);
});

test("summary filter mapping remains reversible for primary cards", () => {
    assert.deepEqual(filtersForSummary("youth"), { typeFilter: "youth", alertFilter: "all" });
    assert.deepEqual(filtersForSummary("medication"), { typeFilter: "all", alertFilter: "medication" });
    assert.equal(activeSummaryFilter("all", "medical"), "medical");
    assert.equal(activeSummaryFilter("youth", "medical"), "");
});

test("display helpers preserve existing consent detail formatting", () => {
    assert.equal(displayValue(true), "Yes");
    assert.equal(displayValue(["A", "B"]), "A, B");
    assert.equal(formatFieldName("emergency_contactName"), "Emergency Contact Name");
});

test("print HTML escapes record values", () => {
    const html = consentRecordPrintHtml({ ...records[0], memberName: "<Alex>", data: { notes: "<script>alert(1)</script>" } });
    assert.match(html, /&lt;Alex&gt;/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});
