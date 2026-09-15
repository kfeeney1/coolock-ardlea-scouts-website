import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const footer = readFileSync(new URL("../../src/components/Footer.tsx", import.meta.url), "utf8");

test("policy catalogue has public and leader shared-code routes", () => {
  assert.match(app, /path="\/policies" element={<PolicyDocuments \/>}/);
  assert.match(app, /path="\/leader\/policies" element={protectedRoute\(<PolicyDocuments \/>\)}/);
});

test("public catalogue is discoverable from the shared footer", () => {
  assert.match(footer, /to="\/policies"/);
  assert.match(footer, />Policy documents</);
});
