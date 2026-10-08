import assert from "node:assert/strict";
import test from "node:test";

import { buildEventAudience, defaultEventAudienceForClassification, eventAudienceSummary, eventCounts, eventInput, eventMembers, eventRosterCsv, eventRosterFilename, eventRosterPrintHtml, filterEvents, isDuplicateEventIdentity, normaliseEventTitle, resolveEventAudience } from "../../src/services/eventManagementLogic.ts";
import { buildEventAudienceMemberships, chunkEventAudienceMemberships, withPersistedEventAudience } from "../../src/services/eventAudienceMemberships.ts";

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

test("copying an event input preserves its exact audience snapshot", () => {
    const source = { ...event, audience: { version: 3, mode: "members", semantics: "snapshot", sectionIds: [], memberIds: ["m1"], resolvedMemberIds: ["m1"] } };
    assert.deepEqual(eventInput(source as any).audience, source.audience);
});

test("event identity is stable-ID based and does not reject same-date records", () => {
    assert.equal(normaliseEventTitle("  CUB   Camp "), "cub camp");
    assert.equal(isDuplicateEventIdentity({ title: " cub camp ", startDate: "2026-10-02", section: "Cubs" }, [event]), false);
    assert.equal(isDuplicateEventIdentity({ title: "Cub Camp", startDate: "2026-10-03", section: "Cubs" }, [event]), false);
});

test("same-date same-title events remain independent records", () => {
    const another = { ...event, id: "event-2" };
    assert.equal(isDuplicateEventIdentity(eventInput(event), [event, another], "event-1"), false);
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


test("resolveEventAudience uses selected members when present and excludes inactive members", () => {
    assert.deepEqual(resolveEventAudience(["Cubs"], ["m1", "m4", "m3"], members), ["m1", "m2", "m4"]);
    assert.deepEqual(resolveEventAudience(["Cubs"], [], members), ["m1", "m2"]);
});

test("eventMembers uses the persisted resolved audience for new events and preserves historical invitees", () => {
    const targeted = { ...event, audience: { version: 2, mode: "members", semantics: "snapshot", sectionIds: [], memberIds: ["m4"], resolvedMemberIds: ["m4"] } };
    assert.deepEqual(eventMembers(targeted as any, members).map((member) => member.id), ["m4"]);
});


test("buildEventAudience distinguishes section, selected-member and mixed snapshots", () => {
    assert.deepEqual(buildEventAudience(["Cubs"], [], members), {
        version: 3, mode: "sections", semantics: "snapshot", sectionIds: ["Cubs"], memberIds: [], resolvedMemberIds: ["m1", "m2"]
    });
    assert.deepEqual(buildEventAudience([], ["m4"], members), {
        version: 3, mode: "members", semantics: "snapshot", sectionIds: [], memberIds: ["m4"], resolvedMemberIds: ["m4"]
    });
    assert.deepEqual(buildEventAudience(["Cubs"], ["m4"], members), {
        version: 3, mode: "mixed", semantics: "snapshot", sectionIds: ["Cubs"], memberIds: ["m4"], resolvedMemberIds: ["m1", "m2", "m4"]
    });
});

test("default audience is captured from the original event classification and group scope", () => {
    assert.deepEqual(defaultEventAudienceForClassification("Cubs", members).sectionIds, ["Cubs"]);
    assert.deepEqual(defaultEventAudienceForClassification("All Sections", members).resolvedMemberIds, ["m1", "m2", "m4"]);
    assert.deepEqual(defaultEventAudienceForClassification("Group", members).resolvedMemberIds, ["m1", "m2", "m4"]);
});

test("selected-member audience ignores the event classification and persists no unauthorised roster IDs", () => {
    const selected = buildEventAudience([], ["m4", "m4", "m3", "unknown"], members);
    assert.deepEqual(selected.resolvedMemberIds, ["m4"]);
    assert.equal(selected.mode, "members");
    assert.deepEqual(withPersistedEventAudience(selected), {
        version: 3, mode: "members", semantics: "snapshot", sectionIds: [], memberIds: [], resolvedMemberIds: []
    });
    assert.equal(buildEventAudience([], [], members, "members").mode, "members");
});

test("audience membership records de-duplicate multi-section members and retain selection source", () => {
    const multiSection = { ...members[0], sections: ["Cubs", "Scouts"] };
    const audience = buildEventAudience(["Cubs", "Scouts"], ["m1", "m4"], [multiSection, members[1], members[3]]);
    const memberships = buildEventAudienceMemberships("event-1", "Cubs", audience, [multiSection, members[1], members[3]]);
    assert.deepEqual(memberships.map((item) => item.memberId), ["m1", "m2", "m4"]);
    assert.deepEqual(memberships[0], {
        eventId: "event-1", eventSection: "Cubs", memberId: "m1", scopeSection: "Cubs",
        selectedBySection: true, selectedIndividually: true
    });
    const selectedMember = buildEventAudience([], ["m1"], [multiSection], "members");
    assert.equal(buildEventAudienceMemberships("event-2", "Scouts", selectedMember, [multiSection], ["Scouts"])[0].scopeSection, "Scouts");
});

test("event audience summary explains the persisted audience without reopening the selector", () => {
    assert.equal(eventAudienceSummary(["Cubs"], [], 2), "Audience: Cubs — 2 members");
    assert.equal(eventAudienceSummary([], ["m4"], 1), "Audience: 1 selected member");
    assert.match(eventAudienceSummary(["Cubs"], ["m4"], 3), /3 members/);
});


test("event audience membership writes are split below Firestore rules access-call limits", () => {
    const memberships = Array.from({ length: 35 }, (_, index) => ({ memberId: `m${index + 1}` }));
    const chunks = chunkEventAudienceMemberships(memberships);
    assert.deepEqual(chunks.map((chunk) => chunk.length), [16, 16, 3]);
    assert.deepEqual(chunks.flat(), memberships);
    assert.ok(chunks.every((chunk) => chunk.length <= 16));
    assert.throws(() => chunkEventAudienceMemberships(memberships, 0), /positive integer/);
});
