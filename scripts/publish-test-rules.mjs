import { readFile } from "node:fs/promises";
import { cert, initializeApp, deleteApp } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";
import { requireFirebaseMutationTarget } from "./firebase-operation-guard.mjs";

export const RULES_ATTEMPTS = 4;
export const RULES_BACKOFF_MS = Object.freeze([5_000, 15_000, 30_000]);

export function sameRulesSource(ruleset, source, name) {
  return ruleset?.source?.length === 1
    && ruleset.source[0].name === name && ruleset.source[0].content === source;
}

// The Admin SDK compiles on create and falls back PATCH→POST only on NOT_FOUND.
// Keep the compiled ruleset across transient release failures; never ignore 409.
export async function publishReviewedRules({ source, name, getLive, create, release,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), log = console.log }) {
  let created;
  for (let attempt = 1; attempt <= RULES_ATTEMPTS; attempt += 1) {
    let stage = "read active release";
    try {
      let live;
      try { live = await getLive(); } catch (error) {
        if (error.code !== "security-rules/not-found") throw error;
      }
      if (sameRulesSource(live, source, name)) {
        log(`${name}: active release matches reviewed source exactly.`);
        return;
      }
      stage = "compile source";
      created ??= await create({ name, content: source });
      stage = "publish release";
      await release(created);
      stage = "verify active release";
      const verified = await getLive();
      if (verified.name !== created.name || !sameRulesSource(verified, source, name)) {
        throw new Error(`${name}: active release verification mismatch.`);
      }
      log(`${name}: compiled, published and read-back verified.`);
      return;
    } catch (error) {
      const status = error.httpResponse?.status;
      if (status !== 503 || attempt === RULES_ATTEMPTS) {
        // Never echo SDK payloads, which may contain request/response metadata.
        throw new Error(`${name}: ${stage} failed on attempt ${attempt}/${RULES_ATTEMPTS} (HTTP ${Number.isInteger(status) ? status : "unavailable"}); active release is not verified.`);
      }
      log(`${name}: ${stage} returned Rules API HTTP 503; retry ${attempt + 1}/${RULES_ATTEMPTS}.`);
      await sleep(RULES_BACKOFF_MS[attempt - 1]);
    }
  }
}

export function deliveryConfig(config) {
  if (config.firestore?.rules !== "firestore.rules" || config.firestore?.indexes !== "firestore.indexes.json"
    || config.storage?.length !== 1 || config.storage[0].target !== "test-default"
    || config.storage[0].rules !== "storage.rules" || !config.hosting) {
    throw new Error("Unexpected TEST deployment configuration; refusing to omit unverified Rules targets.");
  }
  const result = structuredClone(config);
  delete result.firestore.rules;
  delete result.storage;
  return result;
}

export async function publishTestRules() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const target = requireFirebaseMutationTarget({ operation: "publish-test-rules", credentialJson: raw });
  if (target.environment !== "test" || !raw || target.credentialProjectId !== "coolock-ardlea-scouts-test"
    || process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    throw new Error("Rules publication requires explicit live TEST credentials and target.");
  }
  deliveryConfig(JSON.parse(await readFile("firebase.test.json", "utf8")));
  const rc = JSON.parse(await readFile(".firebaserc", "utf8"));
  const buckets = rc.targets?.[target.projectId]?.storage?.["test-default"];
  if (buckets?.length !== 1 || buckets[0] !== "coolock-ardlea-scouts-test.firebasestorage.app") {
    throw new Error("Unexpected TEST Storage target; refusing Rules publication.");
  }
  const app = initializeApp({ credential: cert(JSON.parse(raw)), projectId: target.projectId }, "test-rules-deploy");
  try {
    const rules = getSecurityRules(app);
    for (const name of ["firestore.rules", "storage.rules"]) {
      const firestore = name === "firestore.rules";
      await publishReviewedRules({
        name, source: await readFile(name, "utf8"),
        getLive: () => firestore ? rules.getFirestoreRuleset() : rules.getStorageRuleset(buckets[0]),
        create: (file) => rules.createRuleset(file),
        release: (ruleset) => firestore ? rules.releaseFirestoreRuleset(ruleset) : rules.releaseStorageRuleset(ruleset, buckets[0]),
      });
    }
  } finally {
    await deleteApp(app);
  }
}
