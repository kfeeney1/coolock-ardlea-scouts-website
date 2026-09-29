import assert from "node:assert/strict";
import test from "node:test";
import {
  equipmentIncidentActionUrl,
  joinApplicationActionUrl,
  leaderRequestActionUrl,
  parentAccessActionUrl
} from "../src/emailActionLinks.js";

test("equipment issue email points to the exact issue and equipment record", () => {
  assert.equal(
    equipmentIncidentActionUrl("https://coolockardleascouts.ie/", "issue/1", "tent item"),
    "https://coolockardleascouts.ie/leader/equipment/tent%20item?issue=issue%2F1"
  );
});

test("an issue without a surviving item link retains the issue target on the safe equipment fallback", () => {
  assert.equal(
    equipmentIncidentActionUrl("https://coolockardleascouts.ie", "issue-1", ""),
    "https://coolockardleascouts.ie/leader/equipment?issue=issue-1"
  );
});

test("Join Us email points to the application record", () => {
  assert.equal(
    joinApplicationActionUrl("https://coolockardleascouts.ie/", "application/1"),
    "https://coolockardleascouts.ie/leader/join/application%2F1"
  );
});

test("access request email actions point to the matching request records", () => {
  assert.equal(
    leaderRequestActionUrl("https://coolockardleascouts.ie/", "leader uid"),
    "https://coolockardleascouts.ie/leader/requests?request=leader%20uid"
  );
  assert.equal(
    parentAccessActionUrl("https://coolockardleascouts.ie/", "parent uid"),
    "https://coolockardleascouts.ie/leader/parent-access?parent=parent%20uid"
  );
});
