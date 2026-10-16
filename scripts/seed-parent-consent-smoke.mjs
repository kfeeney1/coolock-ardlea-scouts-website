import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireFirebaseMutationTarget } from "./firebase-operation-guard.mjs";
import { buildParentConsentSmokeFixture, parentConsentSmokeIds, resolveParentLoginSeedState, validateParentConsentSmokeFixture } from "./parent-consent-smoke-fixture.mjs";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const action = process.argv[2] || "seed";
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
if (!["seed", "verify"].includes(action)) throw new Error("Usage: node scripts/seed-parent-consent-smoke.mjs seed|verify");

const target = requireFirebaseMutationTarget({
  operation: `seed-parent-consent-smoke:${action}`,
  credentialJson: rawCredentials
});
if (target.environment !== "test" || target.projectId !== "coolock-ardlea-scouts-test") {
  throw new Error("Parent consent smoke fixture may only target coolock-ardlea-scouts-test.");
}

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const { parentId, childId, eventId, consentToken } = parentConsentSmokeIds;
const marker = { testData: true, testSeed: "parent-consent-smoke-v1", createdBySeed: "TEST_SEED" };

async function readFixture() {
  const [parentSnapshot, childSnapshot, eventSnapshot, membershipSnapshot, consentLinkSnapshot, consentSettingsSnapshot, publicNavigationSnapshot] = await Promise.all([
    db.doc(`parentAccounts/${parentId}`).get(),
    db.doc(`members/${childId}`).get(),
    db.doc(`events/${eventId}`).get(),
    db.doc(`events/${eventId}/audienceMembers/${childId}`).get(),
    db.doc(`eventConsentLinks/${consentToken}`).get(),
    db.doc("siteSettings/parentConsent").get(),
    db.doc("siteSettings/publicNavigation").get()
  ]);
  validateParentConsentSmokeFixture({
    parent: parentSnapshot.exists ? parentSnapshot.data() : null,
    child: childSnapshot.exists ? childSnapshot.data() : null,
    event: eventSnapshot.exists ? eventSnapshot.data() : null,
    audienceMembership: membershipSnapshot.exists ? membershipSnapshot.data() : null,
    consentLink: consentLinkSnapshot.exists ? consentLinkSnapshot.data() : null,
    consentSettings: consentSettingsSnapshot.exists ? consentSettingsSnapshot.data() : null,
    publicNavigationSettings: publicNavigationSnapshot.exists ? publicNavigationSnapshot.data() : null
  });
}

if (action === "seed") {
  const parentSnapshot = await db.doc(`parentAccounts/${parentId}`).get();
  const childSnapshot = await db.doc(`members/${childId}`).get();
  if (!parentSnapshot.exists || !childSnapshot.exists) {
    validateParentConsentSmokeFixture({
      parent: parentSnapshot.exists ? parentSnapshot.data() : null,
      child: childSnapshot.exists ? childSnapshot.data() : null,
      event: null,
      audienceMembership: null,
      consentLink: null
    });
  }

  const { event, audienceMembership, consentLink } = buildParentConsentSmokeFixture();
  const [parentLoginSnapshot, publicNavigationSnapshot] = await Promise.all([
    db.doc("siteSettings/parentLogin").get(),
    db.doc("siteSettings/publicNavigation").get()
  ]);
  const parentLoginState = resolveParentLoginSeedState(
    parentLoginSnapshot.exists ? parentLoginSnapshot.data() : null,
    publicNavigationSnapshot.exists ? publicNavigationSnapshot.data() : null
  );
  const batch = db.batch();
  batch.set(db.doc(`events/${eventId}`), {
    ...event,
    ...marker,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.set(db.doc(`events/${eventId}/audienceMembers/${childId}`), {
    ...audienceMembership,
    ...marker,
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.set(db.doc(`eventConsentLinks/${consentToken}`), {
    ...consentLink,
    ...marker,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.set(db.doc("siteSettings/parentConsent"), {
    parentConsentEnabled: true,
    updatedBy: "TEST_SEED",
    updatedAt: FieldValue.serverTimestamp(),
    ...marker
  }, { merge: true });
  batch.set(db.doc("siteSettings/publicNavigation"), {
    parentLoginEnabled: parentLoginState.parentLoginEnabled,
    parentConsentEnabled: true
  }, { merge: true });
  if (parentLoginState.createCanonicalSetting) {
    batch.set(db.doc("siteSettings/parentLogin"), {
      parentLoginEnabled: parentLoginState.parentLoginEnabled,
      updatedBy: "TEST_SEED",
      updatedAt: FieldValue.serverTimestamp(),
      ...marker
    }, { merge: true });
  }
  await batch.commit();
}

await readFixture();
console.log(`Parent Portal consent smoke fixture ${action === "seed" ? "seeded and verified" : "verified"}: ${parentConsentSmokeIds.parentEmail} → ${childId} → ${parentConsentSmokeIds.title}.`);
