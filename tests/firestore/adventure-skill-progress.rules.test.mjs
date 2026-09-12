import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});
beforeEach(async () => { await testEnv.clearFirestore(); });
after(async () => { await testEnv.cleanup(); });

const requirement = (uid, memberId = "member-1") => ({
  memberId,
  requirementId: "camping-stage-1-requirement-06",
  skillId: "camping",
  stage: 1,
  sharedCompetencyKey: "buddy-system",
  completedAt: serverTimestamp(),
  completedBy: uid,
  sourceType: "manual",
  sourceId: "",
});

const award = (uid, memberId = "member-1", awardId = "camping-stage-1", skillId = "camping", stage = 1) => ({
  awardId,
  memberId,
  skillId,
  stage,
  awardedAt: serverTimestamp(),
  awardedBy: uid,
});

test("section leaders can manage progress for members in their current section only", async () => {
  await seed([
    ["adminUsers/leader-beavers", { active: true, role: "leader", sections: ["Beavers"] }],
    ["members/member-1", { section: "Beavers", status: "active" }],
    ["members/member-2", { section: "Cubs", status: "active" }],
  ]);
  const db = testEnv.authenticatedContext("leader-beavers").firestore();
  await assertSucceeds(setDoc(doc(db, "memberAdventureSkillProgress/member-1/requirements/camping-stage-1-requirement-06"), requirement("leader-beavers")));
  await assertFails(setDoc(doc(db, "memberAdventureSkillProgress/member-2/requirements/camping-stage-1-requirement-06"), requirement("leader-beavers", "member-2")));
});

test("progress follows the member when their section changes", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["members/member-1", { section: "Cubs", status: "active" }],
    ["memberAdventureSkillProgress/member-1/requirements/camping-stage-1-requirement-06", { ...requirement("leader-old"), completedAt: new Date(), completedBy: "leader-old" }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs").firestore();
  await assertSucceeds(getDocs(collection(db, "memberAdventureSkillProgress/member-1/requirements")));
  await assertSucceeds(deleteDoc(doc(db, "memberAdventureSkillProgress/member-1/requirements/camping-stage-1-requirement-06")));
});

test("approved parents can read linked-child progress but cannot write it or read another child", async () => {
  await seed([
    ["parentAccounts/parent-1", { status: "approved", memberIds: ["member-1"], linkedSections: ["Beavers"] }],
    ["members/member-1", { section: "Beavers", status: "active" }],
    ["members/member-2", { section: "Beavers", status: "active" }],
    ["memberAdventureSkillProgress/member-1/requirements/camping-stage-1-requirement-06", { ...requirement("leader-1"), completedAt: new Date(), completedBy: "leader-1" }],
  ]);
  const db = testEnv.authenticatedContext("parent-1").firestore();
  await assertSucceeds(getDocs(collection(db, "memberAdventureSkillProgress/member-1/requirements")));
  await assertFails(getDocs(collection(db, "memberAdventureSkillProgress/member-2/requirements")));
  await assertFails(setDoc(doc(db, "memberAdventureSkillProgress/member-1/requirements/camping-stage-1-requirement-06"), requirement("parent-1")));
});

test("direct client award mutations are denied even to an authorised leader", async () => {
  await seed([
    ["adminUsers/leader-beavers", { active: true, role: "leader", sections: ["Beavers"] }],
    ["members/member-1", { section: "Beavers", status: "active" }],
    ["memberAdventureSkillProgress/member-1/awards/camping-stage-1", { ...award("leader-old"), awardedAt: new Date(), awardedBy: "leader-old" }],
  ]);
  const db = testEnv.authenticatedContext("leader-beavers").firestore();
  await assertFails(setDoc(doc(db, "memberAdventureSkillProgress/member-1/awards/camping-stage-2"), award("leader-beavers", "member-1", "camping-stage-2", "camping", 2)));
  await assertFails(setDoc(doc(db, "memberAdventureSkillProgress/member-1/awards/camping-stage-1"), award("leader-beavers")));
  await assertFails(deleteDoc(doc(db, "memberAdventureSkillProgress/member-1/awards/camping-stage-1")));
});

test("historical award records remain readable after direct writes are closed", async () => {
  await seed([
    ["adminUsers/leader-beavers", { active: true, role: "leader", sections: ["Beavers"] }],
    ["members/member-1", { section: "Beavers", status: "active" }],
    ["memberAdventureSkillProgress/member-1/awards/camping-stage-1", { ...award("leader-old"), awardedAt: new Date(), awardedBy: "leader-old" }],
  ]);
  const db = testEnv.authenticatedContext("leader-beavers").firestore();
  await assertSucceeds(getDocs(collection(db, "memberAdventureSkillProgress/member-1/awards")));
});

test("direct bypass attempts stay denied for canonical, invalid and Swimming identities", async () => {
  await seed([
    ["adminUsers/leader-beavers", { active: true, role: "leader", sections: ["Beavers"] }],
    ["members/member-1", { section: "Beavers", status: "active" }],
  ]);
  const db = testEnv.authenticatedContext("leader-beavers").firestore();

  await assertFails(setDoc(
    doc(db, "memberAdventureSkillProgress/member-1/awards/swimming-stage-6"),
    award("leader-beavers", "member-1", "swimming-stage-6", "swimming", 6),
  ));
  await assertFails(setDoc(
    doc(db, "memberAdventureSkillProgress/member-1/awards/swimming-stage-7"),
    award("leader-beavers", "member-1", "swimming-stage-7", "swimming", 7),
  ));
  await assertFails(setDoc(
    doc(db, "memberAdventureSkillProgress/member-1/awards/unknown-stage-1"),
    award("leader-beavers", "member-1", "unknown-stage-1", "unknown", 1),
  ));
  await assertFails(setDoc(
    doc(db, "memberAdventureSkillProgress/member-1/awards/camping-stage-2"),
    award("leader-beavers", "member-1", "camping-stage-2", "camping", 1),
  ));
});

test("parents and out-of-scope leaders cannot bypass the trusted award boundary", async () => {
  await seed([
    ["parentAccounts/parent-1", { status: "approved", memberIds: ["member-1"], linkedSections: ["Beavers"] }],
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["members/member-1", { section: "Beavers", status: "active" }],
  ]);
  const parentDb = testEnv.authenticatedContext("parent-1").firestore();
  const leaderDb = testEnv.authenticatedContext("leader-cubs").firestore();
  await assertFails(setDoc(doc(parentDb, "memberAdventureSkillProgress/member-1/awards/camping-stage-1"), award("parent-1")));
  await assertFails(setDoc(doc(leaderDb, "memberAdventureSkillProgress/member-1/awards/camping-stage-1"), award("leader-cubs")));
});

test("requirement writes reject forged attribution and unsupported source types", async () => {
  await seed([
    ["adminUsers/leader-beavers", { active: true, role: "leader", sections: ["Beavers"] }],
    ["members/member-1", { section: "Beavers", status: "active" }],
  ]);
  const db = testEnv.authenticatedContext("leader-beavers").firestore();
  await assertFails(setDoc(doc(db, "memberAdventureSkillProgress/member-1/requirements/camping-stage-1-requirement-06"), { ...requirement("someone-else") }));
  await assertFails(setDoc(doc(db, "memberAdventureSkillProgress/member-1/requirements/camping-stage-1-requirement-06"), { ...requirement("leader-beavers"), sourceType: "other" }));
});
