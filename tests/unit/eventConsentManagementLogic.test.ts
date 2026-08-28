import assert from "node:assert/strict";
import test from "node:test";

import {
    applyResponseToRoster,
    eligibleEventMembers,
    eventConsentSummary,
    findMatchingMember,
    outstandingConsentMembers
} from "../../src/services/eventConsentManagementLogic.ts";

const event = {
    id: "event-1",
    title: "Camp",
    section: "Cubs",
    consentRequired: true,
    attendance: {
        m1: "invited",
        m2: "not-attending",
        m3: "invited"
    },
    consent: {
        m1: "received",
        m2: "required",
        m3: "required"
    }
} as any;

const members = [
    { id: "m1", displayName: "Alex Scout", section: "Cubs", status: "active", dateOfBirth: "2015-01-01" },
    { id: "m2", displayName: "Sam Scout", section: "Cubs", status: "active", dateOfBirth: "2015-02-02" },
    { id: "m3", displayName: "Jamie Scout", section: "Cubs", status: "active", dateOfBirth: "" },
    { id: "m4", displayName: "Other Scout", section: "Scouts", status: "active", dateOfBirth: "2013-03-03" },
    { id: "m5", displayName: "Inactive Scout", section: "Cubs", status: "inactive", dateOfBirth: "2015-04-04" }
] as any[];

const response = {
    id: "r1",
    childName: "  alex   scout ",
    dateOfBirth: "2015-01-01",
    attendance: "attending",
    consentGiven: true,
    processingStatus: "new",
    medicalDetailsChanged: false
} as any;

test("eligibleEventMembers keeps active members in the event section", () => {
    assert.deepEqual(eligibleEventMembers(event, members).map((member) => member.id), ["m1", "m2", "m3"]);
});

test("findMatchingMember normalises names, respects DOB and avoids reused members", () => {
    assert.equal(findMatchingMember(response, members)?.id, "m1");
    assert.equal(findMatchingMember(response, members, new Set(["m1"])), undefined);
    assert.equal(findMatchingMember({ ...response, dateOfBirth: "2015-09-09" }, members), undefined);
});

test("applyResponseToRoster maps attendance and consent states", () => {
    const attendance: Record<string, any> = {};
    const consent: Record<string, any> = {};

    applyResponseToRoster(response, "m1", attendance, consent);
    assert.equal(attendance.m1, "attending");
    assert.equal(consent.m1, "received");

    applyResponseToRoster({ ...response, attendance: "not-attending", consentGiven: false }, "m2", attendance, consent);
    assert.equal(attendance.m2, "not-attending");
    assert.equal(consent.m2, "not-required");

    applyResponseToRoster({ ...response, consentGiven: false }, "m3", attendance, consent);
    assert.equal(consent.m3, "required");
});

test("outstandingConsentMembers excludes received consent and non-attendees", () => {
    assert.deepEqual(outstandingConsentMembers(event, members).map((member) => member.id), ["m3"]);
});

test("eventConsentSummary separates response states and flags unmatched submissions", () => {
    const responses = [
        response,
        { ...response, id: "r2", childName: "Unknown Child", processingStatus: "new", medicalDetailsChanged: true },
        { ...response, id: "r3", processingStatus: "matched", matchedMemberId: "m1" },
        { ...response, id: "r4", processingStatus: "ignored" }
    ] as any[];

    const summary = eventConsentSummary(event, members, responses);
    assert.equal(summary.eligibleMembers.length, 3);
    assert.equal(summary.newResponses.length, 2);
    assert.equal(summary.matchedResponses.length, 1);
    assert.equal(summary.ignoredResponses.length, 1);
    assert.deepEqual(summary.unmatchedResponses.map((item) => item.id), ["r2"]);
    assert.equal(summary.received, 1);
    assert.equal(summary.outstanding, 1);
    assert.equal(summary.changedDetails, 1);
});
