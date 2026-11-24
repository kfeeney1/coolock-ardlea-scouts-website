import { canViewFinancialSummary } from "../../src/security/financialSummaryAccess.ts";
import { calculateLedgerBalanceCents } from "../../src/services/financeLedgerLogic.ts";
import {
  balanceFor, balanceForAccount, currentSubsAccounts, currentSubsAssignments, paidCents, scoutYearPeriodForDate
} from "../../src/services/subsLogic.ts";
import { equal, profileForReport, projectedQuery, readCallerLeader } from "./youthConsentStatus.js";

const floatTypes = new Set(["opening-float", "income", "expense", "transfer-in", "transfer-out", "adjustment"]);
const fieldsFrom = ({ name, fields = {} }) => ({
  id: name.split("/").pop(),
  ...Object.fromEntries(Object.entries(fields).map(([field, value]) => [
    field, value.stringValue ?? Number(value.integerValue ?? value.doubleValue)
  ]))
});

export function summarizeFinances(period, assignments, accounts, payments, transactions) {
  const latestAssignments = currentSubsAssignments(assignments);
  const accountIds = new Set(accounts.map(account => account.id));
  const legacyAccounts = new Map();
  for (const assignment of latestAssignments) {
    if (assignment.accountId && !accountIds.has(assignment.accountId) && Number.isSafeInteger(assignment.accountAmountDueCents)) {
      legacyAccounts.set(assignment.accountId, {
        id: assignment.accountId, period: assignment.period, amountDueCents: assignment.accountAmountDueCents
      });
    }
  }
  const balances = [
    ...currentSubsAccounts(accounts).map(account => balanceForAccount(account, payments, accounts)),
    ...[...legacyAccounts.values()].map(account => balanceForAccount(account, payments)),
    ...latestAssignments.filter(assignment => !assignment.accountId)
      .map(assignment => balanceFor(assignment, payments))
  ];
  const bySection = Map.groupBy(transactions.filter(row => row.section && floatTypes.has(row.type)), row => row.section);
  const floats = [...bySection].map(([section, rows]) => ({
    section, balanceCents: calculateLedgerBalanceCents(rows)
  })).sort((a, b) => a.section.localeCompare(b.section));
  return {
    period,
    collectedCents: paidCents(payments),
    outstandingCents: balances.reduce((total, balance) => total + Math.max(0, balance.remainingCents), 0),
    floats
  };
}

export async function handleFinancialSummary(request, { base, serviceToken, origin, fetcher = fetch }) {
  const headers = {
    "Content-Type": "application/json", "Cache-Control": "private, no-store", Vary: "Origin",
    "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  const reply = (status, body) => new Response(body ? JSON.stringify(body) : null, { status, headers });
  if (request.method === "OPTIONS") return reply(204);
  if (request.method !== "POST") return reply(405);
  try {
    const caller = await readCallerLeader(request, base, fetcher);
    if (!caller) return reply(403);
    const profile = profileForReport(caller.leader, await caller.read("organisationLeadership"));
    if (!canViewFinancialSummary(profile)) return reply(403);
    const token = await serviceToken();
    const period = scoutYearPeriodForDate(new Date().toISOString().slice(0, 10));
    const where = equal("period", period);
    const read = (collection, fields, filter) =>
      projectedQuery(base, token, collection, fields, filter, fetcher).then(documents => documents.map(fieldsFrom));
    const [assignments, accounts, payments, transactions] = await Promise.all([
      read("subsAssignments", ["memberId", "period", "accountId", "amountDueCents", "accountAmountDueCents"], where),
      read("subsAccounts", ["period", "amountDueCents", "supersedesAccountId"], where),
      read("subsPayments", ["period", "memberId", "accountId", "amountCents"], where),
      read("financeTransactions", ["section", "type", "amountCents"])
    ]);
    return reply(200, summarizeFinances(period, assignments, accounts, payments, transactions));
  } catch {
    return reply(503);
  }
}
