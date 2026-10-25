import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, where, setDoc, serverTimestamp } from "firebase/firestore";
let env;
const dbFor = uid => env.authenticatedContext(`training-${uid}`).firestore();
const ref = (db, category = "garda-vetting", leader = "leader") => doc(db, `adminUsers/training-${leader}/training/${category}`);
const data = (uid, revision = 1, completedDate = "2026-01-01", expiryDate = "2026-10-24") => ({ completedDate, expiryDate, revision, updatedBy: `training-${uid}`, updatedAt: serverTimestamp() });
const setting = (db, version, uid = "super") => setDoc(doc(db, "siteSettings/leaderTrainingExperience"), { version, updatedBy: `training-${uid}`, updatedAt: serverTimestamp() });
before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-coolock-ardlea-scouts", firestore: { host: "127.0.0.1", port: 8080, rules: await readFile("firestore.rules", "utf8") } });
  await env.withSecurityRulesDisabled(async ctx => {
    for (const [uid, role, active] of [["super", "super-admin", true], ["admin", "admin", true], ["group", "leader", true], ["deputy", "leader", true], ["leader", "leader", true], ["other", "leader", true], ["inactive", "leader", false], ["secretary", "leader", true]]) {
      await setDoc(doc(ctx.firestore(), `adminUsers/training-${uid}`), { role, active, sections: ["Scouts"] });
    }
    for (const [uid, scoutingRole] of [["group", "Group Leader"], ["deputy", "Deputy Group Leader"], ["secretary", "Group Secretary"]]) await setDoc(doc(ctx.firestore(), `organisationLeadership/training-${uid}`), { active: true, scoutingRole });
    await setDoc(doc(ctx.firestore(), "parentAccounts/training-parent"), { status: "approved" });
  });
});
after(async () => env?.cleanup());

test("training is default off; only Superuser can change its independent validated switch", async () => {
  await assertFails(getDoc(ref(dbFor("leader"))));
  for (const uid of ["admin", "group", "leader", "parent", "inactive", "outsider"]) {
    await assertSucceeds(getDoc(doc(dbFor(uid), "siteSettings/leaderTrainingExperience")));
    await assertFails(setting(dbFor(uid), "redesigned", uid));
  }
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "siteSettings/leaderTrainingExperience")));
  await assertFails(setting(dbFor("super"), "invalid"));
  await assertFails(setDoc(doc(dbFor("super"), "siteSettings/leaderTrainingExperience"), { version: "redesigned", updatedBy: "training-super", updatedAt: serverTimestamp(), unexpected: true }));
  await assertSucceeds(setting(dbFor("super"), "redesigned"));
});

test("all categories persist and renew in place, require a real leader, reject stale writes and delete", async () => {
  const db = dbFor("admin");
  for (const category of ["garda-vetting", "first-aid", "child-protection"]) {
    await assertSucceeds(setDoc(ref(db, category), data("admin")));
    await assertSucceeds(setDoc(ref(db, category), data("admin", 2, "2026-10-24", "2029-03-12")));
    assert.equal((await getDoc(ref(dbFor("leader"), category))).data().expiryDate, "2029-03-12");
    await assertFails(setDoc(ref(db, category), data("admin", 2)));
    await assertFails(deleteDoc(ref(db, category)));
  }
  assert.equal((await getDocs(collection(db, "adminUsers/training-leader/training"))).size, 3);
  await assertFails(setDoc(ref(db, "garda-vetting", "missing"), data("admin")));
  await assertFails(setDoc(ref(db, "unknown"), data("admin")));
  await assertFails(setDoc(ref(db, "garda-vetting", "parent"), data("admin")));
});

test("sensitive dates are readable only by self or existing group managers; read-only self cannot write", async () => {
  for (const uid of ["leader", "admin", "super", "group", "deputy"]) await assertSucceeds(getDoc(ref(dbFor(uid))));
  for (const uid of ["other", "secretary", "parent", "inactive", "outsider"]) {
    await assertFails(getDoc(ref(dbFor(uid))));
    await assertFails(getDocs(collection(dbFor(uid), "adminUsers/training-leader/training")));
    await assertFails(setDoc(ref(dbFor(uid)), data(uid, 3)));
  }
  await assertFails(getDoc(ref(env.unauthenticatedContext().firestore())));
  await assertFails(setDoc(ref(dbFor("leader")), data("leader", 3)));
  await assertFails(getDoc(ref(dbFor("leader"), "first-aid", "other")));
  for (const [uid, revision] of [["group", 1], ["deputy", 2], ["super", 3]]) await assertSucceeds(setDoc(ref(dbFor(uid), "first-aid", "other"), data(uid, revision)));
  for (const uid of ["group", "deputy"]) {
    await assertFails(setDoc(ref(dbFor(uid), "first-aid", "admin"), data(uid)));
    await assertFails(setDoc(ref(dbFor(uid), "first-aid", "super"), data(uid)));
    await assertFails(setDoc(ref(dbFor(uid), "first-aid", uid), data(uid)));
  }
});

test("Rules reject malformed dates, ordering, identity and extra sensitive fields; partial records are allowed", async () => {
  const db = dbFor("admin"), target = ref(db, "first-aid", "admin");
  for (const completed of ["2026-02-29", "2026-04-31", "2026-10-24T00:00:00Z", 123, null]) await assertFails(setDoc(target, data("admin", 1, completed, "2027-01-01")));
  await assertFails(setDoc(target, data("admin", 1, "2026-10-25", "2026-10-24")));
  await assertFails(setDoc(target, { ...data("admin"), evidence: "secret" }));
  await assertFails(setDoc(target, { ...data("admin"), updatedBy: "training-leader" }));
  await assertFails(setDoc(target, { ...data("admin"), revision: 1.5 }));
  await assertSucceeds(setDoc(target, data("admin", 1, "2024-02-29", "")));
  await assertSucceeds(setDoc(target, data("admin", 2, "", "2027-01-01")));
  await assertSucceeds(setDoc(target, data("admin", 3, "", "")));
  await assertSucceeds(setDoc(target, data("admin", 4, "2026-10-24", "2026-10-24")));
});

test("disabling denies direct reads and writes but retains dates for re-enable", async () => {
  await assertSucceeds(setting(dbFor("super"), "existing"));
  await assertFails(getDoc(ref(dbFor("admin"))));
  await assertFails(setDoc(ref(dbFor("admin")), data("admin", 3)));
  await assertSucceeds(setting(dbFor("super"), "redesigned"));
  assert.equal((await assertSucceeds(getDoc(ref(dbFor("leader"))))).data().expiryDate, "2029-03-12");
});

 test("renewal calendar queries enforce the same private readers and opt-in validation", async () => {
  const admin = dbFor("admin"), target = ref(admin, "child-protection", "other");
  const reminder = {...data("admin", 1, "", "2040-06-15"), showOnCalendar: true};
  await assertSucceeds(setDoc(target, reminder));
  const reminders = db => query(collection(db, "adminUsers/training-other/training"), where("expiryDate", ">=", "2040-06-01"), where("expiryDate", "<=", "2040-06-30"));
  for (const uid of ["other", "admin", "super", "group", "deputy"]) assert.equal((await assertSucceeds(getDocs(reminders(dbFor(uid))))).size, 1);
  for (const uid of ["leader", "secretary", "parent", "inactive", "outsider"]) await assertFails(getDocs(reminders(dbFor(uid))));
  await assertFails(getDocs(reminders(env.unauthenticatedContext().firestore())));
  await assertFails(setDoc(target, {...data("admin", 2), expiryDate: "", showOnCalendar: true}));
  await assertFails(setDoc(target, {...data("admin", 2), showOnCalendar: "true"}));
  await assertFails(setDoc(ref(dbFor("other"), "child-protection", "other"), {...reminder, ...data("other", 2)}));
  await assertSucceeds(setDoc(target, {...data("admin", 2, "", "2040-07-01"), showOnCalendar: true}));
  assert.equal((await getDocs(reminders(admin))).size, 0);
  await assertSucceeds(setDoc(target, {...data("admin", 3, "", "2040-06-15"), showOnCalendar: false}));
  assert.equal((await getDoc(target)).data().expiryDate, "2040-06-15");
  await assertSucceeds(setting(dbFor("super"), "existing"));
  await assertFails(getDocs(reminders(admin)));
  await assertSucceeds(setting(dbFor("super"), "redesigned"));
  assert.equal((await getDoc(target)).data().showOnCalendar, false);
});
