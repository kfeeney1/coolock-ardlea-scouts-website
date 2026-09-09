const PROJECTS = Object.freeze({
  local: "demo-coolock-ardlea-scouts",
  test: "coolock-ardlea-scouts-test",
  production: "coolock-ardlea-scouts",
});

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCredentialProjectId(rawCredentialJson) {
  if (!rawCredentialJson) return "";
  let parsed;
  try {
    parsed = JSON.parse(rawCredentialJson);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.");
  }
  return text(parsed?.project_id);
}

export function requireFirebaseMutationTarget({
  operation,
  credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  requireAuthEmulator = false,
  allowProduction = false,
} = {}) {
  const environment = text(process.env.DEPLOY_ENVIRONMENT || process.env.APP_ENVIRONMENT || process.env.VITE_APP_ENV);
  const projectId = text(process.env.FIREBASE_PROJECT_ID);

  if (!operation) throw new Error("Firebase mutation guard requires an operation name.");
  if (!Object.hasOwn(PROJECTS, environment)) {
    throw new Error(`${operation}: set DEPLOY_ENVIRONMENT (or VITE_APP_ENV for local automation) explicitly to local, test or production.`);
  }
  if (!projectId) throw new Error(`${operation}: FIREBASE_PROJECT_ID must be explicit.`);

  const expectedProject = PROJECTS[environment];
  if (projectId !== expectedProject) {
    throw new Error(`${operation}: ${environment} must target ${expectedProject}; received ${projectId}.`);
  }

  const credentialProjectId = parseCredentialProjectId(credentialJson);
  if (credentialProjectId && credentialProjectId !== expectedProject) {
    throw new Error(`${operation}: service-account project_id ${credentialProjectId} does not match ${environment} target ${expectedProject}.`);
  }

  if (environment === "local") {
    if (!text(process.env.FIRESTORE_EMULATOR_HOST)) {
      throw new Error(`${operation}: local mutation requires FIRESTORE_EMULATOR_HOST.`);
    }
    if (requireAuthEmulator && !text(process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
      throw new Error(`${operation}: local Auth mutation requires FIREBASE_AUTH_EMULATOR_HOST.`);
    }
  }

  if (environment === "production") {
    if (!allowProduction) {
      throw new Error(`${operation}: production mutation is not supported by this script.`);
    }
    if (!process.argv.includes("--allow-production")) {
      throw new Error(`${operation}: production mutation requires --allow-production.`);
    }
    if (text(process.env.PRODUCTION_PROJECT_CONFIRMATION) !== PROJECTS.production) {
      throw new Error(`${operation}: PRODUCTION_PROJECT_CONFIRMATION must exactly equal ${PROJECTS.production}.`);
    }
    if (text(process.env.ALLOW_PRODUCTION_MUTATION) !== "I_UNDERSTAND") {
      throw new Error(`${operation}: ALLOW_PRODUCTION_MUTATION=I_UNDERSTAND is required for production mutation.`);
    }
  }

  console.log(`Firebase mutation target validated: operation=${operation}, environment=${environment}, project=${projectId}`);
  return { environment, projectId, credentialProjectId };
}

export function firebaseProjectForEnvironment(environment) {
  return PROJECTS[environment];
}
