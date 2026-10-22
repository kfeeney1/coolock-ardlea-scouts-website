import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
let env;
before(async () => {
  env = await initializeTestEnvironment({projectId: "demo-coolock-ardlea-scouts", firestore: {host: "127.0.0.1", port: 8080, rules: await readFile("firestore.rules", "utf8")}});
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    for (const [uid, role] of [["calendar-super", "super-admin"], ["calendar-admin", "admin"], ["calendar-leader", "leader"]]) await setDoc(doc(db, "adminUsers", uid), {active: true, role, sections: ["Scouts"]});
    await setDoc(doc(db, "parentAccounts/calendar-parent"), {status: "approved"});
    await setDoc(doc(db, "parentAccounts/calendar-pending"), {status: "pending"});
    await setDoc(doc(db, "members/calendar-member-record"), {status: "active", accountUid: "calendar-member"});
    await setDoc(doc(db, "adminUsers/calendar-inactive"), {active: false, role: "leader", sections: ["Scouts"]});
    await setDoc(doc(db, "siteSettings/maintenanceExperience"), {version: "existing"});
  });
});
after(async () => env?.cleanup());
test("Calendar rollout is independently readable, strictly validated and only writable by active Superusers", async () => {
  for (const uid of ["calendar-admin", "calendar-leader", "calendar-parent", "calendar-outsider", "calendar-inactive"]) {
    const db = env.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(db, "siteSettings/calendarExperience")));
    await assertFails(setDoc(doc(db, "siteSettings/calendarExperience"), {version: "redesigned", updatedBy: uid, updatedAt: serverTimestamp()}));
  }
  const db = env.authenticatedContext("calendar-super").firestore();
  const setting = doc(db, "siteSettings/calendarExperience");
  await assertFails(setDoc(setting, {version: "invalid", updatedBy: "calendar-super", updatedAt: serverTimestamp()}));
  await assertFails(setDoc(setting, {version: "redesigned", updatedBy: "other", updatedAt: serverTimestamp()}));
  await assertFails(setDoc(setting, {version: "redesigned", updatedBy: "calendar-super", updatedAt: serverTimestamp(), extra: true}));
  await assertSucceeds(setDoc(setting, {version: "redesigned", updatedBy: "calendar-super", updatedAt: serverTimestamp()}));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "siteSettings/calendarExperience")));
});
test("membership references revalidate role unions, cannot be forged, revoked sources fail, Calendar cannot bypass disabled Maintenance", async () => {
  for (const [uid, kind, sourceId] of [["calendar-super", "leader", "calendar-super"], ["calendar-leader", "leader", "calendar-leader"], ["calendar-parent", "parent", "calendar-parent"], ["calendar-member", "member", "calendar-member-record"]]) {
    const db = env.authenticatedContext(uid).firestore();
    const ref = doc(db, "calendar/group/access", uid);
    await assertSucceeds(setDoc(ref, {kind, sourceId}));
    await assertSucceeds(getDoc(ref));
    await assertFails(getDocs(collection(db, "calendar/group/access")));
    await assertFails(getDoc(doc(db, "calendar/group/access/other")));
    await assertFails(setDoc(doc(db, "calendar/other/access", uid), {kind, sourceId}));
    await assertFails(setDoc(ref, {kind, sourceId, granted: true}));
    await assertFails(getDoc(doc(db, "maintenance/group/tasks/secret")));
  }
  for (const [uid, kind, sourceId] of [["calendar-outsider", "member", "calendar-member-record"], ["calendar-pending", "parent", "calendar-pending"], ["calendar-inactive", "leader", "calendar-inactive"]]) {
    await assertFails(setDoc(doc(env.authenticatedContext(uid).firestore(), "calendar/group/access", uid), {kind, sourceId}));
  }
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), "calendar/group/access/anonymous"), {kind: "parent", sourceId: "calendar-parent"}));
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), "parentAccounts/calendar-parent"), {status: "pending"}); });
  await assertFails(getDoc(doc(env.authenticatedContext("calendar-parent").firestore(), "calendar/group/access/calendar-parent")));
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), "siteSettings/calendarExperience"), {version: "existing"}); });
  const leader = env.authenticatedContext("calendar-leader").firestore();
  await assertFails(getDoc(doc(leader, "calendar/group/access/calendar-leader")));
  await assertFails(setDoc(doc(leader, "calendar/group/access/calendar-leader"), {kind: "leader", sourceId: "calendar-leader"}));
});
