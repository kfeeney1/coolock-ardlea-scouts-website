import assert from "node:assert/strict";
import test from "node:test";

import { orderAuthorisedScouters } from "../../src/services/authorisedScouterOrdering.ts";

test("SW-301 orders section Scouters first and de-duplicates people by canonical uid", () => {
  const ordered = orderAuthorisedScouters([
    { uid: "b", displayName: "Tony Leader", sections: ["Cubs"], scoutingRole: "Programme Scouter" },
    { uid: "a", displayName: "Alice Leader", sections: ["Beavers"], scoutingRole: "Section Leader" },
    { uid: "a", displayName: "Alice Duplicate Appointment", sections: ["Cubs"], scoutingRole: "Programme Scouter" },
    { uid: "c", displayName: "Cara Leader", sections: ["Cubs"], scoutingRole: "Section Leader" }
  ], "Cubs");
  assert.deepEqual(ordered.map((item) => item.uid), ["c", "b", "a"]);
  assert.equal(new Set(ordered.map((item) => item.uid)).size, ordered.length);
});
