import { scheduleFixtureDb } from "./schedule-fixtures";
export const matrixMemberIds = Array.from({ length: 31 }, (_, index) => `sw260-member-${index}`);
export const matrixMeetingIds = Array.from({ length: 25 }, (_, index) => `sw260-meeting-${index}`);
export async function seedAttendanceMatrix() {
  const db = scheduleFixtureDb();
  const settings = ["attendanceExperience", "leaderNavigation", "scheduleExperience"].map(id => db.doc(`siteSettings/${id}`));
  const previous = await Promise.all(settings.map(async ref => (await ref.get()).data()));
  const batch = db.batch();
  settings.forEach(ref => batch.delete(ref));
  matrixMemberIds.forEach((id, index) => {
    const section = index === 30 ? "Cubs" : "Scouts";
    batch.set(db.doc(`members/${id}`), { displayName: `SW260 Member ${String(index).padStart(2, "0")} with a long surname for wrapping`, firstName: "SW260", lastName: `Member ${String(index).padStart(2, "0")}`, section, sections: [section], status: "active" });
  });
  matrixMeetingIds.forEach((id, index) => {
    const section = index === 24 ? "Cubs" : "Scouts";
    batch.set(db.doc(`weeklyMeetings/${id}`), { section, meetingDate: `2098-01-${String(index + 1).padStart(2, "0")}`, status: "closed", theme: `SW260 Meeting ${String(index).padStart(2, "0")} with a long activity title`, entries: matrixMemberIds.filter((_, member) => member % 3 !== 2 && (member === 30) === (section === "Cubs")).map((memberId, entry) => ({ memberId, memberName: `Fixture ${memberId}`, attendance: entry % 2 ? "absent" : "present" })), notes: "", injuries: [] });
  });
  await batch.commit();
  return async () => {
    const cleanup = db.batch();
    matrixMemberIds.forEach(id => cleanup.delete(db.doc(`members/${id}`)));
    matrixMeetingIds.forEach(id => cleanup.delete(db.doc(`weeklyMeetings/${id}`)));
    settings.forEach((ref, index) => { if (previous[index]) cleanup.set(ref, previous[index]!); else cleanup.delete(ref); });
    await cleanup.commit();
  };
}
