import assert from "node:assert/strict";
import test from "node:test";
import { extractMeetingCandidates, isSupportedMeetingImportFile, parseMeetingDocument } from "../../src/services/meetingRecordImport.ts";

test("parses a structured section meeting document into an editable draft", () => {
  const draft = parseMeetingDocument(`
Title: TEST Imported Cubs Planning Meeting
Meeting Type: Leader / Section Meeting
Section: Cubs
Date: 05/09/2026 19:30
Attendees:
- Alex Leader
- Jamie Scouter
Minutes:
Reviewed the September programme and den rota.
Agreed to keep the first meeting outdoors if weather allows.
Decisions:
Use the den as the wet-weather fallback.
Action Items:
Alex to confirm keys.
Jamie to bring programme equipment.
`);

  assert.equal(draft.title, "TEST Imported Cubs Planning Meeting");
  assert.equal(draft.meetingType, "leader");
  assert.equal(draft.section, "Cubs");
  assert.equal(draft.meetingDate, "2026-09-05T19:30");
  assert.deepEqual(draft.attendees, ["Alex Leader", "Jamie Scouter"]);
  assert.match(draft.notes, /September programme/);
  assert.equal(draft.decisions, "Use the den as the wet-weather fallback.");
  assert.match(draft.actions, /Alex to confirm keys/);
  assert.deepEqual(draft.warnings, []);
});

test("recognises Group Council and Group Leaders meeting labels", () => {
  assert.equal(parseMeetingDocument("Title: Council\nMeeting Type: Group Council Meeting\nDate: 2026-09-05\nAttendees: A, B").meetingType, "group");
  assert.equal(parseMeetingDocument("Title: Leaders\nMeeting Type: Group Leaders Meeting\nDate: 2026-09-05\nAttendees: A, B").meetingType, "group-leaders");
});

test("returns review warnings instead of inventing required values", () => {
  const draft = parseMeetingDocument("Minutes: Discussion only");
  assert.equal(draft.title, "");
  assert.equal(draft.meetingDate, "");
  assert.deepEqual(draft.attendees, []);
  assert.ok(draft.warnings.some((warning) => warning.includes("title")));
  assert.ok(draft.warnings.some((warning) => warning.includes("date")));
  assert.ok(draft.warnings.some((warning) => warning.includes("attendees")));
});

test("imports only browser-readable text formats while binary documents remain attachments", () => {
  assert.equal(isSupportedMeetingImportFile("minutes.txt", "text/plain"), true);
  assert.equal(isSupportedMeetingImportFile("minutes.md", ""), true);
  assert.equal(isSupportedMeetingImportFile("minutes.html", "text/html"), true);
  assert.equal(isSupportedMeetingImportFile("minutes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), false);
  assert.equal(isSupportedMeetingImportFile("minutes.pdf", "application/pdf"), false);
});


test("extracts reviewable candidates without applying them to meeting state", () => {
  const result = extractMeetingCandidates("Title: Candidate Meeting\nSection: Cubs\nDate: 20/09/2026 19:30\nAttendees: Alex, Sam\nMinutes: Review only");
  assert.equal(result.candidates.find((candidate) => candidate.key === "title")?.proposed, "Candidate Meeting");
  assert.equal(result.candidates.find((candidate) => candidate.key === "section")?.proposed, "Cubs");
  assert.equal(result.candidates.find((candidate) => candidate.key === "meetingDate")?.proposed, "2026-09-20T19:30");
});

test("ambiguous meeting-date headings are not confidently mapped", () => {
  const draft = parseMeetingDocument("Title: Dates\nDate: 05/09/2026 and 06/09/2026\nSection: Cubs\nAttendees: Alex");
  assert.equal(draft.meetingDate, "");
  assert.ok(draft.warnings.some((warning) => /Several dates/.test(warning)));
});

test("untrusted HTML is reduced to text rather than returned as executable markup", () => {
  const draft = parseMeetingDocument("<script>alert(1)</script><p>Title: Safe title</p><p>Section: Scouts</p><p>Date: 20/09/2026</p><p>Attendees: Alex</p>");
  assert.match(draft.title, /Safe title/);\n  assert.doesNotMatch(JSON.stringify(draft), /<script/i);
});
