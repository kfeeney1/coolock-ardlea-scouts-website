import { balanceFor, familyTypeLabel, paymentMethodLabel, rateCategoryLabel, type SubsAssignment, type SubsPayment } from "./subsLogic.ts";

export function memberSubsCsv(assignment: SubsAssignment, payments: SubsPayment[]) {
  const balance = balanceFor(assignment, payments);
  const rows = [
    ["Member", "Section", "Scout year", "Rate category", "Family classification", "Child position", "Amount due (cents)", "Total paid (cents)", "Remaining (cents)"],
    [assignment.memberName, assignment.section, assignment.period, rateCategoryLabel(assignment.category),
      assignment.familyType ? familyTypeLabel(assignment.familyType) : "Legacy classification",
      assignment.familyPosition ? String(assignment.familyPosition) : "",
      String(balance.dueCents), String(balance.paidCents), String(balance.remainingCents)],
    [],
    ["Payment date", "Method", "Amount (cents)", "Correction of", "Note"],
    ...payments.map(payment => [payment.paymentDate, paymentMethodLabel(payment.method), String(payment.amountCents), payment.reversalOfPaymentId, payment.note])
  ];
  return rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
}
