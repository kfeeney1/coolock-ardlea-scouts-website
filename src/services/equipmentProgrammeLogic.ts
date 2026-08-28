export type EquipmentProgrammeStatus = "planned" | "checked-out" | "partially-returned" | "returned";

export type EquipmentProgrammeRequirementLike = {
  loanId: string;
};

export type EquipmentProgrammeLoanLineLike = {
  quantity: number;
  returnedQuantity: number;
  incidentQuantity: number;
};

export type EquipmentProgrammeLoanLike = {
  id: string;
  status: "open" | "returned";
  lines: EquipmentProgrammeLoanLineLike[];
};

export function equipmentProgrammeStatus(
  requirement: EquipmentProgrammeRequirementLike | null,
  loans: EquipmentProgrammeLoanLike[],
): EquipmentProgrammeStatus {
  if (!requirement?.loanId) return "planned";
  const loan = loans.find((value) => value.id === requirement.loanId);
  if (!loan) return "planned";
  if (loan.status === "returned") return "returned";
  const returned = loan.lines.reduce((sum, line) => sum + line.returnedQuantity + line.incidentQuantity, 0);
  return returned > 0 ? "partially-returned" : "checked-out";
}

export function outstandingRequirementQuantity(
  requirement: EquipmentProgrammeRequirementLike,
  loans: EquipmentProgrammeLoanLike[],
): number {
  const loan = loans.find((value) => value.id === requirement.loanId);
  if (!loan) return 0;
  return loan.lines.reduce(
    (sum, line) => sum + Math.max(0, line.quantity - line.returnedQuantity - line.incidentQuantity),
    0,
  );
}
