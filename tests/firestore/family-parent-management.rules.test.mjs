import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

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

const member = (section = "Cubs") => ({
  firstName: "Test",
  lastName: "Member",
  displayName: "Test Member",
  dateOfBirth: "2016-05-10",
  section,
  parentName: "Test Parent",
  emailAddress: "parent@example.com",
  mobileNumber: "0870000000",
  emergencyContactName: "Emergency Contact",
  emergencyContactPhone: "0871111111",
  status: "active",
  familyId: "",
  source: "manual",
  createdBy: "seed",
  createdAt: new Date(),
  updatedBy: "seed",
  updatedAt: new Date(),
});

async function seedFamilyActors() {
  await seed([
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/disabled-admin", { active: false, role: "admin", sections: ["Group"] }],
    ["parentAccounts/parent-1", { uid: "parent-1", status: "approved", memberIds: ["member-a"], linkedSections: ["Cubs"] }],
    ["members/member-a", member("Cubs")],
    ["members/member-b", { ...member("Scouts"), displayName: "Second Member" }],
  ]);
}

test("active administrators can update only canonical family metadata across sections", async () => {
  await seedFamilyActors();
  const db = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();

  await assertSucceeds(updateDoc(doc(db, "members/member-a"), {
    familyId: "family-test-1",
    familyUpdatedBy: "admin-1",
    familyUpdatedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(doc(db, "members/member-b"), {
    familyId: "family-test-1",
    familyUpdatedBy: "admin-1",
    familyUpdatedAt: serverTimestamp(),
  }));
});

test("ordinary leaders cannot change family membership even inside their section", async () => {
  await seedFamilyActors();
  const db = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();

  await assertFails(updateDoc(doc(db, "members/member-a"), {
    familyId: "family-not-allowed",
    familyUpdatedBy: "leader-cubs",
    familyUpdatedAt: serverTimestamp(),
  }));
});

test("parents and disabled administrators cannot change family membership", async () => {
  await seedFamilyActors();
  const parentDb = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  const disabledAdminDb = testEnv.authenticatedContext("disabled-admin", { email: "disabled@example.com" }).firestore();

  await assertFails(updateDoc(doc(parentDb, "members/member-a"), {
    familyId: "family-not-allowed",
    familyUpdatedBy: "parent-1",
    familyUpdatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(disabledAdminDb, "members/member-a"), {
    familyId: "family-not-allowed",
    familyUpdatedBy: "disabled-admin",
    familyUpdatedAt: serverTimestamp(),
  }));
});

test("family metadata permission cannot be used to smuggle unrelated member changes", async () => {
  await seedFamilyActors();
  const db = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();

  await assertFails(updateDoc(doc(db, "members/member-a"), {
    familyId: "family-test-1",
    familyUpdatedBy: "admin-1",
    familyUpdatedAt: serverTimestamp(),
    status: "left",
  }));
});

test("parent management remains administrator-only", async () => {
  await seedFamilyActors();
  const adminDb = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();
  const leaderDb = testEnv.authenticatedContext("leader-cubs", { email: "leader@example.com" }).firestore();

  await assertSucceeds(getDocs(collection(adminDb, "parentAccounts")));
  await assertFails(getDocs(collection(leaderDb, "parentAccounts")));
});

test("disabling Parent Portal access retains child links but revoked parents cannot read the child", async () => {
  await seedFamilyActors();
  const adminDb = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();

  await assertSucceeds(updateDoc(doc(adminDb, "parentAccounts/parent-1"), {
    status: "revoked",
    memberIds: ["member-a"],
    linkedSections: ["Cubs"],
    reviewedBy: "admin-1",
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  const parentSnapshot = await getDoc(doc(adminDb, "parentAccounts/parent-1"));
  if (parentSnapshot.data()?.memberIds?.[0] !== "member-a") throw new Error("Parent-child link was not retained.");

  const parentDb = testEnv.authenticatedContext("parent-1", { email: "parent@example.com" }).firestore();
  await assertFails(getDoc(doc(parentDb, "members/member-a")));
});

test("disabling Parent Portal access does not disable independent Leader access on a dual-role UID", async () => {
  await seed([
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["adminUsers/dual-user", { active: true, role: "leader", sections: ["Cubs"], displayName: "Dual User", email: "dual@example.com" }],
    ["parentAccounts/dual-user", { uid: "dual-user", status: "approved", memberIds: ["member-a"], linkedSections: ["Cubs"] }],
    ["members/member-a", member("Cubs")],
  ]);
  const adminDb = testEnv.authenticatedContext("admin-1", { email: "admin@example.com" }).firestore();
  await assertSucceeds(updateDoc(doc(adminDb, "parentAccounts/dual-user"), {
    status: "revoked",
    memberIds: ["member-a"],
    linkedSections: ["Cubs"],
    reviewedBy: "admin-1",
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  const dualDb = testEnv.authenticatedContext("dual-user", { email: "dual@example.com" }).firestore();
  await assertSucceeds(getDoc(doc(dualDb, "members/member-a")));
  const leaderProfile = await getDoc(doc(dualDb, "adminUsers/dual-user"));
  if (leaderProfile.data()?.active !== true) throw new Error("Leader access was disabled with Parent access.");
});
