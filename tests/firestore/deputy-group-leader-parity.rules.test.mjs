import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed([
    ["adminUsers/gl", { active: true, role: "leader", sections: ["Group"], displayName: "GL", email: "gl@example.com" }],
    ["adminUsers/dgl", { active: true, role: "leader", sections: ["Group"], displayName: "DGL", email: "dgl@example.com" }],
    ["adminUsers/ordinary", { active: true, role: "leader", sections: ["Group"], displayName: "Ordinary", email: "ordinary@example.com" }],
    ["organisationLeadership/gl", { active: true, scoutingRole: "Group Leader" }],
    ["organisationLeadership/dgl", { active: true, scoutingRole: "Deputy Group Leader" }],
    ["organisationLeadership/ordinary", { active: true, scoutingRole: "Scouter" }],
    ["members/scout-member", { displayName: "Scout Member", section: "Scouts" }],
    ["auditLog/audit-entry", { category: "system", action: "Test", actorUid: "seed", actorEmail: "seed@example.com", targetId: "target", targetLabel: "Target", description: "Seeded audit", section: "Scouts", createdAt: new Date() }],
    ["financeTransactions/scout-finance", { section: "Scouts", type: "income", amountCents: 100, category: "Test", description: "Test", transactionDate: "2099-01-01", sourceTransactionId: "", reversalOfTransactionId: "", createdBy: "seed", createdAt: new Date() }],
    ["equipmentCategories/dgl-delete", { name: "DGL delete", createdBy: "seed", createdAt: new Date() }],
    ["equipmentCategories/ordinary-delete", { name: "Ordinary delete", createdBy: "seed", createdAt: new Date() }]
  ]);
});

after(async () => testEnv.cleanup());

for (const actor of ["gl", "dgl"]) {
  test(`${actor} can read a member outside assigned sections through Group Leadership`, async () => {
    const db = testEnv.authenticatedContext(actor).firestore();
    await assertSucceeds(getDoc(doc(db, "members/scout-member")));
  });

  test(`${actor} can read group-wide finance and audit records`, async () => {
    const db = testEnv.authenticatedContext(actor).firestore();
    await assertSucceeds(getDoc(doc(db, "financeTransactions/scout-finance")));
    await assertSucceeds(getDoc(doc(db, "auditLog/audit-entry")));
  });
}

test("ordinary Group-scoped Leader is denied the same cross-section protected reads", async () => {
  const db = testEnv.authenticatedContext("ordinary").firestore();
  await assertFails(getDoc(doc(db, "members/scout-member")));
  await assertFails(getDoc(doc(db, "financeTransactions/scout-finance")));
  await assertFails(getDoc(doc(db, "auditLog/audit-entry")));
});

test("Deputy Group Leader can manage equipment without Admin promotion", async () => {
  const db = testEnv.authenticatedContext("dgl").firestore();
  await assertSucceeds(deleteDoc(doc(db, "equipmentCategories/dgl-delete")));
});

test("ordinary Leader cannot use the Group Leadership equipment-management grant", async () => {
  const db = testEnv.authenticatedContext("ordinary").firestore();
  await assertFails(deleteDoc(doc(db, "equipmentCategories/ordinary-delete")));
});

test("Deputy Group Leader can record cross-section badgework while ordinary Leader cannot", async () => {
  const dgl = testEnv.authenticatedContext("dgl").firestore();
  await assertSucceeds(setDoc(doc(dgl, "memberAdventureSkillProgress/scout-member/requirements/test-requirement"), {
    memberId: "scout-member",
    requirementId: "test-requirement",
    skillId: "camping",
    stage: 1,
    sharedCompetencyKey: "",
    completedAt: serverTimestamp(),
    completedBy: "dgl",
    sourceType: "manual",
    sourceId: ""
  }));

  const ordinary = testEnv.authenticatedContext("ordinary").firestore();
  await assertFails(setDoc(doc(ordinary, "memberAdventureSkillProgress/scout-member/requirements/ordinary-requirement"), {
    memberId: "scout-member",
    requirementId: "ordinary-requirement",
    skillId: "camping",
    stage: 1,
    sharedCompetencyKey: "",
    completedAt: serverTimestamp(),
    completedBy: "ordinary",
    sourceType: "manual",
    sourceId: ""
  }));
});
