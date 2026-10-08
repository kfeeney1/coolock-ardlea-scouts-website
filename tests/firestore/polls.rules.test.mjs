import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, value] of entries) await setDoc(doc(db, path), value);
  });
}
async function seedPoll(id = "poll-1", { audienceType = "parents", scopeSections = ["Beavers"], scopeType = "sections", status = "published" } = {}) {
  await seed([
    [`polls/${id}`, { question: "Choose a group activity", options: ["Hike", "Camp"], audienceType, scopeType, scopeSections, status, createdBy: "beaver-leader", createdAt: new Date(), updatedBy: "beaver-leader", updatedAt: new Date() }],
    [`polls/${id}/audienceSections/Beavers`, { pollId: id, section: "Beavers", audienceType, scopeType, status }],
    [`polls/${id}/results/0`, { option: "Hike", optionIndex: 0, count: 0 }],
    [`polls/${id}/results/1`, { option: "Camp", optionIndex: 1, count: 0 }]
  ]);
}

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed([
    ["adminUsers/beaver-leader", { active: true, role: "leader", sections: ["Beavers"] }],
    ["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }],
    ["adminUsers/group-leader", { active: true, role: "leader", sections: ["Beavers"] }],
    ["organisationLeadership/group-leader", { active: true, scoutingRole: "Group Leader" }],
    ["parentAccounts/parent-a", { status: "approved", memberIds: ["member-a"], linkedSections: ["Beavers"] }],
    ["parentAccounts/parent-b", { status: "approved", memberIds: ["member-b"], linkedSections: ["Scouts"] }],
    ["members/member-a", { status: "active", sections: ["Beavers"] }],
    ["members/member-b", { status: "active", sections: ["Scouts"] }]
  ]);
});
after(async () => { await testEnv.cleanup(); });

test("approved linked parent and scoped leader can read only eligible poll audiences", async () => {
  await seedPoll();
  const parent = testEnv.authenticatedContext("parent-a").firestore();
  const beaverLeader = testEnv.authenticatedContext("beaver-leader").firestore();
  const scoutLeader = testEnv.authenticatedContext("scout-leader").firestore();
  await assertSucceeds(getDoc(doc(parent, "polls/poll-1")));
  await assertFails(getDoc(doc(scoutLeader, "polls/poll-1")));
  await assertSucceeds(getDoc(doc(beaverLeader, "polls/poll-1")));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), "polls/poll-1")));
});

test("parent response is private, cannot list responses or view results", async () => {
  await seedPoll();
  await seed([
    ["polls/poll-1/responses/parent-a", { accountUid: "parent-a", option: "Hike", optionIndex: 0, createdAt: new Date(), updatedAt: new Date() }]
  ]);
  const parent = testEnv.authenticatedContext("parent-a").firestore();
  const anotherParent = testEnv.authenticatedContext("parent-b").firestore();
  const beaverLeader = testEnv.authenticatedContext("beaver-leader").firestore();
  await assertSucceeds(getDoc(doc(parent, "polls/poll-1/responses/parent-a")));
  await assertFails(getDoc(doc(anotherParent, "polls/poll-1/responses/parent-a")));
  await assertFails(getDocs(collection(parent, "polls/poll-1/responses")));
  await assertFails(getDocs(query(collection(anotherParent, "polls/poll-1/responses"))));
  await assertFails(getDoc(doc(parent, "polls/poll-1/results/0")));
  await assertSucceeds(getDocs(collection(beaverLeader, "polls/poll-1/results")));
  await assertFails(getDocs(collection(testEnv.authenticatedContext("scout-leader").firestore(), "polls/poll-1/results")));
});

test("leaders cannot create polls outside their section and parents cannot reach another section's poll", async () => {
  const beaverLeader = testEnv.authenticatedContext("beaver-leader").firestore();
  const parent = testEnv.authenticatedContext("parent-b").firestore();
  const outside = doc(beaverLeader, "polls/outside-poll");
  await assertFails(setDoc(outside, { question: "Choose a group activity", options: ["Hike", "Camp"], audienceType: "parents", scopeType: "sections", scopeSections: ["Scouts"], status: "draft", createdBy: "beaver-leader", createdAt: serverTimestamp(), updatedBy: "beaver-leader", updatedAt: serverTimestamp() }));
  await seedPoll("scouts-poll", { scopeSections: ["Scouts"] });
  await assertSucceeds(getDoc(doc(parent, "polls/scouts-poll")));
});

test("poll responses require a published poll, an eligible account, and atomic aggregate updates", async () => {
  await seedPoll();
  const parent = testEnv.authenticatedContext("parent-a").firestore();
  const responseRef = doc(parent, "polls/poll-1/responses/parent-a");
  const resultRef = doc(parent, "polls/poll-1/results/0");
  const batch = writeBatch(parent);
  batch.update(resultRef, { count: 1, updatedAt: serverTimestamp() });
  batch.set(responseRef, { accountUid: "parent-a", option: "Hike", optionIndex: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(responseRef));

  const changed = writeBatch(parent);
  changed.update(doc(parent, "polls/poll-1/results/0"), { count: 0, updatedAt: serverTimestamp() });
  changed.update(doc(parent, "polls/poll-1/results/1"), { count: 1, updatedAt: serverTimestamp() });
  changed.update(responseRef, { option: "Camp", optionIndex: 1, updatedAt: serverTimestamp() });
  await assertSucceeds(changed.commit());

  const duplicate = writeBatch(parent);
  duplicate.update(doc(parent, "polls/poll-1/results/1"), { count: 2, updatedAt: serverTimestamp() });
  duplicate.set(doc(parent, "polls/poll-1/responses/parent-a"), { accountUid: "parent-a", option: "Camp", optionIndex: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await assertFails(duplicate.commit());
});

test("unapproved links and closed polls reject direct response writes", async () => {
  await seedPoll();
  await seed([["parentAccounts/pending", { status: "pending", memberIds: ["member-a"] }]]);
  const pending = testEnv.authenticatedContext("pending").firestore();
  await assertFails(getDoc(doc(pending, "polls/poll-1")));
  const parent = testEnv.authenticatedContext("parent-a").firestore();
  const makeResponse = (db, uid) => {
    const batch = writeBatch(db);
    batch.update(doc(db, "polls/poll-1/results/0"), { count: 1, updatedAt: serverTimestamp() });
    batch.set(doc(db, `polls/poll-1/responses/${uid}`), { accountUid: uid, option: "Hike", optionIndex: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return batch.commit();
  };
  await assertFails(makeResponse(pending, "pending"));

  await assertSucceeds(updateDoc(doc(testEnv.authenticatedContext("beaver-leader").firestore(), "polls/poll-1"), { status: "closed", closedAt: serverTimestamp(), updatedBy: "beaver-leader", updatedAt: serverTimestamp() }));
  await assertFails(makeResponse(parent, "parent-a"));
});

test("leader audience polls exclude parents and require a currently active leader account", async () => {
  await seedPoll("leader-poll", { audienceType: "leaders" });
  const beaverLeader = testEnv.authenticatedContext("beaver-leader").firestore();
  const parent = testEnv.authenticatedContext("parent-a").firestore();
  const scoutLeader = testEnv.authenticatedContext("scout-leader").firestore();
  await assertSucceeds(getDoc(doc(beaverLeader, "polls/leader-poll")));
  await assertFails(getDoc(doc(parent, "polls/leader-poll")));
  await assertFails(getDoc(doc(scoutLeader, "polls/leader-poll")));
});
