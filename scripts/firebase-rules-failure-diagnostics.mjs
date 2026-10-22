import { readFile } from "node:fs/promises";

// Reconstruct only allowlisted status metadata, never echo debug log lines.
export function firebaseRulesHttpStatuses(debugLog) {
  const statuses = [];
  const pattern = /\[apiv2\]\[status\] (GET|POST|PATCH) https:\/\/firebaserules\.googleapis\.com\/v1\/projects\/coolock-ardlea-scouts-test(?::test|\/rulesets(?:\/[A-Za-z0-9_-]+)?|\/releases(?:\/cloud\.firestore)?) ([1-5]\d{2})\s*$/;
  for (const line of String(debugLog).split(/\r?\n/)) {
    const match = line.match(pattern);
    if (match) statuses.push(`Firebase Rules API ${match[1]} HTTP ${match[2]}`);
  }
  return statuses.slice(-20);
}

export async function reportFirebaseRulesFailure(log = console.error) {
  try {
    const statuses = firebaseRulesHttpStatuses(await readFile("firebase-debug.log", "utf8"));
    for (const status of statuses) log(status);
  } catch {
    log("Firebase Rules HTTP diagnostics unavailable; deployment remains failed.");
  }
}
