export type FormRenewalMember = {
  id: string;
  active: boolean;
};

export type FormRenewalLeader = {
  uid: string;
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
  submittedByUid?: string;
};

export type FormRenewalReason = "missing" | "expired" | "annual";
export type FormLifecycleStatus = "missing" | "current" | "expired" | "renewal-required";

export type FormRenewalDue = {
  memberId: string;
  reason: FormRenewalReason;
  referenceDate: Date | null;
};

export type ScouterFormRenewalDue = {
  leaderUid: string;
  reason: FormRenewalReason;
  referenceDate: Date | null;
};

export type FormLifecycle = {
  memberId: string;
  status: FormLifecycleStatus;
  reason: FormRenewalReason | null;
  referenceDate: Date | null;
  validUntil: Date | null;
};

export type ScouterFormLifecycle = Omit<FormLifecycle, "memberId"> & {
  leaderUid: string;
};

function isValidDate(value: Date | null): value is Date {
  return Boolean(value && !Number.isNaN(value.getTime()));
}

function latestDate(...values: Array<Date | null>): Date | null {
  const valid = values.filter(isValidDate);
  if (valid.length === 0) return null;
  return valid.reduce((latest, value) => value.getTime() > latest.getTime() ? value : latest);
}

/**
 * A youth form's annual validity is anchored only to a meaningful completion event.
 * Generic updatedAt is deliberately excluded because administrative linking and
 * other non-renewal edits also change that field.
 */
export function authoritativeFormCompletionDate(record: FormRenewalConsent): Date | null {
  return latestDate(record.parentUpdatedAt, record.submittedAt);
}

/** Scouter forms are immutable submissions, so their submission is the completion event. */
export function authoritativeScouterFormCompletionDate(record: FormRenewalConsent): Date | null {
  return isValidDate(record.submittedAt) ? record.submittedAt : null;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Adds one calendar year, clamping 29 February to 28 February where required. */
export function addUtcCalendarYear(value: Date): Date {
  const year = value.getUTCFullYear() + 1;
  const month = value.getUTCMonth();
  const day = Math.min(value.getUTCDate(), daysInUtcMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month
    || parsed.getUTCDate() !== day
  ) return null;
  return parsed;
}

function evaluateCompletionLifecycle(
  referenceDate: Date | null,
  explicitValidUntil: Date | null,
  asOf: Date
): Omit<FormLifecycle, "memberId"> {
  const asOfDay = startOfUtcDay(asOf);
  const annualValidUntil = referenceDate ? addUtcCalendarYear(startOfUtcDay(referenceDate)) : null;

  if (explicitValidUntil && explicitValidUntil < asOfDay) {
    return {
      status: "expired",
      reason: "expired",
      referenceDate,
      validUntil: explicitValidUntil
    };
  }

  if (!referenceDate) {
    return {
      status: "renewal-required",
      reason: "annual",
      referenceDate: null,
      validUntil: null
    };
  }

  // The anniversary date itself remains valid; renewal is required from the
  // following UTC day. This matches the business wording "valid until" and
  // avoids treating a form as older than one year before it actually is.
  if (annualValidUntil && annualValidUntil < asOfDay) {
    return {
      status: "renewal-required",
      reason: "annual",
      referenceDate,
      validUntil: annualValidUntil
    };
  }

  return {
    status: "current",
    reason: null,
    referenceDate,
    validUntil: explicitValidUntil && annualValidUntil
      ? (explicitValidUntil < annualValidUntil ? explicitValidUntil : annualValidUntil)
      : explicitValidUntil || annualValidUntil
  };
}

function currentYouthConsent(records: FormRenewalConsent[]): FormRenewalConsent | null {
  const eligible = records.filter((record) =>
    record.formType === "youth-activity-consent"
    && record.status !== "archived"
  );
  if (eligible.length === 0) return null;

  return [...eligible].sort((left, right) => {
    const leftDate = authoritativeFormCompletionDate(left)?.getTime() ?? 0;
    const rightDate = authoritativeFormCompletionDate(right)?.getTime() ?? 0;
    return rightDate - leftDate;
  })[0] ?? null;
}

function currentScouterConsent(records: FormRenewalConsent[], leaderUid: string): FormRenewalConsent | null {
  const eligible = records.filter((record) =>
    record.formType === "scouter-es3-medical-advice"
    && record.status !== "archived"
    && record.submittedByUid === leaderUid
  );
  if (eligible.length === 0) return null;

  return [...eligible].sort((left, right) => {
    const leftDate = authoritativeScouterFormCompletionDate(left)?.getTime() ?? 0;
    const rightDate = authoritativeScouterFormCompletionDate(right)?.getTime() ?? 0;
    return rightDate - leftDate;
  })[0] ?? null;
}

export function evaluateMemberFormLifecycle(
  member: FormRenewalMember,
  records: FormRenewalConsent[],
  asOf: Date = new Date()
): FormLifecycle | null {
  if (!member.active) return null;

  const current = currentYouthConsent(records.filter((record) => record.memberId === member.id));
  if (!current) {
    return {
      memberId: member.id,
      status: "missing",
      reason: "missing",
      referenceDate: null,
      validUntil: null
    };
  }

  const referenceDate = authoritativeFormCompletionDate(current);
  const explicitValidUntil = current.consentTo ? parseIsoDate(current.consentTo) : null;
  return {
    memberId: member.id,
    ...evaluateCompletionLifecycle(referenceDate, explicitValidUntil, asOf)
  };
}

/**
 * Evaluates an existing Scouter ES3 form using the same annual lifecycle as youth
 * consent. The ES3 is optional, so absence is not treated as an overdue form.
 * Records without an authoritative submittedByUid cannot be assigned to a leader
 * and are intentionally not guessed from a name/email field.
 */
export function evaluateScouterFormLifecycle(
  leader: FormRenewalLeader,
  records: FormRenewalConsent[],
  asOf: Date = new Date()
): ScouterFormLifecycle | null {
  if (!leader.active) return null;
  const current = currentScouterConsent(records, leader.uid);
  if (!current) return null;

  const referenceDate = authoritativeScouterFormCompletionDate(current);
  return {
    leaderUid: leader.uid,
    ...evaluateCompletionLifecycle(referenceDate, null, asOf)
  };
}

export function findMembersNeedingFormRenewal(
  members: FormRenewalMember[],
  consents: FormRenewalConsent[],
  asOf: Date = new Date()
): FormRenewalDue[] {
  return members.flatMap<FormRenewalDue>((member) => {
    const lifecycle = evaluateMemberFormLifecycle(member, consents, asOf);
    if (!lifecycle || lifecycle.status === "current" || !lifecycle.reason) return [];
    return [{
      memberId: lifecycle.memberId,
      reason: lifecycle.reason,
      referenceDate: lifecycle.referenceDate
    }];
  });
}

export function findLeadersNeedingFormRenewal(
  leaders: FormRenewalLeader[],
  consents: FormRenewalConsent[],
  asOf: Date = new Date()
): ScouterFormRenewalDue[] {
  return leaders.flatMap<ScouterFormRenewalDue>((leader) => {
    const lifecycle = evaluateScouterFormLifecycle(leader, consents, asOf);
    if (!lifecycle || lifecycle.status === "current" || !lifecycle.reason) return [];
    return [{
      leaderUid: lifecycle.leaderUid,
      reason: lifecycle.reason,
      referenceDate: lifecycle.referenceDate
    }];
  });
}
