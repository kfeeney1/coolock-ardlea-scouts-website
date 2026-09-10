export const SUBS_PAYMENT_METHODS = ["bank", "cash", "revolut", "other"] as const;
export const SUBS_RATE_CATEGORIES = ["standard", "leader-child", "sibling"] as const;
export const SUBS_FAMILY_TYPES = ["standard", "leader"] as const;
export const SUBS_ACCOUNT_CLASSIFICATION_SOURCES = ["finance-officer-confirmed"] as const;

export type SubsPaymentMethod = typeof SUBS_PAYMENT_METHODS[number];
export type SubsRateCategory = typeof SUBS_RATE_CATEGORIES[number];
export type SubsFamilyType = typeof SUBS_FAMILY_TYPES[number];
export type SubsAccountClassificationSource = typeof SUBS_ACCOUNT_CLASSIFICATION_SOURCES[number];

export type SubsRatePolicy = {
  id: string;
  period: string;
  effectiveFrom: string;
  standardCents: number;
  leaderChildCents: number;
  siblingCents: number;
  version: number;
  periodStart?: string;
  periodEnd?: string;
  standardFamilyRatesCents?: number[];
  leaderFamilyRatesCents?: number[];
};

export type SubsAccount = {
  id: string;
  period: string;
  policyId: string;
  policyVersion: number;
  familyType: SubsFamilyType;
  memberIds: string[];
  sections: string[];
  childCount: number;
  amountDueCents: number;
  classificationSource: SubsAccountClassificationSource;
  classificationNote: string;
  createdBy: string;
  createdAt?: Date | null;
};

export type SubsAssignment = {
  id: string;
  memberId: string;
  memberName: string;
  section: string;
  period: string;
  category: SubsRateCategory;
  amountDueCents: number;
  policyId: string;
  policyVersion: number;
  sibling: boolean;
  leaderChild: boolean;
  familyType?: SubsFamilyType;
  familyPosition?: number;
  accountId?: string;
  accountAmountDueCents?: number;
  accountChildCount?: number;
};

export type SubsPayment = {
  id: string;
  memberId: string;
  memberName: string;
  section: string;
  period: string;
  accountId?: string;
  amountCents: number;
  method: SubsPaymentMethod;
  paymentDate: string;
  reversalOfPaymentId: string;
  note: string;
  recordedBy: string;
  createdAt?: Date | null;
};

export const AGREED_SUBS_2026_27 = {
  period: "2026/27",
  periodStart: "2026-09-01",
  periodEnd: "2027-06-30",
  effectiveFrom: "2026-09-01",
  standardFamilyRatesCents: [26400, 41900, 52400, 62900],
  leaderFamilyRatesCents: [20500, 34300, 46500]
} as const;

export const paymentMethodLabel = (method: SubsPaymentMethod) => ({
  bank: "Bank",
  cash: "Cash",
  revolut: "Revolut",
  other: "Other"
})[method];

export const rateCategoryLabel = (category: SubsRateCategory) => ({
  standard: "Standard member",
  "leader-child": "Leader's child",
  sibling: "Sibling discount"
})[category];

export const familyTypeLabel = (type: SubsFamilyType) => type === "leader" ? "Leader family" : "Standard family";

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function parseEuroToCents(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(trimmed)) throw new Error("Enter a valid euro amount with no more than two decimal places.");
  const [whole, fraction = ""] = trimmed.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("The amount is too large.");
  return cents;
}

export function validatePeriod(value: string): string {
  const period = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 /_-]{2,39}$/.test(period)) throw new Error("Enter a subs period between 3 and 40 characters.");
  return period;
}

export function validateIsoDate(value: string, label = "date"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new Error(`Enter a valid ${label}.`);
  return value;
}

export function isFamilyRatePolicy(policy: SubsRatePolicy): boolean {
  return Array.isArray(policy.standardFamilyRatesCents) && policy.standardFamilyRatesCents.length > 0
    && Array.isArray(policy.leaderFamilyRatesCents) && policy.leaderFamilyRatesCents.length > 0;
}

export function familyRatesFor(policy: SubsRatePolicy, type: SubsFamilyType): number[] {
  const rates = type === "leader" ? policy.leaderFamilyRatesCents : policy.standardFamilyRatesCents;
  if (!rates?.length) throw new Error("This policy does not contain family-based subs rates.");
  return rates;
}

export function familyTotalFor(policy: SubsRatePolicy, type: SubsFamilyType, childCount: number): number {
  const rates = familyRatesFor(policy, type);
  if (!Number.isInteger(childCount) || childCount < 1) {
    throw new Error("Family child count must be a positive integer.");
  }
  if (childCount > rates.length) {
    throw new Error(`Rate not configured for ${childCount} children in this ${familyTypeLabel(type).toLowerCase()}.`);
  }
  return rates[childCount - 1];
}

export function familyIncrementFor(policy: SubsRatePolicy, type: SubsFamilyType, familyPosition: number): number {
  const current = familyTotalFor(policy, type, familyPosition);
  const previous = familyPosition === 1 ? 0 : familyTotalFor(policy, type, familyPosition - 1);
  return current - previous;
}

export function categoryForFamilyPosition(type: SubsFamilyType, familyPosition: number): SubsRateCategory {
  if (type === "leader") return "leader-child";
  return familyPosition > 1 ? "sibling" : "standard";
}

export function rateForCategory(policy: SubsRatePolicy, category: SubsRateCategory): number {
  return category === "leader-child" ? policy.leaderChildCents : category === "sibling" ? policy.siblingCents : policy.standardCents;
}

export function paidCents(payments: SubsPayment[]): number {
  return payments.reduce((sum, payment) => sum + payment.amountCents, 0);
}

export function paymentsForAssignment(assignment: SubsAssignment, payments: SubsPayment[]): SubsPayment[] {
  if (assignment.accountId) {
    return payments.filter((payment) => payment.accountId === assignment.accountId && payment.period === assignment.period);
  }
  return payments.filter((payment) => !payment.accountId && payment.memberId === assignment.memberId && payment.period === assignment.period);
}

export function balanceFor(assignment: SubsAssignment, payments: SubsPayment[]) {
  const relevantPayments = paymentsForAssignment(assignment, payments);
  const paid = paidCents(relevantPayments);
  const due = assignment.accountId && Number.isSafeInteger(assignment.accountAmountDueCents)
    ? assignment.accountAmountDueCents!
    : assignment.amountDueCents;
  return { dueCents: due, paidCents: paid, remainingCents: due - paid };
}

export function balanceForAccount(account: SubsAccount, payments: SubsPayment[]) {
  const paid = paidCents(payments.filter((payment) => payment.accountId === account.id && payment.period === account.period));
  return { dueCents: account.amountDueCents, paidCents: paid, remainingCents: account.amountDueCents - paid };
}

export function validateFamilyAccountSelection(memberIds: string[], classificationNote: string): { memberIds: string[]; classificationNote: string } {
  const unique = [...new Set(memberIds.filter(Boolean))];
  if (!unique.length) throw new Error("Select at least one child for the family subs account.");
  if (unique.length !== memberIds.length) throw new Error("A child cannot appear twice in the same family subs account.");
  const note = classificationNote.trim();
  if (note.length < 3) throw new Error("Record how the family relationship was confirmed.");
  if (note.length > 200) throw new Error("Family classification evidence must be 200 characters or fewer.");
  return { memberIds: unique, classificationNote: note };
}

function validateFamilyRates(rates: number[] | undefined, label: string): void {
  if (!rates?.length) return;
  let previous = 0;
  for (const amount of rates) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`${label} rates must be non-negative whole-cent amounts.`);
    if (amount < previous) throw new Error(`${label} family totals must not decrease as family size increases.`);
    previous = amount;
  }
}

export function validatePolicy(input: Omit<SubsRatePolicy, "id">): Omit<SubsRatePolicy, "id"> {
  validatePeriod(input.period);
  validateIsoDate(input.effectiveFrom, "effective date");
  for (const amount of [input.standardCents, input.leaderChildCents, input.siblingCents]) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Rates must be non-negative whole-cent amounts.");
  }
  if (!Number.isInteger(input.version) || input.version < 1) throw new Error("Policy version must be a positive integer.");
  if ((input.periodStart && !input.periodEnd) || (!input.periodStart && input.periodEnd)) throw new Error("Subs policies must define both a period start and end date.");
  if (input.periodStart && input.periodEnd) {
    validateIsoDate(input.periodStart, "period start date");
    validateIsoDate(input.periodEnd, "period end date");
    if (input.periodEnd < input.periodStart) throw new Error("Subs period end date must not be before its start date.");
  }
  validateFamilyRates(input.standardFamilyRatesCents, "Standard family");
  validateFamilyRates(input.leaderFamilyRatesCents, "Leader family");
  if (Boolean(input.standardFamilyRatesCents?.length) !== Boolean(input.leaderFamilyRatesCents?.length)) {
    throw new Error("Family-based policies must define both standard and leader family rates.");
  }
  return input;
}

export function validatePayment(input: Omit<SubsPayment, "id" | "recordedBy" | "createdAt">) {
  if (!input.memberId || !input.memberName || !input.section) throw new Error("Select a valid member.");
  validatePeriod(input.period);
  validateIsoDate(input.paymentDate, "payment date");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Payment must be greater than zero and stored in whole cents.");
  if (!SUBS_PAYMENT_METHODS.includes(input.method)) throw new Error("Select a valid payment method.");
  if (input.reversalOfPaymentId) throw new Error("Use the correction workflow to reverse a payment.");
  if (input.note.trim().length > 200) throw new Error("Notes must be 200 characters or fewer.");
  return { ...input, accountId: input.accountId ?? "", note: input.note.trim() };
}

export function createPaymentReversal(original: SubsPayment, note: string): Omit<SubsPayment, "id" | "recordedBy" | "createdAt"> {
  if (original.amountCents <= 0 || original.reversalOfPaymentId) throw new Error("Only an original positive payment can be reversed.");
  const reason = note.trim();
  if (!reason) throw new Error("Enter a correction reason.");
  return {
    memberId: original.memberId,
    memberName: original.memberName,
    section: original.section,
    period: original.period,
    accountId: original.accountId ?? "",
    amountCents: -original.amountCents,
    method: original.method,
    paymentDate: new Date().toISOString().slice(0, 10),
    reversalOfPaymentId: original.id,
    note: reason
  };
}
