import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where, type QueryConstraint } from "firebase/firestore";
import { auth, db } from "../firebase";
import { activeScoutingAppointments, normalizeScoutingAppointmentAssignments, isGroupLeadershipAppointment } from "../security/scoutingAppointments";
import { canonicalMemberSections, MEMBER_PROGRAMME_SECTIONS } from "./memberSectionCore.mjs";
import { loadParentAccount } from "./parentPortal";
import { calendarDays, type CalendarEntry } from "./groupCalendar";
import { calendarSourceEntry, type CalendarSource } from "./calendarSourceLogic";
import type { AdminProfile } from "../components/admin/AdminAuthProvider";
const groupSections = [...MEMBER_PROGRAMME_SECTIONS, "Group", "All Sections"];
export async function calendarSources(profile: AdminProfile | null): Promise<CalendarSource[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const canonicalProfile = profile ? (await getDoc(doc(db, "adminUsers", uid))).data() : null;
  profile = profile && canonicalProfile?.active === true && ["leader", "admin", "super-admin"].includes(canonicalProfile.role) && Array.isArray(canonicalProfile.sections) && !Object.hasOwn(canonicalProfile, "section") ? {...profile, role: canonicalProfile.role, sections: canonicalProfile.sections} : null;
  const sources: CalendarSource[] = [];
  let meetingSections: string[] = []; let eventSections: string[] = [];
  if (profile) {
    const organisation = (await getDoc(doc(db, "organisationLeadership", uid))).data();
    const active = organisation?.active === true;
    const all = profile.role === "admin" || profile.role === "super-admin";
    const group = active && isGroupLeadershipAppointment(organisation?.scoutingRole);
    meetingSections = all || group || (active && organisation?.scoutingRole === "Group Secretary") ? groupSections : profile.sections;
    const assignments = active ? activeScoutingAppointments(normalizeScoutingAppointmentAssignments(organisation?.appointments, organisation?.scoutingRole, organisation?.organisationSection)) : [];
    const appointedSections = assignments.filter(item => ["Section Leader", "Assistant Section Leader", "Programme Scouter", "Scouter"].includes(item.appointment)).map(item => item.scope);
    eventSections = all ? groupSections : [...new Set([...profile.sections, ...appointedSections])];
    sources.push({collection: "weeklyMeetings", sections: meetingSections}, {collection: "events", sections: eventSections});
  }
  const parent = await loadParentAccount(uid);
  if (parent?.status === "approved") {
    const sections = [...new Set([...parent.linkedSections, "Group", "All Sections"])];
    sources.push({collection: "parentWeeklyMeetings", sections: sections.filter(s => !meetingSections.includes(s))}, {collection: "parentGalleryEvents", sections: sections.filter(s => !eventSections.includes(s))});
  } else if (!profile) {
    // An active linked member is a supported group member, but not a Leader or Parent.
    // Only already-public events are readable through that identity's source permissions.
    const members = await getDocs(query(collection(db, "members"), where("accountUid", "==", uid), where("status", "==", "active"), limit(1)));
    const data = members.docs[0]?.data();
    const sections = data ? canonicalMemberSections(data.sections, data.section) : [];
    sources.push({collection: "publicEvents", sections: [...new Set([...sections, "Group", "All Sections"])]});
  }
  return sources.filter(source => source.sections.length > 0);
}
/** Bounded by the displayed grid, including records spanning into it. No cell reads or calendar copies. */
export function watchCalendarSources(sources: CalendarSource[], month: string, next: (entries: CalendarEntry[]) => void, failed: () => void) {
  const days = calendarDays(month); const from = days[0]; const through = days.at(-1)!;
  const channels = sources.flatMap(source => source.sections.flatMap(section => {
    const meeting = source.collection === "weeklyMeetings" || source.collection === "parentWeeklyMeetings";
    const constraints: QueryConstraint[][] = meeting
      ? [[where("meetingDate", ">=", from), where("meetingDate", "<=", through)]]
      : [[where("startDate", ">=", from), where("startDate", "<=", through)], [where("startDate", "<", from), where("endDate", ">=", from), orderBy("startDate"), orderBy("endDate")]];
    return constraints.map(range => ({collection: source.collection, target: query(collection(db, source.collection), where("section", "==", section), ...range)}));
  }));
  if (!channels.length) { next([]); return () => {}; }
  const results = new Map<number, CalendarEntry[]>(); let active = true;
  const stops = channels.map((channel, index) => onSnapshot(channel.target, {includeMetadataChanges: true}, snapshot => {
    if (!active || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    results.set(index, snapshot.docs.flatMap(item => {const entry = calendarSourceEntry(channel.collection, item.id, item.data()); return entry ? [entry] : [];}));
    if (results.size === channels.length) {
      const unique = new Map<string, CalendarEntry>();
      channels.forEach((_, channelIndex) => results.get(channelIndex)!.forEach(entry => {if (!unique.has(entry.id)) unique.set(entry.id, entry);}));
      next([...unique.values()]);
    }
  }, () => {if (active) {active = false; results.clear(); failed();}}));
  return () => {active = false; stops.forEach(stop => stop());};
}
