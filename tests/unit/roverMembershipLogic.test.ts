import assert from "node:assert/strict";
import test from "node:test";

import { matchesRoverAdultIdentity } from "../../src/services/roverMembershipLogic.ts";

test("managed Rover linking requires the same adult name and email", () => {
  const adult = { displayName: "Rovers Section Leader", email: "rovers.leader@example.com" };

  assert.equal(matchesRoverAdultIdentity({ displayName: " Rovers Section Leader ", emailAddress: "ROVERS.LEADER@example.com " }, adult), true);
  assert.equal(matchesRoverAdultIdentity({ displayName: "Rovers Section Leader", emailAddress: "other@example.com" }, adult), false);
  assert.equal(matchesRoverAdultIdentity({ displayName: "Different Adult", emailAddress: "rovers.leader@example.com" }, adult), false);
  assert.equal(matchesRoverAdultIdentity({ emailAddress: "rovers.leader@example.com" }, adult), false);
});
