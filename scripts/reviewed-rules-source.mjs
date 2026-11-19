import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function readCommittedRules(sha, name = "firestore.rules") {
  return execFileSync("git", ["show", `${sha}:${name}`]);
}

export function rulesSourceDigest(content) {
  return createHash("sha256").update(content).digest("hex");
}

export async function readReviewedTestRules(sha, name, log = console.log) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? "") ||
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() !== sha) {
    throw new Error("TEST Rules publication requires a checkout matching GITHUB_SHA.");
  }
  const reviewed = readCommittedRules(sha, name);
  const checkout = await readFile(name);
  if (!checkout.equals(reviewed)) {
    throw new Error(`${name}: checkout differs from reviewed commit ${sha} (reviewed SHA-256=${rulesSourceDigest(reviewed)}, checkout SHA-256=${rulesSourceDigest(checkout)}).`);
  }
  log(`${name}: verified TEST source at ${sha}, source SHA-256=${rulesSourceDigest(reviewed)}.`);
  return reviewed.toString("utf8");
}

export function compileRulesSource(rules, { name, content }) {
  return rules.createRuleset({ name, content });
}
