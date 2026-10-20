import assert from "node:assert/strict";
import test from "node:test";
import { maintenanceEmulatorAllowed } from "../../src/services/maintenanceCostPolicy.ts";

test("Maintenance permits demo development only, never a billable live project", () => {
  for (const environment of ["local", "test", "production", "", "unknown"]) {
    for (const project of [undefined, "coolock-ardlea-scouts", "coolock-ardlea-scouts-test", "demo-coolock-ardlea-scouts"]) {
      assert.equal(maintenanceEmulatorAllowed(environment, project), environment === "local" && project === "demo-coolock-ardlea-scouts");
    }
  }
});
