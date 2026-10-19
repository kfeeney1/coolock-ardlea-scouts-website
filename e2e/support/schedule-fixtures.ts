import { groupLocalDate } from "../../src/services/groupLocalDate";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function scheduleFixtureDb() {
  if (process.env.FIREBASE_PROJECT_ID !== "demo-coolock-ardlea-scouts" || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080") throw new Error("Schedule fixtures require the local demo Firestore emulator.");
  const app = getApps().find(app => app.name === "schedule-fixtures") ?? initializeApp({ projectId: "demo-coolock-ardlea-scouts" }, "schedule-fixtures");
  return getFirestore(app);
}
export const scheduleMeetingIds = ["000-sw177-schedule-past", "000-sw177-schedule-today", "000-sw177-schedule-future"];
export async function seedScheduleMeetings() {
  const db = scheduleFixtureDb();
  const today = new Date(`${groupLocalDate()}T12:00:00Z`);
  const date = (offset: number) => { const d = new Date(today); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  for (const [index, id] of scheduleMeetingIds.entries()) await db.collection("weeklyMeetings").doc(id).set({
    section: "Scouts", meetingDate: date(index - 1), status: index === 0 ? "closed" : "open", theme: `Schedule fixture ${index}`, location: "Scout den", entries: [], injuries: [], notes: "", programmeNotes: "",
    activities: index === 1 ? [{ id: "game", activity: "River banks", leader: "", notes: "", equipment: "", durationMinutes: 10 }, { id: "relay", activity: "Team relay with a deliberately long descriptive name that must wrap on a mobile screen", leader: "", notes: "", equipment: "", durationMinutes: 15 }] : [],
    badgeworkPlan: index === 1 ? [{ id: "badge", badge: "Teamwork · Level 2", leader: "", notes: "", equipment: "", durationMinutes: 10 }] : [], testData: true
  });
  return date(0);
}
export async function clearScheduleMeetings() {
  const db = scheduleFixtureDb();
  for (const id of scheduleMeetingIds) {
    await db.collection("weeklyMeetings").doc(id).delete();
    await db.collection("parentWeeklyMeetings").doc(id).delete();
  }
  await db.doc("siteSettings/scheduleExperience").delete();
}
