const PRODUCTION_PROJECT_ID = "coolock-ardlea-scouts";
const TESTING_PROJECT_ID = "coolock-ardlea-scouts-test";
const ALLOWED = new Map([
  ["test", TESTING_PROJECT_ID],
  ["production", PRODUCTION_PROJECT_ID],
]);

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  console.error(`Firebase environment validation failed: ${message}`);
  process.exit(1);
}

const environment = arg("environment") || process.env.DEPLOY_ENVIRONMENT;
const projectId = arg("project") || process.env.FIREBASE_PROJECT_ID;
const credentialEnv = arg("credential-env");

if (!environment || !ALLOWED.has(environment)) {
  fail("an explicit --environment of test or production is required");
}
if (!projectId) fail("an explicit Firebase project is required");

const expectedProjectId = ALLOWED.get(environment);
if (projectId !== expectedProjectId) {
  fail(`${environment} must target ${expectedProjectId}, not ${projectId}`);
}

if (environment === "test" && projectId === PRODUCTION_PROJECT_ID) {
  fail("TEST must never target the production Firebase project");
}
if (environment === "production" && projectId === TESTING_PROJECT_ID) {
  fail("PRODUCTION must never target the TEST Firebase project");
}

if (credentialEnv) {
  const raw = process.env[credentialEnv];
  if (!raw) fail(`credential environment variable ${credentialEnv} is missing`);
  let credential;
  try {
    credential = JSON.parse(raw);
  } catch {
    fail(`credential environment variable ${credentialEnv} is not valid JSON`);
  }
  if (!credential.project_id) fail("service-account credential has no project_id");
  if (credential.project_id !== expectedProjectId) {
    fail(`service-account project_id does not match the selected ${environment} project`);
  }
}

console.log(`Firebase target validated: environment=${environment}, project=${projectId}`);
