import { fileURLToPath } from "node:url";

export function validateBuildInfo(payload, { expectedBuildSha = "", now = Date.now() } = {}) {
  const problems = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return ["build-info.json must contain a JSON object."];
  }

  const commit = String(payload.commit || "").trim();
  const source = String(payload.source || "").trim();
  const buildTime = String(payload.buildTime || "").trim();
  const buildTimeMs = Date.parse(buildTime);

  if (!commit) problems.push("build-info.json is missing commit.");
  if (!Number.isFinite(buildTimeMs)) problems.push("build-info.json has an invalid buildTime.");
  else if (buildTimeMs > now + 5 * 60 * 1000) problems.push("build-info.json buildTime is unexpectedly in the future.");
  if (!new Set(["github-actions", "local"]).has(source)) problems.push("build-info.json has an unsupported source.");

  if (expectedBuildSha) {
    if (commit !== expectedBuildSha) problems.push(`deployed build ${commit || "<missing>"} does not match expected ${expectedBuildSha}.`);
    if (source !== "github-actions") problems.push("a release with EXPECTED_BUILD_SHA must identify source as github-actions.");
  }

  return problems;
}

async function main() {
  const siteUrl = String(process.env.SITE_URL || "").replace(/\/$/, "");
  const expectedBuildSha = String(process.env.EXPECTED_BUILD_SHA || "").trim();
  if (!siteUrl.startsWith("https://")) throw new Error("SITE_URL must be a valid HTTPS URL.");

  const response = await fetch(`${siteUrl}/build-info.json?t=${Date.now()}`, { cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error(`/build-info.json returned ${response.status}.`);

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("/build-info.json did not return valid JSON.");
  }

  const problems = validateBuildInfo(payload, { expectedBuildSha });
  if (problems.length) throw new Error(`Deployed release evidence is invalid:\n- ${problems.join("\n- ")}`);

  console.log(`PASS: deployed build evidence identifies ${payload.commit} from ${payload.source} at ${payload.buildTime}.`);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  });
}
