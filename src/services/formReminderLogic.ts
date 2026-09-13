import type { FormRenewalDue } from "./formRenewalLogic";

export type FormReminderParent = {
  uid: string;
  status: string;
  memberIds: string[];
};

export type FormReminderHistory = {
  recipientUid: string;
  memberId: string;
  cycleKey: string;
  status: "sent" | "failed";
};

export type FormReminderCandidate = {
  recipientUid: string;
  memberId: string;
  reason: FormRenewalDue["reason"];
  cycleKey: string;
};

export function formReminderCycleKey(due: FormRenewalDue): string {
  const reference = due.referenceDate && !Number.isNaN(due.referenceDate.getTime())
    ? due.referenceDate.toISOString()
    : "unknown";
  return `${due.reason}:${reference}`;
}

export function buildFormReminderCandidates(
  dueForms: readonly FormRenewalDue[],
  parents: readonly FormReminderParent[],
  history: readonly FormReminderHistory[] = []
): FormReminderCandidate[] {
  const sent = new Set(
    history
      .filter((entry) => entry.status === "sent")
      .map((entry) => `${entry.recipientUid}|${entry.memberId}|${entry.cycleKey}`)
  );

  const candidates: FormReminderCandidate[] = [];
  for (const due of dueForms) {
    const cycleKey = formReminderCycleKey(due);
    for (const parent of parents) {
      if (parent.status !== "approved" || !parent.memberIds.includes(due.memberId)) continue;
      const dedupeKey = `${parent.uid}|${due.memberId}|${cycleKey}`;
      if (sent.has(dedupeKey)) continue;
      candidates.push({
        recipientUid: parent.uid,
        memberId: due.memberId,
        reason: due.reason,
        cycleKey
      });
    }
  }

  return candidates;
}
