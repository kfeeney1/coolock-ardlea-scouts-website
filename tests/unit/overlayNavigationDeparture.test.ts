import assert from "node:assert/strict";
import test from "node:test";
import { overlayNavigationLeavesSurface } from "../../src/services/backDismissHistory.ts";

test("record query PUSH cancels transient cleanup before the destination renders", () => {
  assert.equal(overlayNavigationLeavesSurface("/leader/weekly", "/leader/weekly?meeting=record-1", "push"), true);
  assert.equal(overlayNavigationLeavesSurface("/leader/weekly?meeting=record-1", "/leader/weekly?meeting=record-2", "push"), true);
});
test("filter REPLACE and same-route overlay markers keep their cleanup", () => {
  assert.equal(overlayNavigationLeavesSurface("/leader/weekly", "/leader/weekly?section=Cubs", "replace"), false);
  assert.equal(overlayNavigationLeavesSurface("/leader/weekly", "/leader/weekly", "push"), false);
  assert.equal(overlayNavigationLeavesSurface("/leader/weekly", "/leader/weekly", "traverse"), false);
});
test("a different page cancels cleanup for every navigation type", () => {
  for (const type of ["push", "replace", "traverse", undefined]) {
    assert.equal(overlayNavigationLeavesSurface("/leader/weekly", "/leader/events", type), true);
  }
});
