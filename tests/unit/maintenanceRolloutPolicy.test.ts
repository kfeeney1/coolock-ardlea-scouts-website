import assert from "node:assert/strict";
import test from "node:test";
import { maintenanceVersion } from "../../src/services/maintenanceRolloutPolicy.ts";
test("Maintenance defaults off, including stale enabled configuration and unsupported revisions", () => {
  for (const value of [undefined, {}, {version: "redesigned"}, {version: "redesigned", sdkRevision: 0}, {version: "redesigned", sdkRevision: 2}, {version: "redesigned", sdkRevision: "1"}, {version: "existing", sdkRevision: 1}]) assert.equal(maintenanceVersion(value), "existing");
  assert.equal(maintenanceVersion({version: "redesigned", sdkRevision: 1}), "redesigned");
});
