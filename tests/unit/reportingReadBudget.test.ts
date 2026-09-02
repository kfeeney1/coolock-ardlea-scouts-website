import assert from "node:assert/strict";
import test from "node:test";

import {
  REPORTING_READ_BUDGETS,
  validateReportingReadBudgetContract,
  validateReportingReadBudgetSource
} from "../../scripts/reporting-read-budget.mjs";

test("reporting read-budget contract is internally valid", () => {
  assert.deepEqual(validateReportingReadBudgetContract(), []);
});

test("leader overview keeps the 90-second cache and aggregate-count strategy", () => {
  assert.equal(REPORTING_READ_BUDGETS.adminOverview.minimumCacheMs, 90_000);
  assert.equal(REPORTING_READ_BUDGETS.adminOverview.requiresAggregateCounts, true);
  assert.equal(REPORTING_READ_BUDGETS.adminOverview.maxQueryOperations, 25);
});

test("leader reports budget two initial datasets and zero export reads after load", () => {
  assert.deepEqual(REPORTING_READ_BUDGETS.leaderReports.initialDatasets, ["members", "events"]);
  assert.equal(REPORTING_READ_BUDGETS.leaderReports.maxInitialQueryOperations, 12);
  assert.equal(REPORTING_READ_BUDGETS.leaderReports.maxExportQueryOperationsAfterInitialLoad, 0);
});

test("finance reporting budgets two query families per permitted section", () => {
  assert.deepEqual(REPORTING_READ_BUDGETS.financeReports.queryFamiliesPerSection, ["financeTransactions", "financeReceipts"]);
  assert.equal(REPORTING_READ_BUDGETS.financeReports.maxSectionFanout, 5);
  assert.equal(REPORTING_READ_BUDGETS.financeReports.maxInitialQueryOperations, 10);
  assert.equal(REPORTING_READ_BUDGETS.financeReports.maxFilterOrExportQueryOperations, 0);
});

test("current reporting source remains inside the reviewed read-budget architecture", async () => {
  assert.deepEqual(await validateReportingReadBudgetSource(), []);
});

test("invalid budget changes fail closed", () => {
  const invalid = {
    ...REPORTING_READ_BUDGETS,
    leaderReports: {
      ...REPORTING_READ_BUDGETS.leaderReports,
      maxSectionFanout: 99,
      rationale: "too short"
    }
  };
  const errors = validateReportingReadBudgetContract(invalid);
  assert.ok(errors.some((message: string) => message.includes("maxSectionFanout")));
  assert.ok(errors.some((message: string) => message.includes("rationale")));
});
