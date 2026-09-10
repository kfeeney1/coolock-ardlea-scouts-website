import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/firebase-hosting-merge.yml", "utf8");

test("production deployment provisions Java 21 before Firebase emulator release checks", () => {
  const setupJava = workflow.indexOf("- name: Setup Java for Firebase emulators");
  const firestoreTests = workflow.indexOf("- name: Re-run Firestore Rules tests on emulators");

  assert.notEqual(setupJava, -1, "production workflow must configure Java for Firebase emulators");
  assert.match(workflow, /uses: actions\/setup-java@dd06d9cba3e5552c54d9f8ea23572deb30010f7c # v6\.0\.0/);
  assert.match(workflow, /java-version: '21'/);
  assert.ok(setupJava < firestoreTests, "Java 21 must be configured before Firestore emulator tests");
});

test("production preflight emulator tests are isolated to the demo Firebase project", () => {
  const firestoreStart = workflow.indexOf("- name: Re-run Firestore Rules tests on emulators");
  const storageStart = workflow.indexOf("- name: Re-run Storage Rules tests on emulators");
  const credentialStart = workflow.indexOf("- name: Validate production credential target");

  assert.notEqual(firestoreStart, -1);
  assert.notEqual(storageStart, -1);
  assert.notEqual(credentialStart, -1);

  const firestoreStep = workflow.slice(firestoreStart, storageStart);
  const storageStep = workflow.slice(storageStart, credentialStart);

  for (const step of [firestoreStep, storageStep]) {
    assert.match(step, /FIREBASE_PROJECT_ID: demo-coolock-ardlea-scouts/);
    assert.match(step, /--project "\$FIREBASE_PROJECT_ID"/);
    assert.doesNotMatch(step, /--project coolock-ardlea-scouts(?:\s|$)/);
  }
});

test("production deployment target remains the real production Firebase project", () => {
  assert.match(workflow, /^  FIREBASE_PROJECT_ID: coolock-ardlea-scouts$/m);
  assert.match(workflow, /deploy --only firestore:rules,firestore:indexes,storage,hosting --project "\$FIREBASE_PROJECT_ID" --non-interactive/);
});
