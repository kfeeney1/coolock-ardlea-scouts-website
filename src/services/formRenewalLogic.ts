export type FormRenewalMember = {
  id: string;
  active: boolean;
};

export type FormRenewalConsent = {
  memberId: string;
  formType: string;
  status: string;
  consentTo: string;
  submittedAt: Date | null;
  updatedAt: Date | null;
  parentUpdatedAt: Date | null;
};

export type FormRenewalReason = "missing" | "expired" | "annual";

export type FormRenewalDue = {
  memberId: string;
  reason: FormRenewalReason;
  referenceDate: Date | null;
};

function isValidDate(value: Date | null): value is Date {
  return Boolean(value && !Number.isNaN(value.getTime()));
}

function latestDate(...values: Array<Date | null>): Date | null {
  const valid = values.filter(isValidDate);
  if (valid.length === 0) return null;
  return valid.reduce((latest, value) => value.getTime() > latest.getTime() ? value : latest);
}

function addUtcYear(value: Date): Date {
  const due = new Date(value.getTime());
  due.setUTCFullYear(due.getUTCFullYear() + 1);
  return due;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function currentYouthConsent(records: FormRenewalConsent[]): FormRenewalConsent | null {
  const eligible = records.filter((record) =>
    record.formType === "youth-activity-consent"
    && record.status !== "archived"
  );
  if (eligible.length === 0) return null;

  return [...eligible].sort((left, right) => {
    const leftDate = latestDate(left.parentUpdatedAt, left.updatedAt, left.submittedAt)?.getTime() ?? 0;
    const rightDate = latestDate(right.parentUpdatedAt, right.updatedAt, right.submittedAt)?.getTime() ?? 0;
    return rightDate - leftDate;
  })[0] ?? null;
}

export function findMembersNeedingFormRenewal(
  members: FormRenewalMember[],
  consents: FormRenewalConsent[],
  asOf: Date = new Date()
): FormRenewalDue[] {
  const asOfDay = startOfUtcDay(asOf);
  const recordsByMember = new Map<string, FormRenewalConsent[]>();

  for (const consent of consents) {
    if (!consent.memberId) continue;
    recordsByMember.set(consent.memberId, [
      ...(recordsByMember.get(consent.memberId) || []),
      consent
    ]);
  }

  return members.flatMap((member) => {
    if (!member.active) return [];

    const current = currentYouthConsent(recordsByMember.get(member.id) || []);
    if (!current) {
      return [{ memberId: member.id, reason: "missing" as const, referenceDate: null }];
    }

    if (current.consentTo) {
      const expiry = new Date(`${current.consentTo}T00:00:00Z`);
      if (!Number.isNaN(expiry.getTime()) && expiry < asOfDay) {
        return [{
          memberId: member.id,
          reason: "expired" as const,
          referenceDate: latestDate(current.parentUpdatedAt, current.updatedAt, current.submittedAt)
        }];
      }
    }

    const referenceDate = latestDate(current.parentUpdatedAt, current.updatedAt, current.submittedAt);
    if (!referenceDate || addUtcYear(startOfUtcDay(referenceDate)) <= asOfDay) {
      return [{ memberId: member.id, reason: "annual" as const, referenceDate }];
    }

    return [];
  });
}
