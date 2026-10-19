import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";

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

test("public can list projections while authorized writes reject private fields", async () => {
  const canonical = {
    eventId: "event-1", title: "Camp", description: "", eventType: "camp", section: "Cubs",
    location: "Den", startDate: "2026-09-10", endDate: "", updatedAt: new Date(),
  };
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["publicEvents/event-1", canonical],
  ]);
  const publicDb = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(query(
    collection(publicDb, "publicEvents"),
    where("startDate", ">=", "2026-09-08"),
    orderBy("startDate", "asc"),
  )));

  const leaderDb = testEnv.authenticatedContext("leader-cubs").firestore();
  await assertFails(setDoc(doc(leaderDb, "publicEvents/unsafe"), {
    ...canonical, eventId: "unsafe", leaderNotes: "private", updatedAt: serverTimestamp(),
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

test("Parent Login settings are private to Super Admin while the safe navigation projection is public", async () => {
  await seed([
    ["adminUsers/super-1", { active: true, role: "super-admin", sections: ["Group"] }],
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["adminUsers/leader-1", { active: true, role: "leader", sections: ["Cubs"] }],
    ["siteSettings/parentLogin", { parentLoginEnabled: true, updatedBy: "super-1", updatedAt: new Date() }],
    ["siteSettings/publicNavigation", { parentLoginEnabled: true }],
  ]);

  const publicDb = testEnv.unauthenticatedContext().firestore();
  const leaderDb = testEnv.authenticatedContext("leader-1").firestore();
  const adminDb = testEnv.authenticatedContext("admin-1").firestore();
  const superDb = testEnv.authenticatedContext("super-1").firestore();
  const canonicalPath = doc(publicDb, "siteSettings/parentLogin");
  const publicPath = doc(publicDb, "siteSettings/publicNavigation");

  await assertFails(getDoc(canonicalPath));
  await assertSucceeds(getDoc(publicPath));
  assert.deepEqual(Object.keys((await getDoc(publicPath)).data()).sort(), ["parentLoginEnabled"]);
  await assertFails(getDoc(doc(leaderDb, "siteSettings/parentLogin")));
  await assertFails(getDoc(doc(adminDb, "siteSettings/parentLogin")));
  await assertSucceeds(getDoc(doc(superDb, "siteSettings/parentLogin")));
  await assertFails(updateDoc(doc(leaderDb, "siteSettings/parentLogin"), { parentLoginEnabled: false }));
  await assertFails(updateDoc(doc(adminDb, "siteSettings/parentLogin"), { parentLoginEnabled: false }));
  await assertFails(updateDoc(doc(superDb, "siteSettings/parentLogin"), { parentLoginEnabled: false, updatedBy: "super-1", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(superDb, "siteSettings/publicNavigation"), { parentLoginEnabled: false }));

  const unauthorisedBatch = writeBatch(leaderDb);
  unauthorisedBatch.set(doc(leaderDb, "siteSettings/parentLogin"), {
    parentLoginEnabled: false, updatedBy: "leader-1", updatedAt: serverTimestamp(),
  });
  unauthorisedBatch.set(doc(leaderDb, "siteSettings/publicNavigation"), {
    parentLoginEnabled: false,
  });
  await assertFails(unauthorisedBatch.commit());

  const authorisedBatch = writeBatch(superDb);
  authorisedBatch.set(doc(superDb, "siteSettings/parentLogin"), {
    parentLoginEnabled: false, updatedBy: "super-1", updatedAt: serverTimestamp(),
  });
  authorisedBatch.set(doc(superDb, "siteSettings/publicNavigation"), {
    parentLoginEnabled: false,
  });
  await assertSucceeds(authorisedBatch.commit());
  await assertSucceeds(getDoc(doc(publicDb, "siteSettings/publicNavigation")));
  await assertFails(getDoc(doc(publicDb, "siteSettings/parentLogin")));
  await assertFails(setDoc(doc(publicDb, "siteSettings/publicNavigation"), { parentLoginEnabled: true }));
});

test("Parent Portal consent setting is Super Admin-only and updates its public presentation projection atomically", async () => {
  await seed([
    ["adminUsers/super-1", { active: true, role: "super-admin", sections: ["Group"] }],
    ["adminUsers/admin-1", { active: true, role: "admin", sections: ["Group"] }],
    ["adminUsers/leader-1", { active: true, role: "leader", sections: ["Cubs"] }],
    ["siteSettings/parentLogin", { parentLoginEnabled: true, updatedBy: "super-1", updatedAt: new Date() }],
    ["siteSettings/parentConsent", { parentConsentEnabled: false, updatedBy: "super-1", updatedAt: new Date() }],
    ["siteSettings/publicNavigation", { parentLoginEnabled: true, parentConsentEnabled: false }],
  ]);

  const publicDb = testEnv.unauthenticatedContext().firestore();
  const leaderDb = testEnv.authenticatedContext("leader-1").firestore();
  const adminDb = testEnv.authenticatedContext("admin-1").firestore();
  const superDb = testEnv.authenticatedContext("super-1").firestore();
  const consentPath = (db) => doc(db, "siteSettings/parentConsent");
  const navigationPath = (db) => doc(db, "siteSettings/publicNavigation");

  await assertFails(getDoc(consentPath(publicDb)));
  await assertFails(getDoc(consentPath(leaderDb)));
  await assertFails(getDoc(consentPath(adminDb)));
  await assertSucceeds(getDoc(consentPath(superDb)));
  await assertSucceeds(getDoc(navigationPath(publicDb)));
  assert.deepEqual(Object.keys((await getDoc(navigationPath(publicDb))).data()).sort(), ["parentConsentEnabled", "parentLoginEnabled"]);
  await assertFails(updateDoc(consentPath(leaderDb), { parentConsentEnabled: true }));
  await assertFails(updateDoc(consentPath(adminDb), { parentConsentEnabled: true }));
  await assertFails(updateDoc(consentPath(superDb), { parentConsentEnabled: true, updatedBy: "super-1", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(navigationPath(superDb), { parentConsentEnabled: true }));

  const leaderBatch = writeBatch(leaderDb);
  leaderBatch.set(consentPath(leaderDb), { parentConsentEnabled: true, updatedBy: "leader-1", updatedAt: serverTimestamp() });
  leaderBatch.set(navigationPath(leaderDb), { parentLoginEnabled: true, parentConsentEnabled: true });
  await assertFails(leaderBatch.commit());

  const superBatch = writeBatch(superDb);
  superBatch.set(consentPath(superDb), { parentConsentEnabled: true, updatedBy: "super-1", updatedAt: serverTimestamp() });
  superBatch.set(navigationPath(superDb), { parentLoginEnabled: true, parentConsentEnabled: true });
  await assertSucceeds(superBatch.commit());
  await assertSucceeds(getDoc(navigationPath(publicDb)));
  await assertFails(getDoc(consentPath(publicDb)));
  await assertFails(setDoc(navigationPath(publicDb), { parentLoginEnabled: true, parentConsentEnabled: false }));
});

test("first Parent Portal consent save materialises the unset Parent Login default atomically", async () => {
  await seed([
    ["adminUsers/super-1", { active: true, role: "super-admin", sections: ["Group"] }],
  ]);

  const superDb = testEnv.authenticatedContext("super-1").firestore();
  const loginPath = doc(superDb, "siteSettings/parentLogin");
  const consentPath = doc(superDb, "siteSettings/parentConsent");
  const navigationPath = doc(superDb, "siteSettings/publicNavigation");
  const firstConsentSave = writeBatch(superDb);
  firstConsentSave.set(loginPath, { parentLoginEnabled: true, updatedBy: "super-1", updatedAt: serverTimestamp() });
  firstConsentSave.set(consentPath, { parentConsentEnabled: true, updatedBy: "super-1", updatedAt: serverTimestamp() });
  firstConsentSave.set(navigationPath, { parentLoginEnabled: true, parentConsentEnabled: true });
  await assertSucceeds(firstConsentSave.commit());

  const publicDb = testEnv.unauthenticatedContext().firestore();
  assert.deepEqual((await getDoc(doc(publicDb, "siteSettings/publicNavigation"))).data(), {
    parentLoginEnabled: true,
    parentConsentEnabled: true,
  });
  await assertFails(getDoc(doc(publicDb, "siteSettings/parentLogin")));
  await assertFails(getDoc(doc(publicDb, "siteSettings/parentConsent")));
});

test("public site content exposes only canonical environment projections", async () => {
  const testProjection = { contentVersion: 1, testData: true, testSeed: "public-site-content-v1", createdBySeed: "TEST_SEED" };
  const liveProjection = { contentVersion: 1, testData: false, visibility: "public", published: true };
  await seed([
    ["publicSiteContent/TEST_site", testProjection],
    ["publicSiteContent/live", liveProjection],
    ["publicSiteContent/private", { ...liveProjection, visibility: "private" }],
    ["publicSiteContent/unsafe", { ...liveProjection, memberEmail: "private@example.com" }],
    ["members/private-member", { displayName: "Private Member" }],
    ["consentApplications/private-consent", { memberId: "private-member" }],
    ["adminUsers/private-leader", { active: true, role: "leader", sections: ["Cubs"] }],
    ["subsPayments/private-finance", { amountCents: 1000 }],
  ]);
  const publicDb = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(publicDb, "publicSiteContent/TEST_site")));
  await assertSucceeds(getDoc(doc(publicDb, "publicSiteContent/live")));
  await assertFails(getDoc(doc(publicDb, "publicSiteContent/private")));
  await assertFails(getDoc(doc(publicDb, "publicSiteContent/unsafe")));
  await assertFails(getDoc(doc(publicDb, "members/private-member")));
  await assertFails(getDoc(doc(publicDb, "consentApplications/private-consent")));
  await assertFails(getDoc(doc(publicDb, "adminUsers/private-leader")));
  await assertFails(getDoc(doc(publicDb, "subsPayments/private-finance")));
  await assertFails(setDoc(doc(publicDb, "publicSiteContent/TEST_site"), testProjection));
});

test("Leader navigation version is private to signed-in readers and writable only by active Super Admin", async () => {
  await seed([
    ["adminUsers/super-nav", { active: true, role: "super-admin", sections: ["Group"] }],
    ["adminUsers/admin-nav", { active: true, role: "admin", sections: ["Group"] }],
    ["adminUsers/leader-nav", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/inactive-nav", { active: false, role: "super-admin", sections: ["Group"] }],
  ]);
  const publicDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(publicDb, "siteSettings/leaderNavigation")));
  for (const uid of ["admin-nav", "leader-nav", "inactive-nav", "parent-nav"]) {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(db, "siteSettings/leaderNavigation")));
    await assertFails(setDoc(doc(db, "siteSettings/leaderNavigation"), { version: "redesigned", updatedBy: uid, updatedAt: serverTimestamp() }));
  }
  const db = testEnv.authenticatedContext("super-nav").firestore();
  const ref = doc(db, "siteSettings/leaderNavigation");
  for (const version of ["existing", "redesigned"]) {
    await assertSucceeds(setDoc(ref, { version, updatedBy: "super-nav", updatedAt: serverTimestamp() }));
    assert.equal((await getDoc(ref)).data().version, version);
  }
  await assertFails(setDoc(ref, { version: "unknown", updatedBy: "super-nav", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { version: "existing", updatedBy: "other", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { version: "existing", updatedBy: "super-nav", updatedAt: new Date(0) }));
  await assertFails(setDoc(ref, { version: "existing", updatedBy: "super-nav", updatedAt: serverTimestamp(), extra: "private" }));
  await assertFails(getDocs(collection(db, "siteSettings")));
});

test("Schedule experience version is private to signed-in readers and writable only by active Super Admin", async () => {
  await seed([
    ["adminUsers/super-nav", { active: true, role: "super-admin", sections: ["Group"] }],
    ["adminUsers/admin-nav", { active: true, role: "admin", sections: ["Group"] }],
    ["adminUsers/leader-nav", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/inactive-nav", { active: false, role: "super-admin", sections: ["Group"] }],
  ]);
  const publicDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(publicDb, "siteSettings/scheduleExperience")));
  for (const uid of ["admin-nav", "leader-nav", "inactive-nav", "parent-nav"]) {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(db, "siteSettings/scheduleExperience")));
    await assertFails(setDoc(doc(db, "siteSettings/scheduleExperience"), { version: "redesigned", updatedBy: uid, updatedAt: serverTimestamp() }));
  }
  const db = testEnv.authenticatedContext("super-nav").firestore();
  const ref = doc(db, "siteSettings/scheduleExperience");
  for (const version of ["existing", "redesigned"]) {
    await assertSucceeds(setDoc(ref, { version, updatedBy: "super-nav", updatedAt: serverTimestamp() }));
    assert.equal((await getDoc(ref)).data().version, version);
  }
  await assertFails(setDoc(ref, { version: "unknown", updatedBy: "super-nav", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { version: "existing", updatedBy: "other", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { version: "existing", updatedBy: "super-nav", updatedAt: new Date(0) }));
  await assertFails(setDoc(ref, { version: "existing", updatedBy: "super-nav", updatedAt: serverTimestamp(), extra: "private" }));
  await assertFails(getDocs(collection(db, "siteSettings")));
});
test("Attendance experience version is private to signed-in readers and writable only by active Super Admin", async () => {
  await seed([
    ["adminUsers/super-nav", { active: true, role: "super-admin", sections: ["Group"] }],
    ["adminUsers/admin-nav", { active: true, role: "admin", sections: ["Group"] }],
    ["adminUsers/leader-nav", { active: true, role: "leader", sections: ["Cubs"] }],
    ["adminUsers/inactive-nav", { active: false, role: "super-admin", sections: ["Group"] }],
  ]);
  const publicDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(publicDb, "siteSettings/attendanceExperience")));
  for (const uid of ["admin-nav", "leader-nav", "inactive-nav", "parent-nav"]) {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(db, "siteSettings/attendanceExperience")));
    await assertFails(setDoc(doc(db, "siteSettings/attendanceExperience"), { version: "redesigned", updatedBy: uid, updatedAt: serverTimestamp() }));
  }
  const db = testEnv.authenticatedContext("super-nav").firestore();
  const ref = doc(db, "siteSettings/attendanceExperience");
  for (const version of ["existing", "redesigned"]) {
    await assertSucceeds(setDoc(ref, { version, updatedBy: "super-nav", updatedAt: serverTimestamp() }));
    assert.equal((await getDoc(ref)).data().version, version);
  }
  await assertFails(setDoc(ref, { version: "unknown", updatedBy: "super-nav", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { version: "existing", updatedBy: "other", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { version: "existing", updatedBy: "super-nav", updatedAt: new Date(0) }));
  await assertFails(setDoc(ref, { version: "existing", updatedBy: "super-nav", updatedAt: serverTimestamp(), extra: "private" }));
  await assertFails(getDocs(collection(db, "siteSettings")));
});