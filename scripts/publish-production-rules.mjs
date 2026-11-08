import { requireFirebaseMutationTarget } from "./firebase-operation-guard.mjs";
import { publishProjectRules } from "./publish-test-rules.mjs";

async function publishProductionRules() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const target = requireFirebaseMutationTarget({
    operation: "publish-production-rules",
    credentialJson: raw,
    allowProduction: true,
  });
  const bucket = process.env.PRODUCTION_STORAGE_BUCKET;
  if (target.environment !== "production" || target.credentialProjectId !== "coolock-ardlea-scouts"
    || bucket !== "coolock-ardlea-scouts.firebasestorage.app"
    || process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    throw new Error("Rules publication requires explicit production credentials and the canonical Storage bucket.");
  }
  await publishProjectRules({ raw, projectId: target.projectId, bucket });
}

publishProductionRules().catch(error => {
  console.error(`Firebase production Rules publication failed: ${error.message}`);
  process.exitCode = 1;
});
