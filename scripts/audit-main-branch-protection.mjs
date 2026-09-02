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
  ? rulesets.filter((ruleset) => ruleset?.enforcement === "active" || ruleset?.enforcement === "evaluate")
  : [];

console.log(`main protected: ${Boolean(branch.protected)}`);
console.log(`repository rulesets: ${Array.isArray(rulesets) ? rulesets.length : 0}`);
console.log(`active/evaluating rulesets: ${activeRulesets.length}`);

if (!branch.protected && activeRulesets.length === 0) {
  console.error("FAIL: main has no branch protection and no active/evaluating repository ruleset.");
  console.error("Configure GitHub branch protection or a ruleset before treating merges to main as production-gated.");
  process.exit(1);
}

const configuredChecks = [
  ...(branch.protection?.required_status_checks?.contexts ?? []),
  ...((branch.protection?.required_status_checks?.checks ?? []).map((check) => check?.context).filter(Boolean))
];

if (configuredChecks.length > 0) {
  console.log(`required status checks visible on branch summary: ${[...new Set(configuredChecks)].join(", ")}`);
} else {
  console.log("Branch protection/ruleset exists, but required status-check details are not exposed by the branch summary endpoint.");
}

console.log("Branch protection drift audit passed.");
