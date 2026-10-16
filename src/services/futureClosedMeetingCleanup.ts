import { collection, doc, getDocFromServer, getDocsFromServer, query, where, writeBatch } from "firebase/firestore";
import type { DocumentData, DocumentReference } from "firebase/firestore";
import { db } from "../firebase";
import { deleteCandidatesIndependently, groupLocalDate, isFutureClosedMeeting, sameCleanupCandidateIds } from "./futureClosedMeetingCleanupLogic.ts";
export { groupLocalDate, isFutureClosedMeeting, sameCleanupCandidateIds } from "./futureClosedMeetingCleanupLogic.ts";

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];

export type CleanupMeeting = { id: string; section: string; meetingDate: string; status: string; entries: Array<{ memberId: string }> };
export type CleanupPreview = { today: string; meetings: CleanupMeeting[] };
export type CleanupResult = { kind: "deleted"; deleted: string[]; failed: string[] } | { kind: "changed"; preview: CleanupPreview };

export async function previewFutureClosedMeetings(now = new Date()): Promise<CleanupPreview> {
  const today = groupLocalDate(now);
  const snapshots = await Promise.all(GROUP_SECTIONS.map((section) =>
    getDocsFromServer(query(collection(db, "weeklyMeetings"),
      where("section", "==", section), where("status", "==", "closed"), where("meetingDate", ">", today)))
  ));
  const meetings = snapshots.flatMap((snapshot) => snapshot.docs.flatMap((item) => {
    const data = item.data();
    const candidate: CleanupMeeting = {
      id: item.id,
      section: typeof data.section === "string" ? data.section : "",
      meetingDate: typeof data.meetingDate === "string" ? data.meetingDate : "",
      status: typeof data.status === "string" ? data.status : "",
      entries: Array.isArray(data.entries) ? data.entries.flatMap((entry) =>
        entry && typeof entry.memberId === "string" ? [{ memberId: entry.memberId }] : []) : []
    };
    return isFutureClosedMeeting(candidate, today) ? [candidate] : [];
  })).sort((a, b) => a.meetingDate.localeCompare(b.meetingDate) || a.id.localeCompare(b.id));
  return { today, meetings };
}

async function commitDeletes(refs: DocumentReference<DocumentData>[]): Promise<void> {
  for (let offset = 0; offset < refs.length; offset += 3) {
    const batch = writeBatch(db);
    refs.slice(offset, offset + 3).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteMeetingAndChildren(meeting: CleanupMeeting): Promise<void> {
  const attendance = await getDocsFromServer(collection(db, "weeklyMeetings", meeting.id, "leaderAttendance"));
  const requirementSnapshots = await Promise.all([...new Set(meeting.entries.map((entry) => entry.memberId))].map((memberId) =>
    getDocsFromServer(query(collection(db, "memberAdventureSkillProgress", memberId, "requirements"),
      where("sourceType", "==", "weeklyMeeting"), where("sourceId", "==", meeting.id)))
  ));
  await commitDeletes([
    ...attendance.docs.map((item) => item.ref),
    ...requirementSnapshots.flatMap((snapshot) => snapshot.docs.map((item) => item.ref))
  ]);

  const parentRef = doc(db, "parentWeeklyMeetings", meeting.id);
  const parent = await getDocFromServer(parentRef);
  const batch = writeBatch(db);
  if (parent.exists()) batch.delete(parentRef);
  batch.delete(doc(db, "weeklyMeetings", meeting.id));
  await batch.commit();
}

/** Reads the current Firestore state again before writing; changed candidates are returned for a new warning. */
export async function confirmFutureClosedMeetingCleanup(expectedIds: string[], now = new Date()): Promise<CleanupResult> {
  const preview = await previewFutureClosedMeetings(now);
  const expected = [...new Set(expectedIds)].sort();
  if (!sameCleanupCandidateIds(expected, preview.meetings.map((meeting) => meeting.id))) {
    return { kind: "changed", preview };
  }
  const byId = new Map(preview.meetings.map((meeting) => [meeting.id, meeting]));
  const candidates = expected.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
  return { kind: "deleted", ...await deleteCandidatesIndependently(candidates, deleteMeetingAndChildren) };
}
