import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const sourceRoot = new URL("../../src/", import.meta.url);
const rawDateFields = /\{\s*(?:[A-Za-z_$][\w$]*\.)*(?:transactionDate|paymentDate|startDate|endDate|meetingDate|dateOfBirth|expectedReturnDate|effectiveDate|consentFrom|consentTo|signatureDate|authFrom|authTo|lastReviewed|createdAt|updatedAt|submittedAt|observedAt|changedAt|processedAt)\s*\}/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(entryPath) : entry.name.endsWith(".tsx") ? [entryPath] : [];
  });
}

test("user-facing JSX does not interpolate canonical ISO date fields directly", () => {
  const leaks: string[] = [];
  for (const file of sourceFiles(sourceRoot.pathname)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(rawDateFields)) {
      const index = match.index ?? 0;
      const preceding = source.slice(Math.max(0, index - 100), index);
      // Component props, input values, validation copy, and canonical comparisons are not rendered date text.
      if (source[index - 1] === "$" || match[0].includes("errors.") || source.lastIndexOf("<", index) > source.lastIndexOf(">", index)) continue;
      if (/\b(?:value|date|startDate|endDate|key)\s*=\s*\{?[^{}]*$/.test(preceding)) continue;
      if (/new Date\(\s*`?[^`]*$/.test(preceding)) continue;
      leaks.push(`${path.relative(sourceRoot.pathname, file)}: ${match[0]}`);
    }
  }
  assert.deepEqual(leaks, [], `Format rendered dates with the site date formatter:\n${leaks.join("\n")}`);
});

test("date-only consent fields and timestamps use explicit presentation helpers", async () => {
  const { displayFieldValue } = await import("../../src/services/consentManagementLogic.ts");
  const { formatSiteDateTime } = await import("../../src/services/siteDateFormat.ts");
  assert.equal(displayFieldValue("dateOfBirth", "2026-09-29"), "29-09-2026");
  assert.equal(displayFieldValue("updatedAt", "2026-10-03T16:34:00Z"), "03-10-2026, 17:34");
  assert.equal(formatSiteDateTime("2026-09-29"), "29-09-2026");
});
