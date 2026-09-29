import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("representative persisted writes report secondary refresh failures accurately", () => {
  const settings = readFileSync("src/pages/SiteSettings.tsx", "utf8");
  const consent = readFileSync("src/pages/EventConsentManagement.tsx", "utf8");
  const event = readFileSync("src/pages/EventRecordPage.tsx", "utf8");
  const weekly = readFileSync("src/pages/WeeklySectionTracker.tsx", "utf8");

  for (const source of [settings, consent, event, weekly]) {
    assert.match(source, /trySecondaryRefresh/);
    assert.match(source, /saved|Synced|reopened|copied/i);
    assert.match(source, /could not refresh/);
  }
  assert.match(consent, /await updateEventRoster/);
  assert.match(consent, /await markEventConsentResponseMatched/);
  assert.match(weekly, /await auditWeeklyMeeting/);
});
