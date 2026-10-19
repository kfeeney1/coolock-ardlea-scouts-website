import assert from "node:assert/strict";
import test from "node:test";
import { createScheduleScrollIntent } from "../../src/services/scheduleScrollIntent.ts";

test("explicit navigation rejects queued gesture and programmatic scroll feedback", () => {
  const intent = createScheduleScrollIntent();
  assert.equal(intent.ticket(), null);
  intent.beginGesture();
  const queued = intent.ticket();
  assert.equal(intent.accepts(queued), true);
  intent.command();
  assert.equal(intent.accepts(queued), false);
  assert.equal(intent.ticket(), null);
  // An old callback must stay obsolete even after a different gesture starts.
  intent.beginGesture();
  assert.equal(intent.accepts(queued), false);
  assert.equal(intent.accepts(intent.ticket()), true);
});
