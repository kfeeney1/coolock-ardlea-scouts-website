import type { PastWeeklyMeetingUpdate, WeeklyMeetingInput, WeeklyMeetingRecord } from "./weeklyTracker";
import { sortWeeklyEntries } from "./weeklyTrackerLogic.ts";
type Writes = { updateOpen: (id: string, input: WeeklyMeetingInput) => Promise<void>; updatePast: (id: string, input: PastWeeklyMeetingUpdate) => Promise<void>; saveLeaders: (id: string) => Promise<void> };
/** A new closure is committed only after pending leader writes acknowledge. */
export async function saveWeeklyMeetingWrites(next: WeeklyMeetingRecord, editingPast: boolean, writes: Writes) {
  const closing = !editingPast && next.status === "closed";
  const { id, ...input } = next;
  if (closing) await writes.saveLeaders(id);
  if (editingPast) await writes.updatePast(id, { entries: sortWeeklyEntries(next.entries), injuries: next.injuries, notes: next.notes });
  else await writes.updateOpen(id, input);
  if (!closing) await writes.saveLeaders(id);
}

type SaveSlot = { current: Promise<boolean> | null };
/** Share the editor's write slot, so a quiet open save cannot finish after closure and reopen it. */
export function saveWeeklyMeetingInBackground(record: WeeklyMeetingRecord, slot: SaveSlot, writes: Pick<Writes, "updateOpen" | "saveLeaders">, onSaved: (record: WeeklyMeetingRecord) => void): Promise<boolean> {
  if (slot.current) return Promise.resolve(false);
  const pending = (async () => {
    try { const { id, ...input } = record; await writes.updateOpen(id, input); await writes.saveLeaders(id); onSaved(record); return true; } catch { return false; }
  })();
  slot.current = pending;
  return pending.finally(() => { if (slot.current === pending) slot.current = null; });
}
