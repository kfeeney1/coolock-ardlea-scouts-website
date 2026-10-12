import assert from "node:assert/strict";
import test from "node:test";

import { matchesRoverAdultIdentity, matchingUnlinkedRoverMembers, roverMembershipSections } from "../../src/services/roverMembershipLogic.ts";

test("managed Rover linking requires the same adult name and email", () => {
  const adult = { displayName: "Rovers Section Leader", email: "rovers.leader@example.com" };

  assert.equal(matchesRoverAdultIdentity({ displayName: " Rovers Section Leader ", emailAddress: " rovers.leader@example.com " }, adult), true);
  assert.equal(matchesRoverAdultIdentity({ displayName: "Rovers Section Leader", emailAddress: "other@example.com" }, adult), false);
  assert.equal(matchesRoverAdultIdentity({ displayName: "Different Adult", emailAddress: "rovers.leader@example.com" }, adult), false);
  assert.equal(matchesRoverAdultIdentity({ emailAddress: "rovers.leader@example.com" }, adult), false);
});

test("managed designation reuses only a unique unlinked existing member record", () => {
  const adult = { displayName: "Rovers Section Leader", email: "rovers.leader@example.com" };
  const records = [
    { id: "existing", displayName: adult.displayName, emailAddress: adult.email },
    { id: "linked", accountUid: "someone-else", displayName: adult.displayName, emailAddress: adult.email },
    { id: "different", displayName: "Different Adult", emailAddress: adult.email },
  ];

  assert.deepEqual(matchingUnlinkedRoverMembers(records, adult).map(({ id }) => id), ["existing"]);
  assert.equal(matchingUnlinkedRoverMembers(records.filter(({ id }) => id !== "existing"), adult).length, 0);
  assert.equal(matchingUnlinkedRoverMembers([...records, { ...records[0], id: "duplicate" }], adult).length, 2);
});

test("Rover designation and removal are idempotent and preserve other sections", () => {
  const designated = roverMembershipSections(["Scouts"], true);
  assert.deepEqual(designated, ["Scouts", "Rovers"]);
  assert.deepEqual(roverMembershipSections(designated, true), designated);
  const removed = roverMembershipSections(designated, false);
  assert.deepEqual(removed, ["Scouts"]);
  assert.deepEqual(roverMembershipSections(removed, false), removed);
});
