const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!repository || !repository.includes("/")) {
  throw new Error("GITHUB_REPOSITORY must be set to owner/repo.");
}

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "coolock-ardlea-scouts-branch-protection-audit"
};
if (token) headers.Authorization = `Bearer ${token}`;

async function getJson(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${path} returned ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

const branch = await getJson("/branches/main");
const rulesets = await getJson("/rulesets");
const activeRulesets = Array.isArray(rulesets)
  ? rulesets.filter((ruleset) => ruleset?.enforcement === "active")
  : [];

const activeRulesetDetails = await Promise.all(
  activeRulesets
    .filter((ruleset) => ruleset?.id)
    .map((ruleset) => getJson(`/rulesets/${ruleset.id}`))
);

console.log(`main protected: ${Boolean(branch.protected)}`);
console.log(`repository rulesets: ${Array.isArray(rulesets) ? rulesets.length : 0}`);
console.log(`active rulesets: ${activeRulesets.length}`);

if (!branch.protected && activeRulesets.length === 0) {
  console.error("FAIL: main has no branch protection and no active repository ruleset.");
  console.error("Configure GitHub branch protection or a ruleset before treating merges to main as production-gated.");
  process.exit(1);
}

const configuredChecks = [
  ...(branch.protection?.required_status_checks?.contexts ?? []),
  ...((branch.protection?.required_status_checks?.checks ?? []).map((check) => check?.context).filter(Boolean)),
  ...activeRulesetDetails.flatMap((ruleset) =>
    (ruleset?.rules ?? [])
      .filter((rule) => rule?.type === "required_status_checks")
      .flatMap((rule) => rule?.parameters?.required_status_checks ?? [])
      .map((check) => check?.context)
      .filter(Boolean)
  )
];

const requiredChecks = ["quality", "e2e"];
const uniqueConfiguredChecks = [...new Set(configuredChecks)];
const missingChecks = requiredChecks.filter((check) => !uniqueConfiguredChecks.includes(check));

if (configuredChecks.length > 0) {
  console.log(`required status checks: ${uniqueConfiguredChecks.join(", ")}`);
} else {
  console.error("FAIL: branch protection/ruleset exists, but no required status checks are configured.");
  process.exit(1);
}

if (missingChecks.length > 0) {
  console.error(`FAIL: main is missing required status checks: ${missingChecks.join(", ")}.`);
  process.exit(1);
}

console.log("Branch protection drift audit passed.");
