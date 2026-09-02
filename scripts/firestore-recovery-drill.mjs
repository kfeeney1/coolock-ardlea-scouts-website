import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const RECOVERY_DRILL_PROJECT_ID = "demo-coolock-ardlea-recovery";

export const RECOVERY_DRILL_FIXTURES = [
  {
    id: "member-test-001",
    fields: {
      kind: { stringValue: "member" },
      section: { stringValue: "Cubs" },
      active: { booleanValue: true },
      sequence: { integerValue: "7" }
    }
  },
  {
    id: "event-test-001",
    fields: {
      kind: { stringValue: "event" },
      title: { stringValue: "Recovery Drill Camp" },
      consentRequired: { booleanValue: true }
    }
  },
  {
    id: "parent-link-test-001",
    fields: {
      kind: { stringValue: "parent-link" },
      memberId: { stringValue: "member-test-001" },
      status: { stringValue: "active" }
    }
  }
];

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fixtureFingerprint(fixtures = RECOVERY_DRILL_FIXTURES) {
  const normalized = [...fixtures]
    .map(({ id, fields }) => ({ id, fields }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256").update(stableStringify(normalized)).digest("hex");
}

export function assertRecoveryDrillTarget({ projectId, emulatorHost }) {
  if (projectId !== RECOVERY_DRILL_PROJECT_ID) {
    throw new Error(`Recovery drill refuses project ${projectId || "<missing>"}; expected ${RECOVERY_DRILL_PROJECT_ID}.`);
  }
  if (!/^(?:127\.0\.0\.1|localhost):\d+$/.test(emulatorHost || "")) {
    throw new Error("Recovery drill requires a local Firestore emulator host.");
  }
}

function collectionUrl(projectId, emulatorHost) {
  return `http://${emulatorHost}/v1/projects/${projectId}/databases/(default)/documents/recoveryDrillFixtures`;
}

async function writeFixture(projectId, emulatorHost, fixture) {
  const response = await fetch(`${collectionUrl(projectId, emulatorHost)}/${encodeURIComponent(fixture.id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fields: fixture.fields })
  });
  if (!response.ok) throw new Error(`Unable to write recovery fixture ${fixture.id}: ${response.status}.`);
}

async function readFixtures(projectId, emulatorHost) {
  const response = await fetch(`${collectionUrl(projectId, emulatorHost)}?pageSize=100`);
  if (!response.ok) throw new Error(`Unable to read recovery fixtures: ${response.status}.`);
  const payload = await response.json();
  return (payload.documents || [])
    .map((document) => ({ id: String(document.name || "").split("/").at(-1), fields: document.fields || {} }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function assertFixtureSet(actual) {
  const expected = [...RECOVERY_DRILL_FIXTURES].sort((left, right) => left.id.localeCompare(right.id));
  if (actual.length !== expected.length) {
    throw new Error(`Recovery fixture count mismatch: expected ${expected.length}, got ${actual.length}.`);
  }
  if (stableStringify(actual) !== stableStringify(expected)) {
    throw new Error("Recovered fixture contents do not match the deterministic recovery manifest.");
  }
}

async function writeEvidence(path, projectId) {
  if (!path) return;
  await mkdir(dirname(path), { recursive: true });
  const evidence = {
    projectId,
    environment: "firestore-emulator",
    fixtureCount: RECOVERY_DRILL_FIXTURES.length,
    fixtureSha256: fixtureFingerprint(),
    verifiedAt: new Date().toISOString(),
    result: "restored-and-verified"
  };
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

async function main() {
  const mode = process.argv[2];
  const projectId = String(process.env.RECOVERY_DRILL_PROJECT_ID || "").trim();
  const emulatorHost = String(process.env.FIRESTORE_EMULATOR_HOST || "").trim();
  assertRecoveryDrillTarget({ projectId, emulatorHost });

  if (mode === "seed") {
    for (const fixture of RECOVERY_DRILL_FIXTURES) await writeFixture(projectId, emulatorHost, fixture);
    assertFixtureSet(await readFixtures(projectId, emulatorHost));
    console.log(`PASS: seeded ${RECOVERY_DRILL_FIXTURES.length} synthetic recovery fixtures (${fixtureFingerprint()}).`);
    return;
  }

  if (mode === "verify") {
    assertFixtureSet(await readFixtures(projectId, emulatorHost));
    await writeEvidence(String(process.env.RECOVERY_DRILL_EVIDENCE_PATH || "").trim(), projectId);
    console.log(`PASS: restored ${RECOVERY_DRILL_FIXTURES.length} synthetic recovery fixtures (${fixtureFingerprint()}).`);
    return;
  }

  throw new Error("Usage: node scripts/firestore-recovery-drill.mjs <seed|verify>");
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  });
}
