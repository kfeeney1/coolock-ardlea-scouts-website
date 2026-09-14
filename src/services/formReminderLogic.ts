import type { FormRenewalDue, ScouterFormRenewalDue } from "./formRenewalLogic";

export type FormReminderParent = {
  uid: string;
  status: string;
  memberIds: string[];
};

export type FormReminderLeader = {
  uid: string;
  active: boolean;
};

export type FormReminderHistory = {
  recipientUid: string;
  memberId: string;
  cycleKey: string;
  status: "sent" | "failed";
};

export type ScouterFormReminderHistory = {
  recipientUid: string;
  leaderUid: string;
  cycleKey: string;
  status: "sent" | "failed";
};

export type FormReminderCandidate = {
  recipientUid: string;
  memberId: string;
  reason: FormRenewalDue["reason"];
  cycleKey: string;
};

export type ScouterFormReminderCandidate = {
  recipientUid: string;
  leaderUid: string;
  reason: ScouterFormRenewalDue["reason"];
  cycleKey: string;
};

type ReminderCycle = Pick<FormRenewalDue, "reason" | "referenceDate">;

export function formReminderCycleKey(due: ReminderCycle): string {
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

export function buildScouterFormReminderCandidates(
  dueForms: readonly ScouterFormRenewalDue[],
  leaders: readonly FormReminderLeader[],
  history: readonly ScouterFormReminderHistory[] = []
): ScouterFormReminderCandidate[] {
  const activeLeaders = new Set(leaders.filter((leader) => leader.active).map((leader) => leader.uid));
  const sent = new Set(
    history
      .filter((entry) => entry.status === "sent")
      .map((entry) => `${entry.recipientUid}|${entry.leaderUid}|${entry.cycleKey}`)
  );

  return dueForms.flatMap<ScouterFormReminderCandidate>((due) => {
    if (!activeLeaders.has(due.leaderUid)) return [];
    const cycleKey = formReminderCycleKey(due);
    const dedupeKey = `${due.leaderUid}|${due.leaderUid}|${cycleKey}`;
    if (sent.has(dedupeKey)) return [];
    return [{
      recipientUid: due.leaderUid,
      leaderUid: due.leaderUid,
      reason: due.reason,
      cycleKey
    }];
  });
}
