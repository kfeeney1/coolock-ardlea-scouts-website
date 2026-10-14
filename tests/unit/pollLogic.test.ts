import assert from "node:assert/strict";
import test from "node:test";
import { UserInputError } from "../../src/services/applicationErrors.ts";
import {
  GROUP_POLL_SECTIONS,
  canCreatePollForLeader,
  canManagePollForLeader,
  canRespondToPoll,
  normalizePollOptions,
  normalizePollQuestion,
  pollDeadlinePassed,
  pollManagerScopeSubsets,
  pollDraftFailureMessage,
  pollResults,
  resolvePollSections,
  type PollRecord
} from "../../src/services/pollLogic.ts";

const sectionLeader = { uid: "leader-1", role: "leader", sections: ["Beavers", "Cubs"], scoutingRole: "Section Leader" };
const groupLeader = { uid: "leader-2", role: "leader", sections: ["Cubs"], scoutingRole: "Deputy-Group-Leader" };
const poll: PollRecord = {
  id: "p1", question: "Choose an activity", options: ["Hike", "Camp"], audienceType: "parents",
  scopeType: "sections", scopeSections: ["Beavers", "Cubs"], status: "published", createdBy: "leader-1"
};

test("poll text and answers are normalized and constrained", () => {
  assert.equal(normalizePollQuestion("  Choose an activity?  "), "Choose an activity?");
  assert.equal(normalizePollQuestion("Poll"), "Poll");
  assert.deepEqual(normalizePollOptions([" Hike ", "Camp", "camp"]), ["Hike", "Camp"]);
  assert.throws(() => normalizePollQuestion(" "), /between 1 and 240/);
  assert.throws(() => normalizePollQuestion("x".repeat(241)), /between 1 and 240/);
  assert.throws(() => normalizePollOptions(["One", " one "]), /2 to 8 distinct/);
});

test("poll draft failures give actionable non-diagnostic feedback", () => {
  assert.match(pollDraftFailureMessage(new UserInputError("Choose a question.")), /Choose a question/);
  assert.match(pollDraftFailureMessage({ code: "firestore/permission-denied" }), /permission.*scope/i);
  assert.match(pollDraftFailureMessage({ code: "firestore/unavailable", message: "ERR-98D70E843310" }), /try again/);
  assert.doesNotMatch(pollDraftFailureMessage({ code: "firestore/unavailable", message: "ERR-98D70E843310" }), /UNKNOWN_FAILURE|ERR-/);
});

test("section targeting deduplicates multi-section choices and denies out-of-scope sections", () => {
  assert.deepEqual(resolvePollSections("sections", ["Cubs", "Beavers", "Cubs"], sectionLeader.sections), ["Beavers", "Cubs"]);
  assert.deepEqual(resolvePollSections("group", [], sectionLeader.sections), [...GROUP_POLL_SECTIONS]);
  assert.throws(() => resolvePollSections("sections", ["Scouts"], sectionLeader.sections), /authorised scope/);
});

test("section poll management scopes are enumerated once in canonical order", () => {
  assert.deepEqual(pollManagerScopeSubsets(["Scouts", "Beavers", "Scouts"]), [
    ["Beavers"], ["Scouts"], ["Beavers", "Scouts"]
  ]);
  assert.deepEqual(pollManagerScopeSubsets(["Other"]), []);
});

test("section leaders create and manage only polls wholly inside their scope; group managers can manage group polls", () => {
  assert.equal(canCreatePollForLeader("sections", ["Beavers"], sectionLeader), true);
  assert.equal(canCreatePollForLeader("sections", ["Beavers", "Scouts"], sectionLeader), false);
  assert.equal(canCreatePollForLeader("group", [...GROUP_POLL_SECTIONS], sectionLeader), false);
  assert.equal(canCreatePollForLeader("sections", ["Scouts"], groupLeader), true);
  assert.equal(canManagePollForLeader({ scopeType: "sections", scopeSections: ["Beavers", "Cubs"] }, sectionLeader), true);
  assert.equal(canManagePollForLeader({ scopeType: "sections", scopeSections: ["Beavers", "Scouts"] }, sectionLeader), false);
  assert.equal(canManagePollForLeader({ scopeType: "group", scopeSections: [...GROUP_POLL_SECTIONS] }, groupLeader), true);
});

test("leader and parent eligibility includes multiple linked sections once and excludes unrelated scope", () => {
  assert.equal(canRespondToPoll(poll, { kind: "parent", approved: true, memberSections: ["Cubs", "Scouts"] }), true);
  assert.equal(canRespondToPoll(poll, { kind: "parent", approved: false, memberSections: ["Cubs"] }), false);
  assert.equal(canRespondToPoll(poll, { kind: "parent", approved: true, memberSections: ["Scouts"] }), false);
  assert.equal(canRespondToPoll({ ...poll, audienceType: "leaders" }, { kind: "leader", sections: ["Cubs", "Beavers"] }), true);
  assert.equal(canRespondToPoll({ ...poll, audienceType: "leaders" }, { kind: "leader", sections: ["Rovers"] }), false);
});

test("optional close time rejects new or changed responses at and after the deadline", () => {
  const closesAt = new Date("2026-10-08T12:00:00.000Z");
  assert.equal(pollDeadlinePassed(closesAt, closesAt.getTime()), true);
  assert.equal(canRespondToPoll({ ...poll, closesAt }, { kind: "parent", approved: true, memberSections: ["Beavers"] }, closesAt.getTime()), false);
  assert.equal(canRespondToPoll({ ...poll, status: "closed" }, { kind: "parent", approved: true, memberSections: ["Beavers"] }), false);
});

test("results count aggregate inputs without exposing respondent records", () => {
  assert.deepEqual(pollResults(["Hike", "Camp"], [{ option: "Hike" }, { option: "Hike" }, { option: "Camp" }, { option: "invalid" }]), [
    { option: "Hike", count: 2 }, { option: "Camp", count: 1 }
  ]);
});
