import assert from "node:assert/strict";
import test from "node:test";

import {
    attendanceTrendCsv,
    buildReportingInsights,
    csvCell,
    eventOverviewCsv,
    eventReportMembers,
    eventRosterCsv,
    filterEventsByDateRange,
    memberReportCsv,
    membershipSummaryCsv,
    outstandingConsentCsv,
    slug
} from "../../src/services/reportingLogic.ts";

const members = [
    { id: "member1", displayName: "Alex Example", section: "Cubs", status: "active", parentName: "Pat Example", emailAddress: "pat@example.com", mobileNumber: "0870000000" },
    { id: "member2", displayName: "Jamie Example", section: "Cubs", status: "inactive", parentName: "", emailAddress: "", mobileNumber: "" },
    { id: "member3", displayName: "Sam Example", section: "Scouts", status: "active", parentName: "", emailAddress: "", mobileNumber: "" }
];

const event = {
    id: "event-1",
    title: "Weekend Camp",
    startDate: "2026-10-02",
    section: "Cubs",
    status: "open",
    attendance: { member1: "attending", member2: "not-attending" },
    consent: { member1: "received" },
    consentRequired: true
};

const eventMembers = [
    { id: "member1", displayName: "Alex Example", section: "Cubs" },
    { id: "member2", displayName: "Jamie Example", section: "Cubs" },
    { id: "member4", displayName: "Taylor Example", section: "Cubs" }
];

test("buildReportingInsights summarises recorded responses without treating missing attendance as absent", () => {
    const insights = buildReportingInsights(members, [
        event,
        { ...event, id: "event-2", section: "Scouts", attendance: {}, consent: {} }
    ]);
    assert.equal(insights.activeMembers, 2);
    assert.equal(insights.inactiveMembers, 1);
    assert.deepEqual(insights.activeBySection, [{ section: "Cubs", count: 1 }, { section: "Scouts", count: 1 }]);
    assert.equal(insights.recordedResponses, 2);
    assert.equal(insights.attendanceRate, 50);
    assert.equal(insights.eventsWithAttendance, 1);
    assert.equal(insights.eventsWithoutAttendance, 1);
    assert.equal(insights.consentRequiredEvents, 2);
    assert.equal(insights.consentReceived, 1);
    assert.equal(insights.consentEventsWithoutReceived, 1);
});

test("buildReportingInsights returns no attendance rate when there are no recorded responses", () => {
    const insights = buildReportingInsights(members, [{ ...event, attendance: {}, consentRequired: false, consent: {} }]);
    assert.equal(insights.recordedResponses, 0);
    assert.equal(insights.attendanceRate, null);
    assert.equal(insights.eventsWithoutAttendance, 1);
});

test("csvCell escapes quotes and neutralises spreadsheet formulas", () => {
    assert.equal(csvCell('Jane "JJ" Doe'), '"Jane ""JJ"" Doe"');
    assert.equal(csvCell("=HYPERLINK(\"bad\")"), '"\'=HYPERLINK(""bad"")"');
    assert.equal(csvCell(" +SUM(A1:A2)"), '"\' +SUM(A1:A2)"');
});

test("filterEventsByDateRange applies inclusive start and end dates", () => {
    const rows = [event, { ...event, id: "event-2", title: "Earlier", startDate: "2026-09-01" }, { ...event, id: "event-3", title: "Later", startDate: "2026-11-01" }];
    assert.deepEqual(filterEventsByDateRange(rows, "2026-09-01", "2026-10-02").map((row) => row.id), ["event-1", "event-2"]);
    assert.deepEqual(filterEventsByDateRange(rows, "2026-10-02", "2026-10-02").map((row) => row.id), ["event-1"]);
});

test("eventReportMembers reuses active members from the loaded report snapshot", () => {
    assert.deepEqual(eventReportMembers(event, members), [eventMembers[0]]);
    assert.deepEqual(eventReportMembers({ ...event, section: "All Sections" }, members).map((member) => member.id), ["member1", "member3"]);
});

test("memberReportCsv excludes sensitive medical, DOB and emergency columns", () => {
    const csv = memberReportCsv([members[0]]);
    assert.match(csv, /Member.*Section.*Status.*Parent \/ Guardian.*Email.*Mobile/);
    assert.doesNotMatch(csv, /Date of birth|Medical|Emergency/i);
    assert.match(csv, /Alex Example/);
});

test("membershipSummaryCsv groups status totals by section and adds an overall row", () => {
    const csv = membershipSummaryCsv(members);
    assert.match(csv, /Section.*Active.*Inactive.*Left.*Total/);
    assert.match(csv, /Cubs.*1.*1.*0.*2/);
    assert.match(csv, /Scouts.*1.*0.*0.*1/);
    assert.match(csv, /All permitted sections.*2.*1.*0.*3/);
    assert.doesNotMatch(csv, /Email|Mobile|Parent|Medical/i);
});

test("eventRosterCsv keeps consent status operationally consistent with attendance", () => {
    const csv = eventRosterCsv(event, eventMembers);
    assert.match(csv, /Attendance.*Consent/);
    assert.match(csv, /Weekend Camp.*02-10-2026.*Alex Example.*Attending.*Received/);
    assert.match(csv, /Weekend Camp.*02-10-2026.*Jamie Example.*Not attending.*Not required/);
    assert.match(csv, /Weekend Camp.*02-10-2026.*Taylor Example.*Invited.*Outstanding/);
    assert.doesNotMatch(csv, /2026-10-02/);
    assert.doesNotMatch(csv, /Phone|Emergency|Medical|Parent/i);
});

test("eventOverviewCsv summarises event attendance and received consent counts", () => {
    const csv = eventOverviewCsv([event]);
    assert.match(csv, /Status.*Consent required.*Attending.*Not attending.*Consent received/);
    assert.match(csv, /Weekend Camp.*02-10-2026.*open.*Yes.*1.*1.*1/);
    assert.doesNotMatch(csv, /2026-10-02/);
    assert.doesNotMatch(csv, /Member|Phone|Medical/i);
});

test("attendanceTrendCsv calculates rate from recorded responses only", () => {
    const csv = attendanceTrendCsv([event, { ...event, id: "event-2", title: "No Responses", attendance: {} }]);
    assert.match(csv, /Recorded responses.*Attending.*Not attending.*Attendance rate/);
    assert.match(csv, /Weekend Camp.*02-10-2026.*2.*1.*1.*50%/);
    assert.match(csv, /No Responses.*02-10-2026.*0.*0.*0/);
    assert.doesNotMatch(csv, /2026-10-02/);
});

test("outstandingConsentCsv excludes received consent and members who are not attending", () => {
    const csv = outstandingConsentCsv(event, eventMembers);
    assert.doesNotMatch(csv, /Alex Example/);
    assert.doesNotMatch(csv, /Jamie Example/);
    assert.match(csv, /Weekend Camp.*02-10-2026.*Taylor Example.*Invited.*Outstanding/);
    assert.doesNotMatch(csv, /2026-10-02/);
});

test("slug creates safe report filenames", () => {
    assert.equal(slug("Cub Weekend Camp 2026!"), "cub-weekend-camp-2026");
    assert.equal(slug("---"), "report");
});
