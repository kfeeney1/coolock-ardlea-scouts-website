import assert from "node:assert/strict";
import test from "node:test";
import type { RequestedLeaderRole } from "../../src/services/leaderRegistrations.ts";

function requestedRole(value: RequestedLeaderRole): RequestedLeaderRole { return value; }

test("Deputy Group Leader is a supported canonical requested appointment", () => {
  assert.equal(requestedRole("Deputy Group Leader"), "Deputy Group Leader");
});
