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
