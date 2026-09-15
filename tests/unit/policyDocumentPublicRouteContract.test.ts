import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");

test("policy catalogue is a first-class React route suitable for direct refresh", () => {
  assert.match(app, /<Route path="\/policies" element={<PolicyDocuments \/>} \/>/);
});
