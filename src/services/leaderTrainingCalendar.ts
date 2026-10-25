import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { loadLeaderAccessRecords } from "./leaderAccess";
import { isGroupLeadershipAppointment } from "../security/scoutingAppointments";
import { calendarDays, type CalendarEntry } from "./groupCalendar";
import type { LeaderTrainingRecord } from "./leaderTrainingLogic";
import { trainingCalendarEntry } from "./leaderTrainingCalendarLogic";
import type { AdminProfile } from "../components/admin/AdminAuthProvider";

/** Read canonical categories using their existing Rules; no calendar copy or evidence projection. */
export async function watchLeaderTrainingCalendar(profile: AdminProfile | null, month: string, next: (entries: CalendarEntry[]) => void, failed: () => void) {
  const uid = auth.currentUser?.uid;
  if (!profile || !uid) { next([]); return () => {}; }
  const canonical = (await getDoc(doc(db, "adminUsers", uid))).data();
  if (canonical?.active !== true || !["leader", "admin", "super-admin"].includes(canonical.role) || !Array.isArray(canonical.sections) || !canonical.sections.length || Object.hasOwn(canonical, "section")) { next([]); return () => {}; }
  const organisation = (await getDoc(doc(db, "organisationLeadership", uid))).data();
  const all = ["admin", "super-admin"].includes(canonical.role) || (organisation?.active === true && isGroupLeadershipAppointment(organisation.scoutingRole));
  const leaders = all ? (await loadLeaderAccessRecords()).filter(leader => ["leader", "admin", "super-admin"].includes(leader.role)) : [{uid, displayName: canonical.displayName || "Leader"}];
  const days = calendarDays(month), results = new Map<string, CalendarEntry[]>(); let active = true;
  if (!leaders.length) { next([]); return () => {}; }
  const stops = leaders.map(leader => onSnapshot(query(collection(db, "adminUsers", leader.uid, "training"), where("expiryDate", ">=", days[0]), where("expiryDate", "<=", days.at(-1)!)), {includeMetadataChanges: true}, snapshot => {
    if (!active || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    results.set(leader.uid, snapshot.docs.flatMap(item => {
      const entry = trainingCalendarEntry(leader.uid, leader.displayName, item.id, item.data() as LeaderTrainingRecord, !all);
      return entry ? [entry] : [];
    }));
    if (results.size === leaders.length) next([...results.values()].flat());
  }, () => { if (active) {active = false; results.clear(); failed();} }));
  return () => {active = false; stops.forEach(stop => stop());};
}
