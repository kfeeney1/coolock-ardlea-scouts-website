import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleRecordActions, eventCopyInput } from "../../src/services/scheduleRecordActions.ts";
import type { EventRecord } from "../../src/services/eventAdmin.ts";

test("schedule actions never expose direct historical editing or unauthorised mutation", () => {
  assert.deepEqual(scheduleRecordActions("2026-10-20", true, true, "2026-10-18"), { edit: true, copy: true });
  assert.deepEqual(scheduleRecordActions("2026-10-17", true, true, "2026-10-18"), { edit: false, copy: true });
  assert.deepEqual(scheduleRecordActions("2026-10-20", false, true, "2026-10-18"), { edit: false, copy: true });
  assert.deepEqual(scheduleRecordActions("2026-10-20", true, false, "2026-10-18"), { edit: false, copy: false });
});
test("event copy uses only canonical creation fields, a new date and draft lifecycle", () => {
  const source = { id: "source", title: "Camp", status: "completed", startDate: "2026-01-01", endDate: "2026-01-02", attendance: { child: "attending" }, consent: { child: "received" }, consentLinkToken: "old-token", audience: null } as unknown as EventRecord;
  const before = JSON.stringify(source);
  const copy = eventCopyInput(source, "2026-11-01", "2026-11-02");
  assert.equal(copy.status, "draft"); assert.equal(copy.startDate, "2026-11-01");
  for (const key of ["id", "attendance", "consent", "consentLinkToken", "createdAt", "updatedAt"]) assert.equal(key in copy, false);
  assert.deepEqual(copy.audience?.memberIds, ["child"]);
  assert.equal(JSON.stringify(source), before);
});
