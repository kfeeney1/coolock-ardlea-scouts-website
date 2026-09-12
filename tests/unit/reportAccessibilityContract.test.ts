import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leaderReportsSource = readFileSync(new URL("../../src/pages/LeaderReports.tsx", import.meta.url), "utf8");
const generatedReportDialogSource = readFileSync(new URL("../../src/components/admin/GeneratedReportDialog.tsx", import.meta.url), "utf8");
const accessibilityDoc = readFileSync(new URL("../../docs/report-accessibility.md", import.meta.url), "utf8");

test("current report surface keeps machine-readable HTML/CSV alternatives", () => {
  assert.match(leaderReportsSource, /text\/csv;charset=utf-8/);
  assert.match(leaderReportsSource, /window\.print\(\)/);
  assert.match(generatedReportDialogSource, /Download CSV/);
  assert.match(generatedReportDialogSource, /Preparing CSV file/);
});

test("current application does not claim an owned accessible PDF generator", () => {
  const combinedSource = `${leaderReportsSource}\n${generatedReportDialogSource}`;
  assert.doesNotMatch(combinedSource, /application\/pdf/i);
  assert.doesNotMatch(combinedSource, /\bjsPDF\b/i);
  assert.match(accessibilityDoc, /no application-owned PDF generator/i);
  assert.match(accessibilityDoc, /browser-generated PDF/i);
  assert.match(accessibilityDoc, /HTML report view or corresponding CSV export/i);
});

test("future PDF work is explicitly gated on document accessibility semantics", () => {
  for (const requirement of ["document title/language", "selectable text", "logical reading order", "headings", "table semantics", "tagging support", "HTML/CSV alternative"]) {
    assert.match(accessibilityDoc, new RegExp(requirement.replace("/", "\\/"), "i"));
  }
});
