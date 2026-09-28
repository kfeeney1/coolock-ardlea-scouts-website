export type PublicContentEnvironment = "local" | "test" | "production";
export type PublicContentDocumentId = "TEST_site" | "live";

export function publicSiteContentDocumentId(environment: PublicContentEnvironment): PublicContentDocumentId {
  return environment === "production" ? "live" : "TEST_site";
}

export function hasCanonicalPublicPublication(
  data: Record<string, unknown>,
  documentId: PublicContentDocumentId
): boolean {
  if (documentId === "TEST_site") {
    return data.testData === true && data.testSeed === "public-site-content-v1" && data.createdBySeed === "TEST_SEED";
  }
  return data.visibility === "public" && data.published === true && data.testData === false;
}
