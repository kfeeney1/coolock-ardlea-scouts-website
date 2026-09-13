import assert from "node:assert/strict";
import test from "node:test";

import { dedupeParentChildRequests, isValidParentChildRequest, matchParentChildRequest, matchParentChildRequests } from "../../src/services/parentChildMatching.ts";
import type { MemberRecord } from "../../src/services/memberAdmin.ts";

function member(id: string, firstName: string, lastName: string, dateOfBirth: string, status: MemberRecord["status"] = "active"): MemberRecord {
  return { id, firstName, lastName, displayName: `${firstName} ${lastName}`, dateOfBirth, section: "Beavers", parentName: "", emailAddress: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "", status, source: "manual", sourceJoinApplicationId: "", createdAt: null, updatedAt: null } as unknown as MemberRecord;
}

test("strong match requires exact normalized first name, surname and DOB", () => {
  const result = matchParentChildRequest({ firstName: "  Riley ", lastName: "NOLAN", dateOfBirth: "2017-03-02" }, [member("member-1", "Riley", "Nolan", "2017-03-02")]);
  assert.equal(result.outcome, "matched");
  assert.equal(result.candidateMemberId, "member-1");
});

test("no match does not invent a candidate", () => {
  const result = matchParentChildRequest({ firstName: "Riley", lastName: "Nolan", dateOfBirth: "2017-03-03" }, [member("member-1", "Riley", "Nolan", "2017-03-02")]);
  assert.equal(result.outcome, "none");
  assert.equal(result.candidateMemberId, null);
});

test("ambiguous match never guesses a member", () => {
  const request = { firstName: "Alex", lastName: "Murphy", dateOfBirth: "2016-05-04" };
  const result = matchParentChildRequest(request, [member("one", "Alex", "Murphy", "2016-05-04"), member("two", "Alex", "Murphy", "2016-05-04")]);
  assert.equal(result.outcome, "ambiguous");
  assert.equal(result.candidateCount, 2);
  assert.equal(result.candidateMemberId, null);
});

test("multiple children are matched independently", () => {
  const results = matchParentChildRequests([
    { firstName: "Riley", lastName: "Nolan", dateOfBirth: "2017-03-02" },
    { firstName: "Casey", lastName: "Nolan", dateOfBirth: "2014-09-10" }
  ], [member("riley", "Riley", "Nolan", "2017-03-02"), member("casey", "Casey", "Nolan", "2014-09-10")]);
  assert.deepEqual(results.map((result) => result.candidateMemberId), ["riley", "casey"]);
});

test("duplicate requests collapse to one relationship request", () => {
  const deduped = dedupeParentChildRequests([
    { firstName: "Riley", lastName: "Nolan", dateOfBirth: "2017-03-02" },
    { firstName: " riley ", lastName: "NOLAN", dateOfBirth: "2017-03-02" }
  ]);
  assert.equal(deduped.length, 1);
});

test("malformed child information is rejected", () => {
  assert.equal(isValidParentChildRequest({ firstName: "", lastName: "Nolan", dateOfBirth: "2017-03-02" }), false);
  assert.equal(isValidParentChildRequest({ firstName: "Riley", lastName: "Nolan", dateOfBirth: "2017-02-31" }), false);
});

test("left members are not candidates", () => {
  const result = matchParentChildRequest({ firstName: "Riley", lastName: "Nolan", dateOfBirth: "2017-03-02" }, [member("old", "Riley", "Nolan", "2017-03-02", "left")]);
  assert.equal(result.outcome, "none");
});
