import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedEventStatuses,
  canTransitionEventStatus,
  eventCloseOutIssues,
  eventCloseOutReady,
} from "../../src/services/eventLifecycleLogic.ts";

test("event lifecycle only permits deliberate adjacent transitions", () => {
  assert.deepEqual(allowedEventStatuses("draft"), ["draft", "open"]);
  assert.equal(canTransitionEventStatus("draft", "completed"), false);
  assert.equal(canTransitionEventStatus("open", "closed"), true);
  assert.equal(canTransitionEventStatus("closed", "completed"), true);
  assert.equal(canTransitionEventStatus("completed", "open"), false);
});

test("event close-out requires a closed event and a resolved roster", () => {
  const issues = eventCloseOutIssues({
    status: "open",
    consentRequired: true,
    attendance: { a: "attending", b: "invited" },
    consent: { a: "received", b: "required" },
  });

  assert.match(issues.join(" "), /Closed/);
  assert.match(issues.join(" "), /invited/);
  assert.match(issues.join(" "), /consent/);
});

test("event close-out is ready when attendance and required consent are resolved", () => {
  assert.equal(eventCloseOutReady({
    status: "closed",
    consentRequired: true,
    attendance: { a: "attending", b: "not-attending" },
    consent: { a: "received", b: "received" },
  }), true);
});

test("events without consent do not require consent entries to close out", () => {
  assert.equal(eventCloseOutReady({
    status: "closed",
    consentRequired: false,
    attendance: { a: "attending" },
    consent: {},
  }), true);
});
