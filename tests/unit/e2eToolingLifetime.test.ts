import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("E2E runtime packages are installed together before emulators start and never pruned while running", () => {
  const workflow = readFileSync(".github/workflows/playwright-e2e.yml", "utf8");
  const start = workflow.indexOf('npx firebase emulators:start');
  assert.ok(start > 0);
  const installs = [...workflow.matchAll(/^\s*run: (npm install --no-save[^\n]*)$/gm)];
  assert.equal(installs.length, 1, "separate no-save installs can prune each other's runtime dependencies");
  assert.ok(installs[0].index! < start);
  for (const dependency of ["firebase-admin@14.3.0", "firebase-tools@15.28.1", "@playwright/test@1.62.1", "@rolldown/binding-linux-x64-gnu@1.2.5"]) assert.ok(installs[0][1].includes(dependency), dependency);
  assert.doesNotMatch(workflow.slice(start), /\bnpm (?:ci|install)\b/, "running emulator workers resolve runtime files lazily");
});
