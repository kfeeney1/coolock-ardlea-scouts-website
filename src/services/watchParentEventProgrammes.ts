import { registerParentProgrammeAccess } from "./parentProgrammeAccess";
import { collectionGroup, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { calendarDays, type CalendarEntry } from "./groupCalendar";
import { calendarSourceEntry } from "./calendarSourceLogic";
/** Date discovery uses existing audience relationships; titles come only from the safe source programme. */
export function watchParentEventProgrammes(memberIds: string[], month: string, next: (entries: CalendarEntry[]) => void, failed: () => void) {
  if (!memberIds.length) {next([]); return () => {};}
  const days = calendarDays(month), from = days[0], through = days.at(-1)!;
  const results = new Map<number, Map<string, {id: string; memberId: string}>>();
  const programmes = new Map<string, {memberId: string; stop: () => void; entry: CalendarEntry | null; loaded: boolean}>();
  let active = true;
  const emit = () => {if (active && results.size === 2 && [...programmes.values()].every(item => item.loaded)) next([...programmes.values()].flatMap(item => item.entry ? [item.entry] : []));};
  const sync = () => {
    const ids = new Map([...results.values()].flatMap(rows => [...rows.values()].map(row => [row.id, row.memberId] as const)));
    for (const [id, item] of programmes) if (!ids.has(id) || ids.get(id) !== item.memberId) {item.stop(); programmes.delete(id);}
    for (const [id, memberId] of ids) if (!programmes.has(id)) {
      const item = {memberId, stop: () => {}, entry: null as CalendarEntry | null, loaded: false}; programmes.set(id, item);
      void registerParentProgrammeAccess(id, memberId).then(() => {
        if (!active || programmes.get(id) !== item) return;
        item.stop = onSnapshot(doc(db, "events", id, "programmes", "parent"), {includeMetadataChanges: true}, snapshot => {
          if (!active || programmes.get(id) !== item || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
          item.entry = snapshot.exists() ? calendarSourceEntry("eventProgrammes", id, snapshot.data()) : null;
          item.loaded = true; emit();
        }, error => {if (active && programmes.get(id) === item) {item.entry = null; item.loaded = true; if (error.code === "permission-denied") emit(); else failed();}});
      }).catch(() => {if (active && programmes.get(id) === item) failed();});
    }
    emit();
  };
  const ranges = [[where("startDate", ">=", from), where("startDate", "<=", through)], [where("startDate", "<", from), where("endDate", ">=", from), orderBy("startDate"), orderBy("endDate")]];
  const stops = ranges.map((range, index) => onSnapshot(query(collectionGroup(db, "audienceMembers"), where("memberId", "in", memberIds), where("programmeVisible", "==", true), ...range), {includeMetadataChanges: true}, snapshot => {
    if (!active || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    const rows = new Map<string, {id: string; memberId: string}>();
    snapshot.docs.forEach(item => {const id = item.data().eventId; if (typeof id === "string" && id && !id.includes("/") && item.ref.path === `events/${id}/audienceMembers/${item.id}`) rows.set(item.ref.path, {id, memberId: item.id});});
    results.set(index, rows); sync();
  }, () => {if (active) failed();}));
  return () => {active = false; stops.forEach(stop => stop()); programmes.forEach(item => item.stop());};
}
