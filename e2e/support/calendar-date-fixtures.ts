import { scheduleFixtureDb } from "./schedule-fixtures";
export async function calendarDateFixtures() {
  const db = scheduleFixtureDb();
  const settings = ["siteSettings/calendarExperience", "siteSettings/maintenanceExperience"].map(path => db.doc(path));
  const previous = await Promise.all(settings.map(ref => ref.get()));
  await settings[0].set({version: "redesigned"}); await settings[1].set({version: "existing"});
  const refs = Array.from({length: 4}, (_, index) => db.doc(`weeklyMeetings/sw539-${index}`));
  for (const [index, ref] of refs.entries()) await ref.set({section: "Scouts", meetingDate: "2040-06-15", status: "open", theme: `SW539 meeting ${index}`, location: "Den", entries: [], injuries: [], notes: "", programmeNotes: "", activities: [], badgeworkPlan: [], testData: true});
  return {db, settings, restore: async () => {
    for (const ref of refs) await ref.delete();
    for (const [index, ref] of settings.entries()) if (previous[index].exists) await ref.set(previous[index].data()!); else await ref.delete();
  }};
}
export const dateActionContext = "/calendar?month=2040-06&type=all&section=Scouts";
