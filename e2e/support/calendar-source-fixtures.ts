import { getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { scheduleFixtureDb } from "./schedule-fixtures";
import { scheduleToday } from "../../src/services/scheduleSelection";
import { shiftCalendarMonth } from "../../src/services/groupCalendar";
export async function seedCalendarSources() {
  const db = scheduleFixtureDb();
  const month = scheduleToday().slice(0, 7);
  const uid = `sw336-parent-${Date.now()}`;
  const email = `${uid}@example.invalid`;
  const auth = getAuth(getApps().find(app => app.name === "schedule-fixtures")!);
  await auth.createUser({uid, email, password: process.env.E2E_TEST_USER_PASSWORD!});
  const prefix = "sw336-calendar-";
  const meetingId = `${prefix}meeting`, eventId = `${prefix}event`, secondId = `${prefix}second`, privateId = `${prefix}private`, spanId = `${prefix}span`;
  const event = {title: "SW336 Camp", eventType: "Activity", section: "Scouts", location: "Scout den", description: "Shared programme. " + "Detailed programme notes and arrangements. ".repeat(50) + "Final shared marker.", meetingPoint: "Den", returnDetails: "Den", leaderNotes: "SW336 private leader note", startDate: `${month}-22`, endDate: `${month}-24`, status: "open", consentRequired: false, consentLinkToken: "", attendance: {}, consent: {}};
  const safeEvent = Object.fromEntries(["title", "description", "eventType", "section", "location", "startDate", "endDate", "status"].map(key => [key, event[key as keyof typeof event]]));
  const records: Record<string, Record<string, unknown>> = {
    "siteSettings/calendarExperience": {version: "redesigned"},
    [`members/${prefix}child`]: {firstName: "Calendar", lastName: "Child", displayName: "Calendar Child", dateOfBirth: "2014-01-01", section: "Scouts", sections: ["Scouts"], status: "active"},
    [`parentAccounts/${uid}`]: {uid, email, displayName: "Calendar Parent", mobileNumber: "000000000", status: "approved", memberIds: [`${prefix}child`], linkedSections: ["Beavers"], requestedChildren: []},
    [`weeklyMeetings/${meetingId}`]: {section: "Scouts", meetingDate: `${month}-22`, status: "open", theme: "SW336 Pioneering", location: "Den", plannedActivities: "", plannedBadgework: "", programmeNotes: JSON.stringify({marker: "weekly-programme-v1", theme: "SW336 Pioneering", notes: "SW336 private programme note"}), notes: "SW336 private meeting note", entries: [], injuries: []},
    [`parentWeeklyMeetings/${meetingId}`]: {section: "Scouts", meetingDate: `${month}-22`, status: "open", theme: "SW336 Pioneering", location: "Den", activities: [{name: "Pioneering challenge", durationMinutes: 20, equipment: "Ropes"}], badgework: []},
    [`events/${eventId}`]: event,
    [`parentGalleryEvents/${eventId}`]: {...safeEvent, eventId},
    [`events/${secondId}`]: {...event, title: "SW336 Second event", endDate: `${month}-22`},
    [`events/${privateId}`]: {...event, title: "SW336 Private audience", section: "Beavers"},
    [`events/${spanId}`]: {...event, title: "SW336 Spanning event", startDate: `${shiftCalendarMonth(month, -1)}-28`, endDate: `${month}-03`},
    [`events/${prefix}outside`]: {...event, title: "SW336 Outside month", startDate: "2199-01-01", endDate: "2199-01-02"}
  };
  const previous = await Promise.all(Object.keys(records).map(path => db.doc(path).get()));
  const batch = db.batch(); Object.entries(records).forEach(([path, data]) => batch.set(db.doc(path), data)); await batch.commit();
  return {db, month, uid, email, meetingId, eventId, secondId, spanId, cleanup: async () => {
    const restore = db.batch(); previous.forEach(snapshot => snapshot.exists ? restore.set(snapshot.ref, snapshot.data()!) : restore.delete(snapshot.ref)); await restore.commit(); await auth.deleteUser(uid);
  }};
}
