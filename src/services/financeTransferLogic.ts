import { UserFacingError } from "./applicationErrors.ts";
export interface FinanceTransferInput {
  fromSection: string;
  toSection: string;
  amountCents: number;
  description: string;
  transactionDate: string;
}

function normalise(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validateFinanceTransferInput(input: FinanceTransferInput): FinanceTransferInput {
  const fromSection = normalise(input.fromSection);
  const toSection = normalise(input.toSection);
  const description = normalise(input.description);

  if (!fromSection) throw new UserFacingError("Choose the section the money is moving from.");
  if (!toSection) throw new UserFacingError("Choose the section the money is moving to.");
  if (fromSection === toSection) throw new UserFacingError("A transfer must move money between two different sections.");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new UserFacingError("Transfer amount must be a positive whole number of cents.");
  }
  if (!description) throw new UserFacingError("Enter a transfer description.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transactionDate)) {
    throw new UserFacingError("Transfer date must use YYYY-MM-DD format.");
  }

  return {
    fromSection,
    toSection,
    amountCents: input.amountCents,
    description,
    transactionDate: input.transactionDate,
  };
}
