import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("consent reminder delivery history is server-only", () => {
  const rules = fs.readFileSync("firestore.rules", "utf8");
  assert.match(rules, /match \/consentReminderDeliveries\/\{reminderId\} \{\s*allow read, write: if false;\s*\}/s);
});
