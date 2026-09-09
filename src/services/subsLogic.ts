export const SUBS_PAYMENT_METHODS = ["bank", "cash", "revolut", "other"] as const;
export const SUBS_RATE_CATEGORIES = ["standard", "leader-child", "sibling"] as const;
export type SubsPaymentMethod = typeof SUBS_PAYMENT_METHODS[number];
export type SubsRateCategory = typeof SUBS_RATE_CATEGORIES[number];

export type SubsRatePolicy = {
  id: string; period: string; effectiveFrom: string; standardCents: number;
  leaderChildCents: number; siblingCents: number; version: number;
};
export type SubsAssignment = {
  id: string; memberId: string; memberName: string; section: string; period: string;
  category: SubsRateCategory; amountDueCents: number; policyId: string; policyVersion: number;
  sibling: boolean; leaderChild: boolean;
};
export type SubsPayment = {
  id: string; memberId: string; memberName: string; section: string; period: string;
  amountCents: number; method: SubsPaymentMethod; paymentDate: string;
  reversalOfPaymentId: string; note: string; recordedBy: string; createdAt?: Date | null;
};

export const paymentMethodLabel = (method: SubsPaymentMethod) => ({ bank: "Bank", cash: "Cash", revolut: "Revolut", other: "Other" })[method];
export const rateCategoryLabel = (category: SubsRateCategory) => ({ standard: "Standard member", "leader-child": "Leader's child", sibling: "Sibling discount" })[category];
export function formatEuro(cents: number): string { return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100); }
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
export function rateForCategory(policy: SubsRatePolicy, category: SubsRateCategory): number {
  return category === "leader-child" ? policy.leaderChildCents : category === "sibling" ? policy.siblingCents : policy.standardCents;
}
export function paidCents(payments: SubsPayment[]): number { return payments.reduce((sum, payment) => sum + payment.amountCents, 0); }
export function balanceFor(assignment: SubsAssignment, payments: SubsPayment[]) {
  const paid = paidCents(payments.filter((payment) => payment.memberId === assignment.memberId && payment.period === assignment.period));
  return { dueCents: assignment.amountDueCents, paidCents: paid, remainingCents: assignment.amountDueCents - paid };
}
export function validatePolicy(input: Omit<SubsRatePolicy, "id">): Omit<SubsRatePolicy, "id"> {
  validatePeriod(input.period); validateIsoDate(input.effectiveFrom, "effective date");
  for (const amount of [input.standardCents, input.leaderChildCents, input.siblingCents]) if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Rates must be non-negative whole-cent amounts.");
  if (!Number.isInteger(input.version) || input.version < 1) throw new Error("Policy version must be a positive integer.");
  return input;
}
export function validatePayment(input: Omit<SubsPayment, "id" | "recordedBy" | "createdAt">) {
  if (!input.memberId || !input.memberName || !input.section) throw new Error("Select a valid member.");
  validatePeriod(input.period); validateIsoDate(input.paymentDate, "payment date");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Payment must be greater than zero and stored in whole cents.");
  if (!SUBS_PAYMENT_METHODS.includes(input.method)) throw new Error("Select a valid payment method.");
  if (input.reversalOfPaymentId) throw new Error("Use the correction workflow to reverse a payment.");
  if (input.note.trim().length > 200) throw new Error("Notes must be 200 characters or fewer.");
  return { ...input, note: input.note.trim() };
}
export function createPaymentReversal(original: SubsPayment, note: string): Omit<SubsPayment, "id" | "recordedBy" | "createdAt"> {
  if (original.amountCents <= 0 || original.reversalOfPaymentId) throw new Error("Only an original positive payment can be reversed.");
  const reason = note.trim(); if (!reason) throw new Error("Enter a correction reason.");
  return { memberId: original.memberId, memberName: original.memberName, section: original.section, period: original.period, amountCents: -original.amountCents, method: original.method, paymentDate: new Date().toISOString().slice(0, 10), reversalOfPaymentId: original.id, note: reason };
}

