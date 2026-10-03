import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, where, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

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
    firestore: {
      rules: await readFile("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});
beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

const pendingParent = {
  uid: "dual-user",
  email: "dual@example.com",
  displayName: "Dual Access User",
  mobileNumber: "0870000000",
  status: "pending",
  memberIds: [],
  linkedSections: [],
  requestedChildren: [{ firstName: "Riley", lastName: "Nolan", dateOfBirth: "2017-03-02" }],
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
};

const pendingLeader = {
  uid: "dual-user",
  fullName: "Dual Access User",
  email: "dual@example.com",
  mobileNumber: "0870000000",
  requestedRole: "Scouter",
  requestedSection: "Beavers",
  reason: "",
  privacyConfirmed: true,
  status: "pending",
  submittedAt: serverTimestamp(),
  reviewedAt: null,
  reviewedBy: "",
  reviewNote: "",
};

async function seedDualPendingRequests() {
  await seed([
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["parentAccounts/dual-user", { ...pendingParent, createdAt: new Date(), updatedAt: new Date() }],
    ["leaderRegistrationRequests/dual-user", { ...pendingLeader, submittedAt: new Date() }],
    ["members/member-riley", { section: "Beavers", displayName: "Riley Nolan" }],
  ]);
}

async function approveParent(adminDb) {
  await assertSucceeds(updateDoc(doc(adminDb, "parentAccounts/dual-user"), {
    status: "approved",
    memberIds: ["member-riley"],
    linkedSections: ["Beavers"],
    reviewedBy: "admin-1",
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
}

async function approveLeader(adminDb) {
  await assertSucceeds(setDoc(doc(adminDb, "adminUsers/dual-user"), {
    active: true,
    displayName: "Dual Access User",
    email: "dual@example.com",
    role: "leader",
    sections: ["Beavers"],
  }));
  await assertSucceeds(updateDoc(doc(adminDb, "leaderRegistrationRequests/dual-user"), {
    status: "approved",
    reviewedAt: serverTimestamp(),
    reviewedBy: "admin-1",
    reviewNote: "Approved independently",
  }));
}

test("same authenticated identity can submit parent and leader requests before either is approved", async () => {
  const db = testEnv.authenticatedContext("dual-user", { email: "dual@example.com" }).firestore();

  await assertSucceeds(setDoc(doc(db, "parentAccounts/dual-user"), pendingParent));
  await assertSucceeds(setDoc(doc(db, "leaderRegistrationRequests/dual-user"), pendingLeader));

  const parentRequest = await getDoc(doc(db, "parentAccounts/dual-user"));
  const leaderRequest = await getDoc(doc(db, "leaderRegistrationRequests/dual-user"));
  if (parentRequest.data()?.status !== "pending") throw new Error("Parent request must remain pending.");
  if (leaderRequest.data()?.status !== "pending") throw new Error("Leader request must remain pending.");
});

test("parent approval does not grant or resolve pending leader access", async () => {
  await seedDualPendingRequests();
  const adminDb = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();

  await approveParent(adminDb);

  const leaderRequest = await getDoc(doc(adminDb, "leaderRegistrationRequests/dual-user"));
  if (leaderRequest.data()?.status !== "pending") throw new Error("Leader request changed when parent access was approved.");

  await approveLeader(adminDb);
  const parentRequest = await getDoc(doc(adminDb, "parentAccounts/dual-user"));
  if (parentRequest.data()?.status !== "approved") throw new Error("Parent approval was lost when leader access was approved.");
});

test("leader approval does not grant or resolve pending parent access", async () => {
  await seedDualPendingRequests();
  const adminDb = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();

  await approveLeader(adminDb);

  const parentRequest = await getDoc(doc(adminDb, "parentAccounts/dual-user"));
  if (parentRequest.data()?.status !== "pending") throw new Error("Parent request changed when leader access was approved.");

  await approveParent(adminDb);
  const leaderRequest = await getDoc(doc(adminDb, "leaderRegistrationRequests/dual-user"));
  if (leaderRequest.data()?.status !== "approved") throw new Error("Leader approval was lost when parent access was approved.");
});

test("approval on one side and rejection on the other remain independent", async () => {
  await seedDualPendingRequests();
  const adminDb = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();

  await approveParent(adminDb);
  await assertSucceeds(updateDoc(doc(adminDb, "leaderRegistrationRequests/dual-user"), {
    status: "rejected",
    reviewedAt: serverTimestamp(),
    reviewedBy: "admin-1",
    reviewNote: "Rejected independently",
  }));

  const parentRequest = await getDoc(doc(adminDb, "parentAccounts/dual-user"));
  const leaderRequest = await getDoc(doc(adminDb, "leaderRegistrationRequests/dual-user"));
  if (parentRequest.data()?.status !== "approved") throw new Error("Parent approval changed after leader rejection.");
  if (leaderRequest.data()?.status !== "rejected") throw new Error("Leader rejection did not remain independent.");
});


test("combined parent and leader retain independent child and section permissions", async () => {
  await seed([
    ["adminUsers/dual-user", { active: true, role: "leader", sections: ["Scouts"] }],
    ["organisationLeadership/dual-user", { active: true, scoutingRole: "Programme Scouter", appointments: [{ appointment: "Programme Scouter", scope: "Scouts", active: true }] }],
    ["members/own-rover", { section: "Rovers", sections: ["Rovers"], accountUid: "dual-user", emailAddress: "dual@example.com", displayName: "Own Rover" }],
    ["adminUsers/leader-only", { active: true, role: "leader", sections: ["Scouts"] }],
    ["parentAccounts/dual-user", { status: "approved", memberIds: ["linked-beaver"], linkedSections: ["Beavers"] }],
    ["parentAccounts/parent-only", { status: "approved", memberIds: ["linked-beaver"], linkedSections: ["Beavers"] }],
    ["members/linked-beaver", { section: "Beavers", displayName: "Linked child" }],
    ["members/unlinked-beaver", { section: "Beavers", displayName: "Unlinked child" }],
    ["members/scout", { section: "Scouts", displayName: "Leader section member" }],
  ]);
  const combined = testEnv.authenticatedContext("dual-user", { email: "dual@example.com" }).firestore();
  const parent = testEnv.authenticatedContext("parent-only", { email: "parent@example.com" }).firestore();
  const leader = testEnv.authenticatedContext("leader-only", { email: "leader@example.com" }).firestore();
  await assertSucceeds(getDocs(query(collection(combined, "members"), where("accountUid", "==", "dual-user"))));
  await assertFails(getDocs(query(collection(combined, "members"), where("accountUid", "==", "someone-else"))));
  await assertSucceeds(getDoc(doc(combined, "members/linked-beaver")));
  await assertSucceeds(getDoc(doc(combined, "members/scout")));
  await assertFails(getDoc(doc(combined, "members/unlinked-beaver")));
  await assertSucceeds(getDoc(doc(parent, "members/linked-beaver")));
  await assertFails(getDoc(doc(parent, "members/scout")));
  await assertFails(getDoc(doc(parent, "members/unlinked-beaver")));
  await assertSucceeds(getDoc(doc(leader, "members/scout")));
  await assertFails(getDoc(doc(leader, "members/linked-beaver")));
});
