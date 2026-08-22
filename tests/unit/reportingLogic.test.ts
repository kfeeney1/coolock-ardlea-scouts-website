import assert from "node:assert/strict";
import test from "node:test";

import { csvCell, eventRosterCsv, memberReportCsv, slug } from "../../src/services/reportingLogic.ts";

test("csvCell escapes quotes and neutralises spreadsheet formulas", () => {
    assert.equal(csvCell('Jane "JJ" Doe'), '"Jane ""JJ"" Doe"');
    assert.equal(csvCell("=HYPERLINK(\"bad\")"), '"\'=HYPERLINK(""bad"")"');
    assert.equal(csvCell(" +SUM(A1:A2)"), '"\' +SUM(A1:A2)"');
});

test("memberReportCsv excludes sensitive medical, DOB and emergency columns", () => {
    const csv = memberReportCsv([{
        displayName: "Alex Example",
        section: "Cubs",
        status: "active",
        parentName: "Pat Example",
        emailAddress: "pat@example.com",
        mobileNumber: "0870000000"
    }]);

    assert.match(csv, /Member.*Section.*Status.*Parent \/ Guardian.*Email.*Mobile/);
    assert.doesNotMatch(csv, /Date of birth|Medical|Emergency/i);
    assert.match(csv, /Alex Example/);
});

test("eventRosterCsv contains only operational attendance and consent fields", () => {
    const csv = eventRosterCsv({
        id: "event-1",
        title: "Weekend Camp",
        startDate: "2026-10-02",
        section: "Cubs",
        attendance: { member1: "attending" },
        consent: { member1: "received" },
        consentRequired: true
    }, [{ id: "member1", displayName: "Alex Example", section: "Cubs" }]);

    assert.match(csv, /Attendance.*Consent/);
    assert.match(csv, /Attending.*Received/);
    assert.doesNotMatch(csv, /Phone|Emergency|Medical|Parent/i);
});

test("slug creates safe report filenames", () => {
    assert.equal(slug("Cub Weekend Camp 2026!"), "cub-weekend-camp-2026");
    assert.equal(slug("---"), "report");
});
