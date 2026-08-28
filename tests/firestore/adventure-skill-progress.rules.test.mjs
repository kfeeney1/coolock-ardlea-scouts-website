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

const award = (uid, memberId = "member-1") => ({
  memberId,
  skillId: "camping",
  stage: 1,
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

test("awards are separately protected and attributed", async () => {
  await seed([
    ["adminUsers/leader-beavers", { active: true, role: "leader", sections: ["Beavers"] }],
    ["members/member-1", { section: "Beavers", status: "active" }],
  ]);
  const db = testEnv.authenticatedContext("leader-beavers").firestore();
  await assertSucceeds(setDoc(doc(db, "memberAdventureSkillProgress/member-1/awards/camping-stage-1"), award("leader-beavers")));
  await assertFails(setDoc(doc(db, "memberAdventureSkillProgress/member-1/awards/wrong-id"), award("leader-beavers")));
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
