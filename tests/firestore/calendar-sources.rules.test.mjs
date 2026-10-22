import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
let env;
before(async () => {
  env = await initializeTestEnvironment({projectId: "demo-coolock-ardlea-scouts", firestore: {host: "127.0.0.1", port: 8080, rules: await readFile("firestore.rules", "utf8")}});
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    const records = {
      "adminUsers/calendar-source-leader": {role: "leader", active: true, sections: ["Scouts"]},
      "parentAccounts/calendar-source-parent": {status: "approved", memberIds: ["calendar-source-child"], linkedSections: ["Beavers"]},
      "members/calendar-source-child": {status: "active", section: "Scouts", sections: ["Scouts"]},
      "weeklyMeetings/calendar-source-meeting": {section: "Scouts", meetingDate: "2026-10-22", notes: "Private notes", injuries: []},
      "parentWeeklyMeetings/calendar-source-meeting": {section: "Scouts", meetingDate: "2026-10-22", theme: "Shared programme"},
      "parentGalleryEvents/calendar-source-event": {eventId: "calendar-source-event", section: "Scouts", startDate: "2026-10-21", endDate: "2026-10-24", status: "open", title: "Shared event"},
      "events/calendar-source-event": {section: "Scouts", startDate: "2026-10-21", endDate: "2026-10-24", leaderNotes: "Private notes", attendance: {privateMember: "attending"}}
    };
    for (const [path, value] of Object.entries(records)) await setDoc(doc(db, path), value);
  });
});
after(async () => env?.cleanup());
const meetings = (db, root, section) => query(collection(db, root), where("section", "==", section), where("meetingDate", ">=", "2026-10-01"), where("meetingDate", "<=", "2026-10-31"));
const events = (db, root, section) => query(collection(db, root), where("section", "==", section), where("startDate", ">=", "2026-10-01"), where("startDate", "<=", "2026-10-31"));
test("month-scoped canonical leader queries retain section boundaries", async () => {
  const db = env.authenticatedContext("calendar-source-leader").firestore();
  await assertSucceeds(getDocs(meetings(db, "weeklyMeetings", "Scouts")));
  await assertSucceeds(getDocs(events(db, "events", "Scouts")));
  await assertFails(getDocs(meetings(db, "weeklyMeetings", "Beavers")));
  await assertFails(getDocs(events(db, "events", "Beavers")));
  await assertFails(getDocs(collection(db, "events")));
});
test("parent month queries use current child sections and safe programmes; raw private records remain denied", async () => {
  const db = env.authenticatedContext("calendar-source-parent").firestore();
  await assertSucceeds(getDocs(meetings(db, "parentWeeklyMeetings", "Scouts")));
  await assertSucceeds(getDocs(events(db, "parentGalleryEvents", "Scouts")));
  await assertFails(getDocs(meetings(db, "parentWeeklyMeetings", "Beavers")));
  for (const root of ["events", "weeklyMeetings"]) await assertFails(getDoc(doc(db, root, root === "events" ? "calendar-source-event" : "calendar-source-meeting")));
  await env.withSecurityRulesDisabled(async ctx => {await setDoc(doc(ctx.firestore(), "members/calendar-source-child"), {status: "inactive", section: "Scouts", sections: ["Scouts"]});});
  await assertFails(getDocs(meetings(db, "parentWeeklyMeetings", "Scouts")));
  await assertFails(getDocs(events(db, "parentGalleryEvents", "Scouts")));
});
