export function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function hasTestReference(value) {
  return Array.isArray(value) && value.some((item) => text(item).startsWith("TEST_"));
}

export function classifyTestDocument(doc) {
  const data = doc.data();
  const reasons = [];
  const id = doc.id;

  if (data?.testData === true && (id.startsWith("TEST") || data.createdBySeed === "TEST_SEED" || typeof data.testSeed === "string")) {
    reasons.push("marked-test-data");
  }

  for (const [label, value] of [
    ["document-id", id],
    ["eventId", data?.eventId],
    ["memberId", data?.memberId],
    ["matchedMemberId", data?.matchedMemberId],
    ["uid", data?.uid],
  ]) {
    if (text(value).startsWith("TEST_")) reasons.push(`test-reference:${label}`);
  }

  if (hasTestReference(data?.memberIds)) reasons.push("test-reference:memberIds");

  return [...new Set(reasons)];
}

export function isTestDocument(doc) {
  return classifyTestDocument(doc).length > 0;
}
