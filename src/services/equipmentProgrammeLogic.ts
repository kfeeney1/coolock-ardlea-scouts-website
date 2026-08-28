import type { EquipmentLoan } from "./equipmentLoans.ts";
import { outstandingLoanQuantity } from "./equipmentLoanLogic.ts";

export type EquipmentProgrammeStatus = "planned" | "checked-out" | "partially-returned" | "returned";

export type EquipmentProgrammeRequirementLike = {
  loanId: string;
};

export function equipmentProgrammeStatus(
  requirement: EquipmentProgrammeRequirementLike | null,
  loans: EquipmentLoan[],
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
  loans: EquipmentLoan[],
): number {
  const loan = loans.find((value) => value.id === requirement.loanId);
  return loan ? loan.lines.reduce((sum, line) => sum + outstandingLoanQuantity(line), 0) : 0;
}
