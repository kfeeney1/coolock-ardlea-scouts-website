export function groupLocalDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function isFutureClosedMeeting(record: { status: string; meetingDate: string }, today: string): boolean {
  const date = record.meetingDate;
  if (record.status !== "closed" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false;
  return date > today;
}

export function sameCleanupCandidateIds(expectedIds: string[], actualIds: string[]): boolean {
  const expected = [...new Set(expectedIds)].sort();
  const actual = [...new Set(actualIds)].sort();
  return expected.length === actual.length && expected.every((id, index) => id === actual[index]);
}

export async function deleteCandidatesIndependently<T extends { id: string }>(
  candidates: T[], deleteCandidate: (candidate: T) => Promise<void>
): Promise<{ deleted: string[]; failed: string[] }> {
  const outcomes: Array<{ id: string; deleted: boolean } | undefined> = new Array(candidates.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < candidates.length) {
      const index = nextIndex++;
      const candidate = candidates[index];
      try {
        await deleteCandidate(candidate);
        outcomes[index] = { id: candidate.id, deleted: true };
      } catch {
        outcomes[index] = { id: candidate.id, deleted: false };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, () => worker()));
  return {
    deleted: outcomes.flatMap((outcome) => outcome?.deleted ? [outcome.id] : []),
    failed: outcomes.flatMap((outcome) => outcome && !outcome.deleted ? [outcome.id] : [])
  };
}
