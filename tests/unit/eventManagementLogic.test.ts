import assert from "node:assert/strict";
import test from "node:test";

import { eventCounts, eventInput, eventMembers, eventRosterCsv, eventRosterFilename, eventRosterPrintHtml, filterEvents } from "../../src/services/eventManagementLogic.ts";

const members = [
    { id: "m1", displayName: "Alex <Scout>", section: "Cubs", status: "active", parentName: "Parent One", mobileNumber: "0871", emergencyContactName: "Emergency One", emergencyContactPhone: "0861" },
    { id: "m2", displayName: "Jamie Scout", section: "Cubs", status: "active", parentName: "Parent Two", mobileNumber: "0872", emergencyContactName: "Emergency Two", emergencyContactPhone: "0862" },
    { id: "m3", displayName: "Inactive Scout", section: "Cubs", status: "inactive", parentName: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "" },
    { id: "m4", displayName: "Scout Member", section: "Scouts", status: "active", parentName: "", mobileNumber: "", emergencyContactName: "", emergencyContactPhone: "" }
] as any;

const event = {
    id: "event-1",
    title: "Cub Camp",
    description: "Weekend outdoors",
    eventType: "Camp",
    section: "Cubs",
    location: "Forest",
    meetingPoint: "Den",
    returnDetails: "17:00",
    leaderNotes: "Bring forms",
    startDate: "2026-10-02",
    endDate: "2026-10-04",
    status: "open",
    consentRequired: true,
    attendance: { m1: "attending", m2: "not-attending" },
    consent: { m1: "received" }
} as any;

test("eventMembers keeps active members in the event section", () => {
    assert.deepEqual(eventMembers(event, members).map((member) => member.id), ["m1", "m2"]);
    assert.deepEqual(eventMembers({ ...event, section: "All Sections" }, members).map((member) => member.id), ["m1", "m2", "m4"]);
});

test("eventCounts applies invited and outstanding defaults", () => {
    assert.deepEqual(eventCounts(event, members), { members: 2, attending: 1, notAttending: 1, invited: 0, consentReceived: 1, consentOutstanding: 1 });
});

test("filterEvents preserves existing section status and search semantics", () => {
    const rows = [event, { ...event, id: "event-2", title: "Scout Hike", section: "Scouts", eventType: "Hike", location: "Howth", status: "draft" }];
    assert.deepEqual(filterEvents(rows as any, "howth", "All Sections", "all").map((row) => row.id), ["event-2"]);
    assert.deepEqual(filterEvents(rows as any, "", "Cubs", "open").map((row) => row.id), ["event-1"]);
});

test("eventInput strips roster data and keeps editable fields", () => {
    const draft = eventInput(event);
    assert.equal(draft.title, "Cub Camp");
    assert.equal(draft.consentRequired, true);
    assert.equal("attendance" in draft, false);
    assert.equal("consent" in draft, false);
});

test("event roster exports preserve operational fields and escape print HTML", () => {
    const csv = eventRosterCsv(event, members);
    assert.match(csv, /Alex <Scout>/);
    assert.match(csv, /Attending/);
    assert.match(csv, /Outstanding/);
    const html = eventRosterPrintHtml(event, members);
    assert.match(html, /Alex &lt;Scout&gt;/);
    assert.doesNotMatch(html, /Alex <Scout>/);
});

test("event roster filename remains stable", () => {
    assert.equal(eventRosterFilename("Cub Weekend Camp 2026!"), "cub-weekend-camp-2026-roster.csv");
    assert.equal(eventRosterFilename("---"), "event-roster.csv");
});
