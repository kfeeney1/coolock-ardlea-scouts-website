import { balanceFor, familyTypeLabel, rateCategoryLabel, type SubsAccount, type SubsAssignment, type SubsPayment } from "./subsLogic";

export type SubsReportMember = { id: string; name: string; section: string };

export type SubsReportRow = {
  id: string;
  kind: "family" | "individual";
  accountId?: string;
  period: string;
  members: SubsReportMember[];
  sections: string[];
  dueCents: number | null;
  paidCents: number | null;
  reversedCents: number | null;
  remainingCents: number | null;
  familyType?: SubsAssignment["familyType"];
  childCount?: number;
  classificationSource?: SubsAccount["classificationSource"];
  classificationNote?: string;
  category?: SubsAssignment["category"];
  familyPosition?: number;
  restricted: boolean;
};

export type SubsReportOptions = {
  period?: string;
  section?: string;
  canViewFamilyDetails: boolean;
};

const uniqueById = <T extends { id: string }>(rows: T[]) => [...new Map(rows.map((row) => [row.id, row])).values()];
const paymentTotals = (payments: SubsPayment[]) => {
  const unique = uniqueById(payments);
  const paidCents = unique.reduce((sum, payment) => sum + payment.amountCents, 0);
  const reversedCents = unique.filter((payment) => payment.amountCents < 0 && payment.reversalOfPaymentId).reduce((sum, payment) => sum + Math.abs(payment.amountCents), 0);
  return { paidCents, reversedCents };
};

export function buildSubsReportRows(
  assignments: SubsAssignment[],
  payments: SubsPayment[],
  accounts: SubsAccount[] = [],
  options: SubsReportOptions
): SubsReportRow[] {
  const periodAssignments = assignments.filter((assignment) => !options.period || assignment.period === options.period);
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const familyGroups = new Map<string, SubsAssignment[]>();
  const individualAssignments: SubsAssignment[] = [];

  for (const assignment of periodAssignments) {
    if (assignment.accountId) {
      const key = `${assignment.period}::${assignment.accountId}`;
      familyGroups.set(key, [...(familyGroups.get(key) ?? []), assignment]);
    } else {
      individualAssignments.push(assignment);
    }
  }

  const familyRows = [...familyGroups.values()].flatMap((group): SubsReportRow[] => {
    const first = group[0];
    if (!first) return [];
    const account = accountMap.get(first.accountId!);
    const allMembers = uniqueById(group.map((assignment) => ({ id: assignment.memberId, name: assignment.memberName, section: assignment.section })));
    const matchesSection = !options.section || options.section === "all" || allMembers.some((member) => member.section === options.section);
    if (!matchesSection) return [];

    const visibleMembers = options.canViewFamilyDetails || !options.section || options.section === "all"
      ? allMembers
      : allMembers.filter((member) => member.section === options.section);
    const restricted = !options.canViewFamilyDetails;
    const relevantPayments = payments.filter((payment) => payment.accountId === first.accountId && payment.period === first.period);
    const totals = paymentTotals(relevantPayments);
    const due = account?.amountDueCents ?? (Number.isSafeInteger(first.accountAmountDueCents) ? first.accountAmountDueCents! : null);

    return [{
      id: `family:${first.period}:${first.accountId}`,
      kind: "family",
      accountId: first.accountId,
      period: first.period,
      members: visibleMembers,
      sections: options.canViewFamilyDetails ? [...new Set(allMembers.map((member) => member.section))].sort() : [...new Set(visibleMembers.map((member) => member.section))].sort(),
      dueCents: restricted ? null : due,
      paidCents: restricted ? null : totals.paidCents,
      reversedCents: restricted ? null : totals.reversedCents,
      remainingCents: restricted || due === null ? null : due - totals.paidCents,
      familyType: account?.familyType ?? first.familyType,
      childCount: account?.childCount ?? first.accountChildCount ?? allMembers.length,
      classificationSource: options.canViewFamilyDetails ? account?.classificationSource : undefined,
      classificationNote: options.canViewFamilyDetails ? account?.classificationNote : undefined,
      restricted
    }];
  });

  const individualRows = individualAssignments.flatMap((assignment): SubsReportRow[] => {
    if (options.section && options.section !== "all" && assignment.section !== options.section) return [];
    const balance = balanceFor(assignment, payments);
    const relevantPayments = payments.filter((payment) => !payment.accountId && payment.memberId === assignment.memberId && payment.period === assignment.period);
    const totals = paymentTotals(relevantPayments);
    return [{
      id: `individual:${assignment.id}`,
      kind: "individual",
      period: assignment.period,
      members: [{ id: assignment.memberId, name: assignment.memberName, section: assignment.section }],
      sections: [assignment.section],
      dueCents: balance.dueCents,
      paidCents: balance.paidCents,
      reversedCents: totals.reversedCents,
      remainingCents: balance.remainingCents,
      familyType: assignment.familyType,
      familyPosition: assignment.familyPosition,
      category: assignment.category,
      restricted: false
    }];
  });

  return [...familyRows, ...individualRows].sort((a, b) => {
    const aName = a.members[0]?.name ?? "";
    const bName = b.members[0]?.name ?? "";
    return aName.localeCompare(bName) || a.id.localeCompare(b.id);
  });
}

export function subsReportCsvRows(rows: SubsReportRow[]): string[][] {
  return [
    ["Record type", "Members", "Sections", "Scout year", "Amount due (cents)", "Amount paid net (cents)", "Reversed (cents)", "Remaining (cents)", "Family classification", "Classification source", "Classification note"],
    ...rows.map((row) => {
      const classification = row.kind === "family"
        ? row.familyType ? familyTypeLabel(row.familyType) : "Shared family account"
        : row.familyType && row.familyPosition ? `${familyTypeLabel(row.familyType)} · member ${row.familyPosition}` : row.category ? rateCategoryLabel(row.category) : "Legacy classification";
      return [
        row.kind === "family" ? "Family account" : "Individual",
        row.members.map((member) => member.name).join("; "),
        row.sections.join("; "),
        row.period,
        row.dueCents === null ? "Rate not configured" : String(row.dueCents),
        row.paidCents === null ? "Restricted" : String(row.paidCents),
        row.reversedCents === null ? "Restricted" : String(row.reversedCents),
        row.remainingCents === null ? (row.dueCents === null && !row.restricted ? "Rate not configured" : "Restricted") : String(row.remainingCents),
        classification,
        row.classificationSource ?? "",
        row.classificationNote ?? ""
      ];
    })
  ];
}
