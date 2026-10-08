import { isGroupLeadershipAppointment } from "../security/scoutingAppointments.ts";

export const GROUP_POLL_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"] as const;
export type PollAudienceType = "leaders" | "parents";
export type PollScopeType = "group" | "sections";
export type PollStatus = "draft" | "published" | "closed";

export type PollRecord = {
  id: string;
  question: string;
  options: string[];
  audienceType: PollAudienceType;
  scopeType: PollScopeType;
  scopeSections: string[];
  status: PollStatus;
  createdBy: string;
  createdAt?: unknown;
  publishedAt?: unknown;
  closedAt?: unknown;
  closesAt?: unknown;
};

export type PollLeaderActor = {
  uid: string;
  role: string;
  sections: readonly string[];
  scoutingRole?: string;
};

export function normalizePollOptions(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const options = raw.map((value) => value.trim()).filter((value) => {
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (options.length < 2 || options.length > 8 || options.some((value) => value.length > 120)) {
    throw new Error("Enter 2 to 8 distinct answer options, each no longer than 120 characters.");
  }
  return options;
}

export function normalizePollQuestion(question: string): string {
  const value = question.trim();
  if (value.length < 5 || value.length > 240) throw new Error("Enter a poll question between 5 and 240 characters.");
  return value;
}

export function resolvePollSections(scopeType: PollScopeType, selected: readonly string[], authorised: readonly string[]): string[] {
  if (scopeType === "group") return [...GROUP_POLL_SECTIONS];
  const allowed = new Set(authorised);
  const sections = [...new Set(selected)].filter((section) => allowed.has(section) && GROUP_POLL_SECTIONS.includes(section as typeof GROUP_POLL_SECTIONS[number]));
  if (sections.length === 0 || sections.length !== new Set(selected).size) {
    throw new Error("Choose one or more sections in your authorised scope.");
  }
  return GROUP_POLL_SECTIONS.filter((section) => sections.includes(section));
}

export function canManagePollForLeader(poll: Pick<PollRecord, "scopeType" | "scopeSections">, actor: PollLeaderActor): boolean {
  if (actor.role === "admin" || actor.role === "super-admin" || isGroupLeadershipAppointment(actor.scoutingRole)) return true;
  return poll.scopeType === "sections" && poll.scopeSections.length > 0 && poll.scopeSections.every((section) => actor.sections.includes(section));
}

export function canCreatePollForLeader(scopeType: PollScopeType, sections: readonly string[], actor: PollLeaderActor): boolean {
  const groupManager = actor.role === "admin" || actor.role === "super-admin" || isGroupLeadershipAppointment(actor.scoutingRole);
  return scopeType === "group" ? groupManager : sections.length > 0 && (groupManager || sections.every((section) => actor.sections.includes(section)));
}

export function canRespondToPoll(
  poll: Pick<PollRecord, "audienceType" | "scopeType" | "scopeSections" | "status" | "closesAt">,
  actor: { kind: "leader"; sections: readonly string[] } | { kind: "parent"; approved: boolean; memberSections: readonly string[] },
  now = Date.now()
): boolean {
  if (poll.status !== "published" || pollDeadlinePassed(poll.closesAt, now)) return false;
  if (poll.audienceType === "leaders") {
    return actor.kind === "leader" && (poll.scopeType === "group" || poll.scopeSections.some((section) => actor.sections.includes(section)));
  }
  return actor.kind === "parent" && actor.approved && poll.scopeSections.some((section) => actor.memberSections.includes(section));
}

export function pollDeadlinePassed(closesAt: unknown, now = Date.now()): boolean {
  if (!closesAt) return false;
  const date = closesAt instanceof Date
    ? closesAt
    : typeof closesAt === "object" && closesAt !== null && "toDate" in closesAt && typeof closesAt.toDate === "function"
      ? closesAt.toDate() as Date
      : new Date(closesAt as string | number);
  return Number.isFinite(date.getTime()) && date.getTime() <= now;
}

export function pollResults(options: readonly string[], responses: readonly { option?: unknown }[]): Array<{ option: string; count: number }> {
  const counts = new Map(options.map((option) => [option, 0]));
  for (const response of responses) {
    if (typeof response.option === "string" && counts.has(response.option)) counts.set(response.option, counts.get(response.option)! + 1);
  }
  return options.map((option) => ({ option, count: counts.get(option) ?? 0 }));
}
