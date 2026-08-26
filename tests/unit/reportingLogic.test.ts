import assert from "node:assert/strict";
import test from "node:test";

import {
    csvCell,
    eventOverviewCsv,
    eventRosterCsv,
    memberReportCsv,
    membershipSummaryCsv,
    outstandingConsentCsv,
    slug
} from "../../src/services/reportingLogic.ts";

const members = [
    { displayName: "Alex Example", section: "Cubs", status: "active", parentName: "Pat Example", emailAddress: "pat@example.com", mobileNumber: "0870000000" },
    { displayName: "Jamie Example", section: "Cubs", status: "inactive", parentName: "", emailAddress: "", mobileNumber: "" },
    { displayName: "Sam Example", section: "Scouts", status: "active", parentName: "", emailAddress: "", mobileNumber: "" }
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
    { id: "member2", displayName: "Jamie Example", section: "Cubs" }
];

test("csvCell escapes quotes and neutralises spreadsheet formulas", () => {
    assert.equal(csvCell('Jane "JJ" Doe'), '"Jane ""JJ"" Doe"');
    assert.equal(csvCell("=HYPERLINK(\"bad\")"), '"\'=HYPERLINK(""bad"")"');
    assert.equal(csvCell(" +SUM(A1:A2)"), '"\' +SUM(A1:A2)"');
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

test("eventRosterCsv contains only operational attendance and consent fields", () => {
    const csv = eventRosterCsv(event, [eventMembers[0]]);
    assert.match(csv, /Attendance.*Consent/);
    assert.match(csv, /Attending.*Received/);
    assert.doesNotMatch(csv, /Phone|Emergency|Medical|Parent/i);
});

test("eventOverviewCsv summarises event attendance and received consent counts", () => {
    const csv = eventOverviewCsv([event]);
    assert.match(csv, /Status.*Consent required.*Attending.*Not attending.*Consent received/);
    assert.match(csv, /Weekend Camp.*open.*Yes.*1.*1.*1/);
    assert.doesNotMatch(csv, /Member|Phone|Medical/i);
});

test("outstandingConsentCsv contains only members without received consent", () => {
    const csv = outstandingConsentCsv(event, eventMembers);
    assert.doesNotMatch(csv, /Alex Example/);
    assert.match(csv, /Jamie Example/);
    assert.match(csv, /Not attending.*Outstanding/);
});

test("slug creates safe report filenames", () => {
    assert.equal(slug("Cub Weekend Camp 2026!"), "cub-weekend-camp-2026");
    assert.equal(slug("---"), "report");
});
