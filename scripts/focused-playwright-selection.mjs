import { readFileSync } from "node:fs";
import { suitesForChangedPath } from "./playwright-suites.mjs";

export const focusedGroupNames = ["navigation", "activities", "polls", "communications"];

const allGroups = new Set(focusedGroupNames);

function addSuiteGroups(groups, suite) {
  if (suite === "activities-programme") {
    groups.add("activities");
    groups.add("navigation");
  } else if (["members-parents-consent", "equipment", "authentication-rbac", "platform-ui"].includes(suite)) {
    groups.add("navigation");
  } else if (suite === "public-pages") {
    groups.add("communications");
  }
}

export function selectFocusedGroups(changedFiles, { forceAll = false } = {}) {
  if (forceAll || !Array.isArray(changedFiles) || changedFiles.length === 0) return new Set(allGroups);

  const groups = new Set();
  for (const file of changedFiles) {
    // Email worker changes have their own required unit tests; the E2E PR
    // selector conservatively falls back to the full browser suite for them.
    if (file.startsWith("email-worker/")) continue;
    // Selector logic and its unit tests are verified by the required Quality job.
    // They do not change the application and must not start the browser emulator.
    if (file === "scripts/focused-playwright-selection.mjs" ||
        file === "tests/unit/focusedPlaywrightSelection.test.ts") continue;
    if (file.startsWith(".github/workflows/")) {
      // Operational workflows do not change browser behaviour. Keep broad
      // coverage for workflows that actually control application E2E or deploys.
      if (file === ".github/workflows/firestore-backup-freshness.yml" ||
          file === ".github/workflows/firestore-backup.yml" ||
          file === ".github/workflows/sw-318-first-run.yml") continue;
      return new Set(allGroups);
    }
    if ([
      "scripts/playwright-suites.mjs",
      "scripts/run-playwright-suite.mjs",
      "playwright.config.ts",
      "package.json",
      "package-lock.json"
    ].includes(file)) return new Set(allGroups);

    if (file === "e2e/polls.spec.ts") {
      groups.add("polls");
      continue;
    }

    const suites = suitesForChangedPath(file);
    if (suites === null) return new Set(allGroups);
    for (const suite of suites) addSuiteGroups(groups, suite);
  }
  return groups;
}

export function formatFocusedOutputs(groups) {
  const selected = groups instanceof Set ? groups : new Set(groups);
  const values = [
    ["run", selected.size > 0],
    ...focusedGroupNames.map((name) => [name, selected.has(name)])
  ];
  return `${values.map(([name, value]) => `${name}=${value}`).join("\n")}\n`;
}

function outputAllGroups() {
  process.stdout.write(formatFocusedOutputs(allGroups));
}

const args = process.argv.slice(2);
if (args.includes("--force-all")) {
  outputAllGroups();
} else {
  const fileIndex = args.indexOf("--files");
  if (fileIndex < 0 || !args[fileIndex + 1]) {
    console.error("Missing --files <path>; conservatively selecting every focused group.");
    outputAllGroups();
  } else {
    try {
      const changedFiles = readFileSync(args[fileIndex + 1], "utf8")
        .split(/\r?\n/)
        .map((file) => file.trim())
        .filter(Boolean);
      process.stdout.write(formatFocusedOutputs(selectFocusedGroups(changedFiles)));
    } catch (error) {
      console.error("Unable to read changed files; conservatively selecting every focused group.");
      outputAllGroups();
    }
  }
}
