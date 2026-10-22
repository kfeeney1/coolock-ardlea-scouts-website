import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch, updateDoc, deleteDoc, collectionGroup, serverTimestamp } from "firebase/firestore";
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
test("selected parent programmes whitelist source fields, deny draft/stale data and revoke audience access", async () => {
  const id = "calendar-selected-event", child = "calendar-selected-child", uid = "calendar-selected-parent";
  const programme = {eventId: id, title: "Private camp", description: "Programme", eventType: "Camp", section: "Cubs", location: "Den", startDate: "2026-10-22", endDate: "2026-10-24", status: "open"};
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "parentAccounts", uid), {status: "approved", memberIds: [child], linkedSections: ["Beavers"]});
    await setDoc(doc(db, "members", child), {status: "active", sections: ["Beavers"], section: "Beavers"});
    await setDoc(doc(db, "events", id), {...programme, leaderNotes: "Restricted", attendance: {other: "attending"}});
    await setDoc(doc(db, "events", id, "programmes", "parent"), programme);
    await setDoc(doc(db, "events", id, "audienceMembers", child), {eventId: id, memberId: child, startDate: programme.startDate, endDate: programme.endDate, programmeVisible: true});
  });
  const db = env.authenticatedContext(uid).firestore(), target = doc(db, "events", id, "programmes", "parent");
  await assertSucceeds(setDoc(doc(db, "events", id, "programmeAccess", uid), {memberId: child}));
  await assertSucceeds(getDoc(target));
  await assertFails(getDoc(doc(db, "events", id)));
  await assertFails(getDoc(doc(env.authenticatedContext("unrelated-parent").firestore(), target.path)));
  await assertFails(setDoc(target, programme));
  await env.withSecurityRulesDisabled(async ctx => {await setDoc(doc(ctx.firestore(), target.path), {...programme, leaderNotes: "Leaked"});});
  await assertFails(getDoc(target));
  await env.withSecurityRulesDisabled(async ctx => {await setDoc(doc(ctx.firestore(), target.path), programme); await setDoc(doc(ctx.firestore(), "events", id), {...programme, title: "Rescheduled"});});
  await assertFails(getDoc(target));
  await env.withSecurityRulesDisabled(async ctx => {await setDoc(doc(ctx.firestore(), "events", id), programme);});
  await env.withSecurityRulesDisabled(async ctx => {await setDoc(doc(ctx.firestore(), "members", child), {status: "inactive", section: "Beavers"});});
  await assertFails(getDoc(target));
});

test("audience date reschedules and safe programme writes commit with source and cannot change hidden assignment", async () => {
  const id = "calendar-atomic-source", child = "calendar-hidden-child";
  const programme = {eventId: id, title: "Mixed camp", description: "Programme", eventType: "Camp", section: "Cubs", location: "Den", startDate: "2026-10-22", endDate: "2026-10-24", status: "open"};
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "adminUsers/calendar-atomic-leader"), {role: "leader", active: true, sections: ["Cubs"]});
    await setDoc(doc(db, "parentAccounts/calendar-atomic-parent"), {status: "approved", memberIds: [child]});
    await setDoc(doc(db, "members", child), {status: "active", section: "Beavers", sections: ["Beavers"]});
    await setDoc(doc(db, "events", id), {...programme, audience: {version: 3, mode: "mixed", sectionIds: ["Cubs"], memberIds: [], resolvedMemberIds: []}});
    await setDoc(doc(db, "events", id, "audienceMembers", child), {eventId: id, eventSection: "Cubs", memberId: child, scopeSection: "Beavers", selectedBySection: false, selectedIndividually: true});
  });
  const db = env.authenticatedContext("calendar-atomic-leader").firestore();
  const row = doc(db, "events", id, "audienceMembers", child), target = doc(db, "events", id, "programmes", "parent");
  await assertFails(updateDoc(row, {startDate: "2026-11-01", endDate: "2026-11-02", programmeVisible: true, updatedBy: "calendar-atomic-leader", updatedAt: serverTimestamp()}));
  const batch = writeBatch(db), changed = {...programme, startDate: "2026-11-01", endDate: "2026-11-02"};
  batch.update(doc(db, "events", id), {startDate: changed.startDate, endDate: changed.endDate});
  batch.set(target, changed);
  batch.update(row, {startDate: changed.startDate, endDate: changed.endDate, programmeVisible: true, updatedBy: "calendar-atomic-leader", updatedAt: serverTimestamp()});
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(row, {scopeSection: "Cubs"}));
  const parent = env.authenticatedContext("calendar-atomic-parent").firestore();
  await assertSucceeds(getDocs(query(collectionGroup(parent, "audienceMembers"), where("memberId", "==", child), where("programmeVisible", "==", true), where("startDate", ">=", "2026-11-01"), where("startDate", "<=", "2026-11-30"))));
  await assertSucceeds(setDoc(doc(parent, "events", id, "programmeAccess", "calendar-atomic-parent"), {memberId: child}));
  await assertSucceeds(getDoc(doc(parent, target.path)));
  await assertSucceeds(deleteDoc(row));
  await assertFails(getDoc(doc(parent, target.path)));
});
test("an eight-child parent uses a source reference without broad audience reads or a Rules lookup overflow", async () => {
  const id = "calendar-eight-source", uid = "calendar-eight-parent", ids = Array.from({length: 8}, (_, index) => `calendar-eight-child-${index}`);
  const programme = {eventId: id, title: "Eight-child programme", description: "Safe", eventType: "Camp", section: "Scouts", location: "Den", startDate: "2026-10-22", endDate: "2026-10-24", status: "open"};
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "parentAccounts", uid), {status: "approved", memberIds: ids});
    for (const child of ids) await setDoc(doc(db, "members", child), {status: "active", section: "Scouts"});
    await setDoc(doc(db, "events", id), programme);
    await setDoc(doc(db, "events", id, "programmes", "parent"), programme);
    await setDoc(doc(db, "events", id, "audienceMembers", ids[7]), {eventId: id, memberId: ids[7]});
  });
  const db = env.authenticatedContext(uid).firestore(), proof = doc(db, "events", id, "programmeAccess", uid);
  await assertFails(setDoc(proof, {memberId: ids[0]}));
  await assertFails(setDoc(doc(db, "events", id, "programmeAccess", "another-parent"), {memberId: ids[7]}));
  await assertSucceeds(setDoc(proof, {memberId: ids[7]}));
  await assertSucceeds(getDoc(doc(db, "events", id, "programmes", "parent")));
  await env.withSecurityRulesDisabled(async ctx => {await setDoc(doc(ctx.firestore(), "members", ids[7]), {status: "inactive", section: "Scouts"});});
  await assertFails(getDoc(doc(db, "events", id, "programmes", "parent")));
});
