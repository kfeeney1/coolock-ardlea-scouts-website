import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of entries) await setDoc(doc(db, path), data);
  });
}

function incident(uid, section = "Scouts", loanId = "loan-1") {
  return {
    itemId: "tent",
    itemName: "4-person Tent",
    itemCategory: "Camping & Sleeping",
    itemLocation: "Main Store",
    quantity: 1,
    type: "missing",
    status: "reported",
    section,
    loanId,
    description: "One tent did not come back with the section equipment.",
    reportedBy: uid,
    reportedAt: serverTimestamp(),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
    notificationState: "pending",
    notificationSentAt: null,
    resolutionType: "",
    resolutionNotes: "",
    resolvedBy: "",
    resolvedAt: null
  };
}

function storedIncident(uid, section = "Scouts", loanId = "loan-1") {
  return { ...incident(uid, section, loanId), reportedAt: new Date(), updatedAt: new Date() };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 }
  });
});

beforeEach(async () => { await testEnv.clearFirestore(); });
after(async () => { await testEnv.cleanup(); });

test("section leader can report an incident from their own section checkout", async () => {
  await seed([
    ["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }],
    ["equipmentLoans/loan-1", { section: "Scouts", status: "open" }]
  ]);
  const db = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  await assertSucceeds(setDoc(doc(db, "equipmentIncidents/incident-1"), incident("scout-leader")));
  await assertSucceeds(updateDoc(doc(db, "equipmentIncidents/incident-1"), {
    notificationState: "sent",
    notificationSentAt: serverTimestamp()
  }));
});

test("section leader cannot report a direct-store issue or another section checkout", async () => {
  await seed([
    ["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }],
    ["equipmentLoans/cubs-loan", { section: "Cubs", status: "open" }]
  ]);
  const db = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  await assertFails(setDoc(doc(db, "equipmentIncidents/direct"), incident("scout-leader", "Scouts", "")));
  await assertFails(setDoc(doc(db, "equipmentIncidents/cubs"), incident("scout-leader", "Cubs", "cubs-loan")));
});

test("equipment administrators can report a direct-store issue", async () => {
  await seed([["adminUsers/web-admin", { active: true, role: "admin", sections: ["Group"] }]]);
  const db = testEnv.authenticatedContext("web-admin", { email: "admin@example.test" }).firestore();
  await assertSucceeds(setDoc(doc(db, "equipmentIncidents/direct"), incident("web-admin", "Group", "")));
});

test("active leaders can read incidents while parents cannot", async () => {
  await seed([
    ["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }],
    ["parentAccounts/parent", { status: "approved", memberIds: [], linkedSections: ["Scouts"] }],
    ["equipmentIncidents/incident-1", storedIncident("scout-leader")]
  ]);
  const leaderDb = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  const parentDb = testEnv.authenticatedContext("parent", { email: "parent@example.test" }).firestore();
  await assertSucceeds(getDocs(collection(leaderDb, "equipmentIncidents")));
  await assertFails(getDocs(collection(parentDb, "equipmentIncidents")));
});

test("equipment administrator can investigate and resolve an incident", async () => {
  await seed([
    ["adminUsers/web-admin", { active: true, role: "admin", sections: ["Group"] }],
    ["equipmentIncidents/incident-1", storedIncident("scout-leader")]
  ]);
  const db = testEnv.authenticatedContext("web-admin", { email: "admin@example.test" }).firestore();
  await assertSucceeds(updateDoc(doc(db, "equipmentIncidents/incident-1"), {
    status: "investigating",
    updatedBy: "web-admin",
    updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(doc(db, "equipmentIncidents/incident-1"), {
    status: "resolved",
    resolutionType: "found-returned",
    resolutionNotes: "Found in the trailer.",
    resolvedBy: "web-admin",
    resolvedAt: serverTimestamp(),
    updatedBy: "web-admin",
    updatedAt: serverTimestamp()
  }));
});

test("quartermaster and group leader can resolve incidents", async () => {
  await seed([
    ["adminUsers/qm", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/qm", { active: true, scoutingRole: "Group Quartermaster / Bo'sun" }],
    ["adminUsers/gl", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/gl", { active: true, scoutingRole: "Group Leader" }],
    ["equipmentIncidents/qm-incident", storedIncident("scout-leader")],
    ["equipmentIncidents/gl-incident", storedIncident("scout-leader")]
  ]);
  for (const uid of ["qm", "gl"]) {
    const db = testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
    await assertSucceeds(updateDoc(doc(db, `equipmentIncidents/${uid}-incident`), {
      status: "resolved",
      resolutionType: "repaired",
      resolutionNotes: "Back in service.",
      resolvedBy: uid,
      resolvedAt: serverTimestamp(),
      updatedBy: uid,
      updatedAt: serverTimestamp()
    }));
  }
});

test("ordinary leader cannot resolve an incident", async () => {
  await seed([
    ["adminUsers/scout-leader", { active: true, role: "leader", sections: ["Scouts"] }],
    ["equipmentIncidents/incident-1", storedIncident("another-leader")]
  ]);
  const db = testEnv.authenticatedContext("scout-leader", { email: "scout@example.test" }).firestore();
  await assertFails(updateDoc(doc(db, "equipmentIncidents/incident-1"), {
    status: "resolved",
    resolutionType: "found-returned",
    resolutionNotes: "",
    resolvedBy: "scout-leader",
    resolvedAt: serverTimestamp(),
    updatedBy: "scout-leader",
    updatedAt: serverTimestamp()
  }));
});

test("write-offs require a resolution reason", async () => {
  await seed([
    ["adminUsers/web-admin", { active: true, role: "admin", sections: ["Group"] }],
    ["equipmentIncidents/incident-1", storedIncident("scout-leader")]
  ]);
  const db = testEnv.authenticatedContext("web-admin", { email: "admin@example.test" }).firestore();
  await assertFails(updateDoc(doc(db, "equipmentIncidents/incident-1"), {
    status: "resolved",
    resolutionType: "written-off",
    resolutionNotes: "",
    resolvedBy: "web-admin",
    resolvedAt: serverTimestamp(),
    updatedBy: "web-admin",
    updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(doc(db, "equipmentIncidents/incident-1"), {
    status: "resolved",
    resolutionType: "written-off",
    resolutionNotes: "Confirmed lost after store and trailer check.",
    resolvedBy: "web-admin",
    resolvedAt: serverTimestamp(),
    updatedBy: "web-admin",
    updatedAt: serverTimestamp()
  }));
});
