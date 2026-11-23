import { groupFinanceReportAccess } from "./groupFinanceReportAccess.ts";
import { hasChairpersonReportAccess } from "./chairpersonReportAccess.ts";

export function canViewFinancialSummary(profile: Parameters<typeof groupFinanceReportAccess>[0]) {
  return groupFinanceReportAccess(profile).canOpen || hasChairpersonReportAccess(profile);
}
