import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const indexHtml = readFileSync("index.html", "utf8");
const productionWorkflow = readFileSync(".github/workflows/firebase-hosting-merge.yml", "utf8");

test("SPA shell exposes the production build SHA for live deployment verification", () => {
  assert.match(indexHtml, /<meta\s+name="app-build-sha"\s+content="%VITE_BUILD_COMMIT%"\s*\/>/);
});

test("production workflow supplies VITE_BUILD_COMMIT to the production build", () => {
  assert.match(productionWorkflow, /VITE_BUILD_COMMIT: \$\{\{ inputs\.commit_sha \}\}/);
});
