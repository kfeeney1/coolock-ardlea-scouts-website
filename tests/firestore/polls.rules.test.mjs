import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, collectionGroup, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";

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
    [`polls/${id}/audienceSections/Beavers`, { pollId: id, section: "Beavers", audienceType, scopeType, scopeSections, status }],
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
    ["adminUsers/super-admin", { active: true, role: "super-admin", sections: ["Group"] }],
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

test("draft poll roots and discovery indexes stay hidden from respondents until publication", async () => {
  await seedPoll("draft-poll", { status: "draft" });
  const parent = testEnv.authenticatedContext("parent-a").firestore();
  await assertFails(getDoc(doc(parent, "polls/draft-poll")));
  await assertFails(getDoc(doc(parent, "polls/draft-poll/audienceSections/Beavers")));
});

test("section leader manager index reads constrain results to fully authorised poll scopes", async () => {
  await seedPoll("beavers-draft", { audienceType: "parents", scopeSections: ["Beavers"], status: "draft" });
  await seedPoll("overlapping-draft", { audienceType: "parents", scopeSections: ["Beavers", "Scouts"], status: "draft" });
  const beaverLeader = testEnv.authenticatedContext("beaver-leader").firestore();
  const broadQuery = query(collectionGroup(beaverLeader, "audienceSections"),
    where("audienceType", "==", "parents"), where("scopeType", "==", "sections"));
  await assertFails(getDocs(broadQuery));
  const scopedQuery = query(collectionGroup(beaverLeader, "audienceSections"),
    where("audienceType", "==", "parents"), where("scopeType", "==", "sections"), where("scopeSections", "in", [["Beavers"]]));
  const snapshot = await assertSucceeds(getDocs(scopedQuery));
  assert.deepEqual(snapshot.docs.map((item) => item.data().pollId), ["beavers-draft"]);
  const outOfScopeQuery = query(collectionGroup(beaverLeader, "audienceSections"),
    where("audienceType", "==", "parents"), where("scopeType", "==", "sections"), where("scopeSections", "in", [["Beavers", "Scouts"]]));
  await assertFails(getDocs(outOfScopeQuery));
});

test("parent responses stay private and parent voters cannot read results", async () => {
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
  await assertFails(getDocs(collection(parent, "polls/poll-1/results")));
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

test("group leadership can create a complete whole-group draft; section leaders cannot", async () => {
  const makeGroupDraft = (db, id) => {
    const batch = writeBatch(db);
    batch.set(doc(db, `polls/${id}`), {
      question: "Poll", options: ["Poll1", "Poll2"], audienceType: "leaders", scopeType: "group",
      scopeSections: ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"], status: "draft",
      createdBy: "group-leader", createdAt: serverTimestamp(), updatedBy: "group-leader", updatedAt: serverTimestamp()
    });
    ["Poll1", "Poll2"].forEach((option, optionIndex) => batch.set(doc(db, `polls/${id}/results/${optionIndex}`), { option, optionIndex, count: 0 }));
    ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"].forEach((section) => batch.set(doc(db, `polls/${id}/audienceSections/${section}`), {
      pollId: id, section, audienceType: "leaders", scopeType: "group", scopeSections: ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"], status: "draft"
    }));
    return batch.commit();
  };
  const groupLeader = testEnv.authenticatedContext("group-leader").firestore();
  const beaverLeader = testEnv.authenticatedContext("beaver-leader").firestore();
  await assertSucceeds(makeGroupDraft(groupLeader, "whole-group-draft"));
  // Replaying the same create cannot overwrite or duplicate the already-created poll.
  await assertFails(makeGroupDraft(groupLeader, "whole-group-draft"));
  await assertFails(makeGroupDraft(beaverLeader, "unauthorised-whole-group-draft"));
});

test("poll responses require a published poll, an eligible account, and atomic aggregate updates", async () => {
  await seedPoll();
  const parent = testEnv.authenticatedContext("parent-a").firestore();
  await assertFails(getDocs(collection(parent, "polls/poll-1/results")));
  const responseRef = doc(parent, "polls/poll-1/responses/parent-a");
  const resultRef = doc(parent, "polls/poll-1/results/0");
  const batch = writeBatch(parent);
  batch.update(resultRef, { count: 1, updatedAt: serverTimestamp() });
  batch.set(responseRef, { accountUid: "parent-a", option: "Hike", optionIndex: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(responseRef));
  await assertFails(getDocs(collection(parent, "polls/poll-1/results")));
  await assertFails(getDocs(collection(testEnv.authenticatedContext("parent-b").firestore(), "polls/poll-1/results")));

  const changed = writeBatch(parent);
  changed.update(doc(parent, "polls/poll-1/results/0"), { count: 0, updatedAt: serverTimestamp() });
  changed.update(doc(parent, "polls/poll-1/results/1"), { count: 1, updatedAt: serverTimestamp() });
  changed.update(responseRef, { option: "Camp", optionIndex: 1, updatedAt: serverTimestamp() });
  await assertSucceeds(changed.commit());

  const duplicate = writeBatch(parent);
  duplicate.update(doc(parent, "polls/poll-1/results/1"), { count: 2, updatedAt: serverTimestamp() });
  duplicate.set(doc(parent, "polls/poll-1/responses/parent-a"), { accountUid: "parent-a", option: "Camp", optionIndex: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await assertFails(duplicate.commit());

  const forgedAggregate = writeBatch(parent);
  forgedAggregate.update(doc(parent, "polls/poll-1/results/0"), { count: 7, updatedAt: serverTimestamp() });
  await assertFails(forgedAggregate.commit());
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
  await assertFails(getDocs(collection(scoutLeader, "polls/leader-poll/results")));
  await assertFails(getDocs(collection(beaverLeader, "polls/leader-poll/results")));

  const responseBatch = writeBatch(beaverLeader);
  responseBatch.update(doc(beaverLeader, "polls/leader-poll/results/0"), { count: 1, updatedAt: serverTimestamp() });
  responseBatch.set(doc(beaverLeader, "polls/leader-poll/responses/beaver-leader"), {
    accountUid: "beaver-leader", option: "Hike", optionIndex: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  await assertSucceeds(responseBatch.commit());
  await assertSucceeds(getDocs(collection(beaverLeader, "polls/leader-poll/results")));
  await assertFails(getDocs(collection(beaverLeader, "polls/leader-poll/responses")));
});

test("Super Admin can discover and manage polls without gaining respondent access outside assigned sections", async () => {
  await seedPoll("group-leader-poll", {
    audienceType: "leaders",
    scopeType: "group",
    scopeSections: ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]
  });
  const superAdmin = testEnv.authenticatedContext("super-admin").firestore();
  const indexQuery = query(collectionGroup(superAdmin, "audienceSections"),
    where("section", "==", "Beavers"),
    where("audienceType", "==", "leaders"),
    where("scopeType", "==", "group"));

  const indexes = await assertSucceeds(getDocs(indexQuery));
  assert.deepEqual(indexes.docs.map((item) => item.data().pollId), ["group-leader-poll"]);
  await assertSucceeds(getDoc(doc(superAdmin, "polls/group-leader-poll")));
  await assertSucceeds(getDocs(collection(superAdmin, "polls/group-leader-poll/results")));
  await assertFails(getDoc(doc(superAdmin, "polls/group-leader-poll/responses/super-admin")));
});
