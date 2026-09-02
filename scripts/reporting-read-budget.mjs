import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const REPORTING_READ_BUDGETS = Object.freeze({
  adminOverview: Object.freeze({
    surface: "Leader dashboard overview",
    maxSectionFanout: 6,
    maxQueryOperations: 25,
    minimumCacheMs: 90_000,
    requiresAggregateCounts: true,
    rationale: "The overview may fan out by assigned section, but repeat navigation should use the short-lived cache and count-only cards should stay on Firestore aggregation queries."
  }),
  leaderReports: Object.freeze({
    surface: "Reports & Exports",
    maxSectionFanout: 6,
    maxInitialQueryOperations: 12,
    maxExportQueryOperationsAfterInitialLoad: 0,
    initialDatasets: Object.freeze(["members", "events"]),
    rationale: "Reports load one member and one event dataset per permitted section. Event exports must reuse the already-loaded member snapshot rather than re-reading members."
  }),
  financeReports: Object.freeze({
    surface: "Section Floats reporting",
    maxSectionFanout: 5,
    maxInitialQueryOperations: 10,
    maxFilterOrExportQueryOperations: 0,
    queryFamiliesPerSection: Object.freeze(["financeTransactions", "financeReceipts"]),
    rationale: "Finance reporting reads transactions and receipt metadata once per permitted section; filtering, summaries and CSV generation remain client-side over that authorized snapshot."
  })
});

function count(source, fragment) {
  return source.split(fragment).length - 1;
}

function requireSource(errors, source, fragment, message) {
  if (!source.includes(fragment)) errors.push(message);
}

export function validateReportingReadBudgetContract(contract = REPORTING_READ_BUDGETS) {
  const errors = [];
  for (const [key, budget] of Object.entries(contract)) {
    if (!budget || typeof budget !== "object") {
      errors.push(`${key} must define a budget object.`);
      continue;
    }
    if (!Number.isInteger(budget.maxSectionFanout) || budget.maxSectionFanout < 1 || budget.maxSectionFanout > 6) {
      errors.push(`${key} maxSectionFanout must be an integer from 1 to 6.`);
    }
    if ("maxQueryOperations" in budget && (!Number.isInteger(budget.maxQueryOperations) || budget.maxQueryOperations < 1)) {
      errors.push(`${key} maxQueryOperations must be a positive integer.`);
    }
    if ("maxInitialQueryOperations" in budget && (!Number.isInteger(budget.maxInitialQueryOperations) || budget.maxInitialQueryOperations < 1)) {
      errors.push(`${key} maxInitialQueryOperations must be a positive integer.`);
    }
    if (typeof budget.rationale !== "string" || budget.rationale.trim().length < 20) {
      errors.push(`${key} must explain the read-budget rationale.`);
    }
  }
  return errors;
}

export async function validateReportingReadBudgetSource(rootDir = process.cwd()) {
  const [overview, reporting, leaderReports, financePanel] = await Promise.all([
    readFile(resolve(rootDir, "src/services/adminOverview.ts"), "utf8"),
    readFile(resolve(rootDir, "src/services/reporting.ts"), "utf8"),
    readFile(resolve(rootDir, "src/pages/LeaderReports.tsx"), "utf8"),
    readFile(resolve(rootDir, "src/components/admin/FinanceReportsPanel.tsx"), "utf8")
  ]);
  const errors = [];

  requireSource(errors, overview, "const OVERVIEW_CACHE_MS = 90_000;", "Leader overview cache must remain at least 90 seconds unless the read budget is explicitly reviewed.");
  requireSource(errors, overview, "getCountFromServer", "Leader overview count cards must retain Firestore aggregation queries.");
  if (count(overview, "loadScopedCollection(\"") > 2) {
    errors.push("Leader overview added another section-fanned document collection; review and raise the read budget explicitly if intentional.");
  }
  requireSource(errors, overview, "loadScopedCollection(\"members\", profile)", "Leader overview must keep member reads in the scoped loader.");
  requireSource(errors, overview, "loadScopedCollection(\"events\", profile)", "Leader overview must keep event reads in the scoped loader.");

  requireSource(errors, leaderReports, "Promise.all([loadMemberReportRows(scope), loadEventReportRecords(scope)])", "Reports must keep the initial Firestore snapshot to the member and event datasets.");
  requireSource(errors, reporting, "const memberReportCache = new Map", "Reports must retain the member snapshot cache used by event exports.");
  requireSource(errors, reporting, "const cachedRows = memberReportCache.get(scopeKey(scope));", "Event exports must check the loaded member snapshot before any Firestore fallback.");
  requireSource(errors, reporting, "if (cachedRows) return eventReportMembers(event, cachedRows);", "Event exports must return from the cached member snapshot without an extra read.");

  requireSource(errors, financePanel, "permittedSections.map((item) => loadFinanceTransactions(item))", "Finance reporting must keep transaction reads section-scoped.");
  requireSource(errors, financePanel, "permittedSections.map((item) => loadFinanceReceipts(item))", "Finance reporting must keep receipt reads section-scoped.");
  const exportStart = financePanel.indexOf("const exportCsv =");
  const renderStart = financePanel.indexOf("return <Paper", exportStart);
  if (exportStart >= 0 && renderStart > exportStart) {
    const exportBlock = financePanel.slice(exportStart, renderStart);
    if (exportBlock.includes("loadFinanceTransactions(") || exportBlock.includes("loadFinanceReceipts(")) {
      errors.push("Finance filtering/exporting must not trigger new Firestore reads after the initial authorized snapshot.");
    }
  }

  return errors;
}
