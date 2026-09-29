import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { hasCanonicalPublicPublication, publicSiteContentDocumentId } from "../../src/services/publicSiteContentLogic.ts";

test("selects the canonical public content document for each environment", () => {
  assert.equal(publicSiteContentDocumentId("local"), "TEST_site");
  assert.equal(publicSiteContentDocumentId("test"), "TEST_site");
  assert.equal(publicSiteContentDocumentId("production"), "live");
});

test("accepts canonical TEST and published production provenance", () => {
  assert.equal(hasCanonicalPublicPublication({
    testData: true, testSeed: "public-site-content-v1", createdBySeed: "TEST_SEED",
  }, "TEST_site"), true);
  assert.equal(hasCanonicalPublicPublication({
    testData: false, visibility: "public", published: true,
  }, "live"), true);
});

test("rejects TEST provenance on the production document and unpublished content", () => {
  assert.equal(hasCanonicalPublicPublication({
    testData: true, testSeed: "public-site-content-v1", createdBySeed: "TEST_SEED",
  }, "live"), false);
  assert.equal(hasCanonicalPublicPublication({
    testData: false, visibility: "public", published: false,
  }, "live"), false);
});

test("the loader validates the selected environment document before parsing", () => {
  const source = readFileSync("src/services/publicSiteContent.ts", "utf8");
  assert.match(source, /publicSiteContentDocumentId\(appEnvironment\)/);
  assert.match(source, /hasCanonicalPublicPublication\(data, documentId\)/);
  assert.match(source, /doc\(db, "publicSiteContent", documentId\)/);
});
