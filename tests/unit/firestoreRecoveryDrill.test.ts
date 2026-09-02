import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRecoveryDrillTarget,
  fixtureFingerprint,
  RECOVERY_DRILL_FIXTURES,
  RECOVERY_DRILL_PROJECT_ID
} from "../../scripts/firestore-recovery-drill.mjs";

test("recovery drill accepts only the dedicated demo project and local emulator", () => {
  assert.doesNotThrow(() => assertRecoveryDrillTarget({
    projectId: RECOVERY_DRILL_PROJECT_ID,
    emulatorHost: "127.0.0.1:8080"
  }));

  assert.throws(() => assertRecoveryDrillTarget({
    projectId: "coolock-ardlea-scouts",
    emulatorHost: "127.0.0.1:8080"
  }), /refuses project/);

  assert.throws(() => assertRecoveryDrillTarget({
    projectId: RECOVERY_DRILL_PROJECT_ID,
    emulatorHost: "firestore.googleapis.com:443"
  }), /local Firestore emulator/);
});

test("recovery drill manifest is deterministic and contains only synthetic fixtures", () => {
  assert.equal(RECOVERY_DRILL_FIXTURES.length, 3);
  assert.equal(fixtureFingerprint(), fixtureFingerprint([...RECOVERY_DRILL_FIXTURES].reverse()));
  assert.match(fixtureFingerprint(), /^[a-f0-9]{64}$/);
  assert.ok(RECOVERY_DRILL_FIXTURES.every((fixture) => fixture.id.includes("test-")));
});
