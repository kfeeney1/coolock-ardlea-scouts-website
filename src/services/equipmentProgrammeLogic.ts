export type EquipmentProgrammeStatus = "planned" | "reserved" | "checked-out" | "partially-returned" | "returned";

export const EQUIPMENT_RESERVATION_NOTE_PREFIX = "[equipment-reservation]";

export type EquipmentProgrammeRequirementLike = {
  loanId: string;
};

export type EquipmentProgrammeLoanLineLike = {
  quantity: number;
  returnedQuantity: number;
  incidentQuantity?: number;
};

export type EquipmentProgrammeLoanLike = {
  id: string;
  status: "open" | "returned";
  notes?: string;
  lines: EquipmentProgrammeLoanLineLike[];
};

export function isEquipmentReservationLoan(loan: Pick<EquipmentProgrammeLoanLike, "notes"> | null | undefined): boolean {
  return Boolean(loan?.notes?.startsWith(EQUIPMENT_RESERVATION_NOTE_PREFIX));
}

export function equipmentProgrammeStatus(
  requirement: EquipmentProgrammeRequirementLike | null,
  loans: EquipmentProgrammeLoanLike[],
): EquipmentProgrammeStatus {
  if (!requirement?.loanId) return "planned";
  const loan = loans.find((value) => value.id === requirement.loanId);
  if (!loan) return "planned";
  if (isEquipmentReservationLoan(loan)) return loan.status === "open" ? "reserved" : "planned";
  if (loan.status === "returned") return "returned";
  const returned = loan.lines.reduce((sum, line) => sum + line.returnedQuantity + (line.incidentQuantity ?? 0), 0);
  return returned > 0 ? "partially-returned" : "checked-out";
}

export function outstandingRequirementQuantity(
  requirement: EquipmentProgrammeRequirementLike,
  loans: EquipmentProgrammeLoanLike[],
): number {
  const loan = loans.find((value) => value.id === requirement.loanId);
  if (!loan) return 0;
  return loan.lines.reduce(
    (sum, line) => sum + Math.max(0, line.quantity - line.returnedQuantity - (line.incidentQuantity ?? 0)),
    0,
  );
}

export function reservedQuantityForItem(
  itemId: string,
  loans: EquipmentProgrammeLoanLike[],
): number {
  return loans
    .filter((loan) => loan.status === "open" && isEquipmentReservationLoan(loan))
    .flatMap((loan) => loan.lines)
    .filter((line) => (line as EquipmentProgrammeLoanLineLike & { itemId?: string }).itemId === itemId)
    .reduce((sum, line) => sum + Math.max(0, line.quantity - line.returnedQuantity - (line.incidentQuantity ?? 0)), 0);
}
