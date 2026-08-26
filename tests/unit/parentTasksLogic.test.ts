import assert from "node:assert/strict";
import test from "node:test";

import type { ParentConsentRecord, ParentLinkedMember } from "../../src/services/parentConsent.ts";
import type { ParentEventConsentLink } from "../../src/services/parentEvents.ts";
import { summariseParentTasks } from "../../src/services/parentTasksLogic.ts";

const event = (overrides: Partial<ParentEventConsentLink> = {}): ParentEventConsentLink => ({
    token: "token-1",
    eventId: "event-1",
    title: "Camp",
    description: "",
    eventType: "Camp",
    section: "Cubs",
    location: "",
    meetingPoint: "",
    returnDetails: "",
    startDate: "2099-01-01",
    endDate: "",
    consentRequired: true,
    ...overrides
});

const member = (id: string): ParentLinkedMember => ({
    id,
    displayName: id,
    section: "Cubs",
    dateOfBirth: "2015-01-01"
});

const consent = (memberId: string, updatedByParent: boolean): ParentConsentRecord => ({
    id: `consent-${memberId}`,
    memberId,
    childName: memberId,
    childDOB: "2015-01-01",
    scoutSection: "Cubs",
    consentFrom: "",
    consentTo: "",
    photoConsent: "",
    waterActivities: "",
    canSwim: "",
    seriousIllness: "",
    regularMeds: "",
    medAllergies: "",
    allergies: "",
    dietaryReqs: "",
    vaccinated: "",
    medicalFurtherInfo: "",
    gpName: "",
    gpTel: "",
    gpAddress: "",
    lastCheckup: "",
    parent1Name: "",
    parent2Name: "",
    homePhone: "",
    mobile1: "",
    workPhone: "",
    email: "",
    homeAddress: "",
    altContactName: "",
    altContactPhone: "",
    additionalInfo: "",
    medicationManagement: {},
    updatedByParent,
    parentUpdatedAt: null,
    updatedAt: null
});

test("summariseParentTasks counts required consent and upcoming events", () => {
    const summary = summariseParentTasks(
        [event(), event({ token: "token-2", consentRequired: false })],
        [],
        []
    );

    assert.equal(summary.eventConsentCount, 1);
    assert.equal(summary.upcomingEventCount, 2);
});

test("summariseParentTasks exposes the next event and next consent action in date order", () => {
    const laterConsent = event({ token: "token-2", eventId: "event-2", title: "Later Camp", startDate: "2099-02-01" });
    const nextEvent = event({ token: "token-3", eventId: "event-3", title: "Next Hike", startDate: "2099-01-05", consentRequired: false });
    const firstConsent = event({ token: "token-4", eventId: "event-4", title: "Consent Trip", startDate: "2099-01-10" });

    const summary = summariseParentTasks([laterConsent, nextEvent, firstConsent], [], []);

    assert.equal(summary.nextEvent?.title, "Next Hike");
    assert.equal(summary.nextConsentEvent?.title, "Consent Trip");
});

test("summariseParentTasks flags missing and never-reviewed medical records", () => {
    const summary = summariseParentTasks(
        [],
        [member("one"), member("two"), member("three")],
        [consent("two", false), consent("three", true)]
    );

    assert.equal(summary.medicalAttentionCount, 2);
    assert.equal(summary.totalAttentionCount, 2);
});

test("summariseParentTasks reports no action when parent-reviewed records are current", () => {
    const summary = summariseParentTasks([], [member("one")], [consent("one", true)]);
    assert.deepEqual(summary, {
        eventConsentCount: 0,
        medicalAttentionCount: 0,
        upcomingEventCount: 0,
        totalAttentionCount: 0,
        nextEvent: null,
        nextConsentEvent: null
    });
});
