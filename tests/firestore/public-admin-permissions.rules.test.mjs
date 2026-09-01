import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

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

test("leader registration requests are private to their owner and admins", async () => {
  await seed([
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["leaderRegistrationRequests/applicant-1", { uid: "applicant-1", status: "pending", privacyConfirmed: true }],
  ]);
  const owner = testEnv.authenticatedContext("applicant-1").firestore();
  const stranger = testEnv.authenticatedContext("applicant-2").firestore();
  const admin = testEnv.authenticatedContext("admin-1").firestore();

  await assertSucceeds(getDoc(doc(owner, "leaderRegistrationRequests/applicant-1")));
  await assertFails(getDoc(doc(stranger, "leaderRegistrationRequests/applicant-1")));
  await assertSucceeds(updateDoc(doc(admin, "leaderRegistrationRequests/applicant-1"), {
    status: "approved", reviewedAt: serverTimestamp(), reviewedBy: "admin-1", reviewNote: "Verified",
  }));
  await assertFails(updateDoc(doc(owner, "leaderRegistrationRequests/applicant-1"), { status: "approved" }));
});

test("public event projections expose only canonical documents and remain section-scoped", async () => {
  const canonical = {
    eventId: "event-1", title: "Camp", description: "", eventType: "camp", section: "Cubs",
    location: "Den", startDate: "2026-09-10", endDate: "2026-09-11", updatedAt: new Date(),
  };
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/leader-scouts", { active: true, role: "leader", sections: ["Scouts"] }],
    ["publicEvents/event-1", canonical],
    ["publicEvents/broken", { ...canonical, eventId: "different-id" }],
  ]);
  const publicDb = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(publicDb, "publicEvents/event-1")));
  await assertFails(getDoc(doc(publicDb, "publicEvents/broken")));
  await assertSucceeds(setDoc(doc(testEnv.authenticatedContext("leader-cubs").firestore(), "publicEvents/event-2"), {
    ...canonical, eventId: "event-2", updatedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(testEnv.authenticatedContext("leader-scouts").firestore(), "publicEvents/event-3"), {
    ...canonical, eventId: "event-3", updatedAt: serverTimestamp(),
  }));
});

test("event consent links are public only while active and responses bind to that link", async () => {
  await seed([
    ["eventConsentLinks/active-token", { active: true, eventId: "event-1", section: "Cubs", title: "Camp" }],
    ["eventConsentLinks/closed-token", { active: false, eventId: "event-2", section: "Cubs", title: "Past camp" }],
  ]);
  const publicDb = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(publicDb, "eventConsentLinks/active-token")));
  await assertFails(getDoc(doc(publicDb, "eventConsentLinks/closed-token")));

  const response = {
    token: "active-token", eventId: "event-1", childName: "Test Cub", dateOfBirth: "2017-01-01",
    parentName: "Test Parent", attendance: "attending", consentGiven: true,
    emergencyDetailsConfirmed: true, medicalDetailsChanged: false, processingStatus: "new",
    submittedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(publicDb, "eventConsentResponses/valid"), response));
  await assertFails(setDoc(doc(publicDb, "eventConsentResponses/wrong-event"), { ...response, eventId: "event-2" }));
  await assertFails(getDocs(collection(publicDb, "eventConsentResponses")));
});

test("session settings are readable when signed in but writable only by admins", async () => {
  await seed([
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["adminUsers/leader-1", { active: true, role: "leader", sections: ["Cubs"] }],
    ["siteSettings/session", { parentInactivityMinutes: 20, leaderDesktopInactivityMinutes: 60, leaderPhoneInactivityMinutes: 30 }],
  ]);
  const publicDb = testEnv.unauthenticatedContext().firestore();
  const leaderDb = testEnv.authenticatedContext("leader-1").firestore();
  const adminDb = testEnv.authenticatedContext("admin-1").firestore();
  await assertFails(getDoc(doc(publicDb, "siteSettings/session")));
  await assertSucceeds(getDoc(doc(leaderDb, "siteSettings/session")));
  await assertFails(updateDoc(doc(leaderDb, "siteSettings/session"), { parentInactivityMinutes: 25 }));
  await assertSucceeds(setDoc(doc(adminDb, "siteSettings/session"), {
    parentInactivityMinutes: 25, leaderDesktopInactivityMinutes: 60, leaderPhoneInactivityMinutes: 30,
    updatedBy: "admin-1", updatedAt: serverTimestamp(),
  }));
  await assertFails(getDocs(collection(adminDb, "siteSettings")));
});

test("public site content exposes only the canonical test projection", async () => {
  const canonical = { contentVersion: 1, testData: true, testSeed: "public-site-content-v1", createdBySeed: "TEST_SEED" };
  await seed([
    ["publicSiteContent/TEST_site", canonical],
    ["publicSiteContent/live", canonical],
  ]);
  const publicDb = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(publicDb, "publicSiteContent/TEST_site")));
  await assertFails(getDoc(doc(publicDb, "publicSiteContent/live")));
  await assertFails(setDoc(doc(publicDb, "publicSiteContent/TEST_site"), canonical));
});
