import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const [path, data] of entries) await setDoc(doc(context.firestore(), path), data);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

test("event access remains isolated to a leader's assigned sections", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["events/cubs-camp", { section: "Cubs", title: "Cub camp", eventType: "camp", startDate: "2026-09-10", endDate: "2026-09-11", status: "open" }],
    ["events/scout-camp", { section: "Scouts", title: "Scout camp", eventType: "camp", startDate: "2026-09-12", endDate: "2026-09-13", status: "open" }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs").firestore();
  await assertSucceeds(getDoc(doc(db, "events/cubs-camp")));
  await assertFails(getDoc(doc(db, "events/scout-camp")));
  await assertSucceeds(setDoc(doc(db, "events/cubs-hike"), {
    section: "Cubs", title: "Cub hike", eventType: "activity", startDate: "2026-09-20",
    endDate: "2026-09-20", status: "draft", createdBy: "leader-cubs",
  }));
  await assertFails(setDoc(doc(db, "events/scout-hike"), {
    section: "Scouts", title: "Scout hike", eventType: "activity", startDate: "2026-09-20",
    endDate: "2026-09-20", status: "draft", createdBy: "leader-cubs",
  }));
});

test("section meetings and group meetings keep distinct authority boundaries", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["adminUsers/secretary", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/secretary", { active: true, scoutingRole: "Group Secretary" }],
    ["meetingRecords/group-council", { title: "Group Council", meetingType: "group", section: "Group", meetingDate: "2026-09-01", attendees: [], createdBy: "admin-1" }],
  ]);
  const leaderDb = testEnv.authenticatedContext("leader-cubs").firestore();
  const adminDb = testEnv.authenticatedContext("admin-1").firestore();
  const secretaryDb = testEnv.authenticatedContext("secretary").firestore();
  const sectionMeeting = {
    title: "Cub leaders", meetingType: "leader", section: "Cubs", meetingDate: "2026-09-02",
    attendees: [], notes: "", decisions: [], actions: [], createdBy: "leader-cubs",
    createdAt: serverTimestamp(), updatedBy: "leader-cubs", updatedAt: serverTimestamp(),
  };

  await assertSucceeds(setDoc(doc(leaderDb, "meetingRecords/cub-leaders"), sectionMeeting));
  await assertFails(getDoc(doc(leaderDb, "meetingRecords/group-council")));
  await assertSucceeds(getDoc(doc(secretaryDb, "meetingRecords/group-council")));
  await assertFails(setDoc(doc(leaderDb, "meetingRecords/forged-group"), {
    ...sectionMeeting, meetingType: "group", section: "Group",
  }));
  await assertSucceeds(setDoc(doc(adminDb, "meetingRecords/admin-group"), {
    ...sectionMeeting, title: "Admin group meeting", meetingType: "group", section: "Group",
    createdBy: "admin-1", updatedBy: "admin-1",
  }));
});

test("equipment options are readable by leaders but managed only by equipment roles", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/qm", { active: true, role: "leader", sections: ["Group"] }],
    ["parentAccounts/parent-1", { status: "approved", memberIds: [], linkedSections: ["Cubs"] }],
    ["organisationLeadership/qm", { active: true, scoutingRole: "Group Quartermaster / Bo'sun" }],
    ["equipmentCategories/tents", { name: "Tents", createdBy: "qm", createdAt: new Date() }],
    ["equipmentLocations/den", { name: "Den", createdBy: "qm", createdAt: new Date() }],
  ]);
  const leaderDb = testEnv.authenticatedContext("leader-cubs").firestore();
  const qmDb = testEnv.authenticatedContext("qm").firestore();
  const parentDb = testEnv.authenticatedContext("parent-1").firestore();

  await assertSucceeds(getDocs(collection(leaderDb, "equipmentCategories")));
  await assertSucceeds(getDocs(collection(leaderDb, "equipmentLocations")));
  await assertFails(getDocs(collection(parentDb, "equipmentCategories")));
  await assertFails(setDoc(doc(leaderDb, "equipmentCategories/cooking"), {
    name: "Cooking", createdBy: "leader-cubs", createdAt: serverTimestamp(),
  }));
  await assertSucceeds(setDoc(doc(qmDb, "equipmentCategories/cooking"), {
    name: "Cooking", createdBy: "qm", createdAt: serverTimestamp(),
  }));
  await assertSucceeds(setDoc(doc(qmDb, "equipmentLocations/store"), {
    name: "Store", createdBy: "qm", createdAt: serverTimestamp(),
  }));
  await assertFails(deleteDoc(doc(leaderDb, "equipmentCategories/tents")));
  await assertSucceeds(deleteDoc(doc(qmDb, "equipmentCategories/tents")));
});
