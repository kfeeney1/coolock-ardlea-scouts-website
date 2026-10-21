import assert from "node:assert/strict";
import test from "node:test";
import { maintenanceFirebaseAllowed } from "../../src/services/maintenanceCostPolicy.ts";

test("Maintenance permits only matching existing Firebase environments", () => {
  for (const environment of ["local", "test", "production", "", "unknown"]) {
    for (const project of [undefined, "coolock-ardlea-scouts", "coolock-ardlea-scouts-test", "demo-coolock-ardlea-scouts"]) {
      assert.equal(maintenanceFirebaseAllowed(environment, project), ({local: "demo-coolock-ardlea-scouts", test: "coolock-ardlea-scouts-test", production: "coolock-ardlea-scouts"} as Record<string, string>)[environment] === project && project !== undefined);
    }
  }
});
