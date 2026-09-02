import assert from "node:assert/strict";
import test from "node:test";

import {
  OPERATIONAL_EXPORT_POLICIES,
  assertOperationalExportAllowed,
  type OperationalExportKind
} from "../../src/services/exportGovernance.ts";

const kinds: OperationalExportKind[] = [
  "member-list",
  "membership-summary",
  "event-overview",
  "attendance-trends",
  "event-roster",
  "outstanding-consent"
];

test("all approved leader report exports have governance policy", () => {
  assert.deepEqual(Object.keys(OPERATIONAL_EXPORT_POLICIES).sort(), [...kinds].sort());
});

test("ordinary leaders need at least one permitted section before export", () => {
  assert.throws(
    () => assertOperationalExportAllowed("member-list", { isAdmin: false, sections: [] }),
    /requires at least one permitted section/
  );
});

test("ordinary leaders can export within assigned section scope", () => {
  const policy = assertOperationalExportAllowed("event-roster", { isAdmin: false, sections: ["Cubs"] });
  assert.equal(policy.sensitivity, "operational");
});

test("admin exports retain privacy exclusions", () => {
  const memberPolicy = assertOperationalExportAllowed("member-list", { isAdmin: true, sections: [] });
  assert.deepEqual(memberPolicy.excludedData, ["date-of-birth", "medical", "emergency-contact"]);

  const aggregatePolicy = assertOperationalExportAllowed("membership-summary", { isAdmin: true, sections: [] });
  assert.ok(aggregatePolicy.excludedData.includes("member-name"));
  assert.ok(aggregatePolicy.excludedData.includes("medical"));
});
