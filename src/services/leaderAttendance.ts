import { collection, doc, getDoc, getDocs, query, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { weeklyLeaderOptionsFromProfiles } from "./weeklyLeaderOptions";
import type { WeeklyLeaderOption } from "./weeklyLeaderOptions";
export type LeaderAttendanceStatus = "unrecorded" | "present" | "absent";
export type LeaderAttendanceEntry = {
  leaderUid: string;
  displayName: string;
  appointments: string[];
  sections: string[];
  attendance: LeaderAttendanceStatus;
};
export type ActivityAttendanceKind = "weeklyMeetings" | "events";

function activityCollection(kind: ActivityAttendanceKind, id: string) {
  return collection(db, kind, id, "leaderAttendance");
}

export async function loadLeaderAttendanceOptions(sections: string[], groupWide: boolean): Promise<WeeklyLeaderOption[]> {
  const organisation = await getDocs(collection(db, "organisationLeadership"));
  const profiles = await Promise.all(organisation.docs.map(async (item) => {
    const data = item.data();
    if (data.active !== true) return null;
    const access = await getDoc(doc(db, "adminUsers", item.id));
    if (!access.exists() || access.data().active !== true || access.data().role !== "leader") return null;
    return { id: item.id, data };
  }));
  return weeklyLeaderOptionsFromProfiles(profiles.filter((profile): profile is { id: string; data: Record<string, unknown> } => profile !== null), sections, groupWide);
}

export async function loadLeaderAttendance(kind: ActivityAttendanceKind, id: string): Promise<LeaderAttendanceEntry[]> {
  const snapshot = await getDocs(query(activityCollection(kind, id)));
  const activeEntries = await Promise.all(snapshot.docs.map(async (item) => {
    const data = item.data();
    if (typeof data.displayName !== "string" || !Array.isArray(data.appointments) || !Array.isArray(data.sections)) return null;
    const attendance = data.attendance;
    if (attendance !== "unrecorded" && attendance !== "present" && attendance !== "absent") return null;
    const [access, organisation] = await Promise.all([
      getDoc(doc(db, "adminUsers", item.id)),
      getDoc(doc(db, "organisationLeadership", item.id))
    ]);
    if (!access.exists() || access.data().active !== true || access.data().role !== "leader" || !organisation.exists() || organisation.data().active !== true) return null;
    return {
      leaderUid: item.id,
      displayName: data.displayName,
      appointments: data.appointments.filter((value): value is string => typeof value === "string"),
      sections: data.sections.filter((value): value is string => typeof value === "string"),
      attendance
    } satisfies LeaderAttendanceEntry;
  }));
  return activeEntries.filter((entry): entry is LeaderAttendanceEntry => entry !== null);
}

export async function saveLeaderAttendance(kind: ActivityAttendanceKind, id: string, entries: LeaderAttendanceEntry[]): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Leader authentication is required.");
  const target = activityCollection(kind, id);
  const existing = await getDocs(query(target));
  const nextByUid = new Map(entries.map((entry) => [entry.leaderUid, entry]));
  const batch = writeBatch(db);
  for (const item of existing.docs) if (!nextByUid.has(item.id)) batch.delete(item.ref);
  for (const entry of nextByUid.values()) {
    batch.set(doc(target, entry.leaderUid), {
      displayName: entry.displayName.slice(0, 120),
      appointments: [...new Set(entry.appointments)].slice(0, 12),
      sections: [...new Set(entry.sections)].slice(0, 6),
      attendance: entry.attendance,
      updatedBy: user.uid,
      updatedAt: serverTimestamp()
    });
  }
  await batch.commit();
}
