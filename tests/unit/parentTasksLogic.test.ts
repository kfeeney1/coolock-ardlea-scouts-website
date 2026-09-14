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

const consent = (memberId: string, updatedByParent: boolean, overrides: Partial<ParentConsentRecord> = {}): ParentConsentRecord => ({
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
    submittedAt: updatedByParent ? new Date("2026-01-01T12:00:00Z") : null,
    parentUpdatedAt: null,
    updatedAt: null,
    ...overrides
});

const asOf = new Date("2026-09-14T12:00:00Z");

test("summariseParentTasks counts required consent and upcoming events", () => {
    const summary = summariseParentTasks(
        [event(), event({ token: "token-2", consentRequired: false })],
        [],
        [],
        asOf
    );
    assert.equal(summary.eventConsentCount, 1);
    assert.equal(summary.upcomingEventCount, 2);
});

test("summariseParentTasks exposes the next event and next consent action in date order", () => {
    const laterConsent = event({ token: "token-2", eventId: "event-2", title: "Later Camp", startDate: "2099-02-01" });
    const nextEvent = event({ token: "token-3", eventId: "event-3", title: "Next Hike", startDate: "2099-01-05", consentRequired: false });
    const firstConsent = event({ token: "token-4", eventId: "event-4", title: "Consent Trip", startDate: "2099-01-10" });
    const summary = summariseParentTasks([laterConsent, nextEvent, firstConsent], [], [], asOf);
    assert.equal(summary.nextEvent?.title, "Next Hike");
    assert.equal(summary.nextConsentEvent?.title, "Consent Trip");
});

test("summariseParentTasks flags missing and undated legacy medical records", () => {
    const summary = summariseParentTasks(
        [],
        [member("one"), member("two"), member("three")],
        [consent("two", false), consent("three", true, { submittedAt: null })],
        asOf
    );
    assert.equal(summary.medicalAttentionCount, 3);
    assert.equal(summary.totalAttentionCount, 3);
});

test("summariseParentTasks reports no action when dated records are current", () => {
    const summary = summariseParentTasks([], [member("one")], [consent("one", true)], asOf);
    assert.deepEqual(summary, {
        eventConsentCount: 0,
        medicalAttentionCount: 0,
        upcomingEventCount: 0,
        totalAttentionCount: 0,
        nextEvent: null,
        nextConsentEvent: null
    });
});

test("summariseParentTasks flags a consent form after its annual validity period", () => {
    const summary = summariseParentTasks(
        [],
        [member("one")],
        [consent("one", true, { submittedAt: new Date("2025-09-12T12:00:00Z") })],
        asOf
    );
    assert.equal(summary.medicalAttentionCount, 1);
});
