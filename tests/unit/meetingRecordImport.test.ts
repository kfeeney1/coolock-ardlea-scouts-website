import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedMeetingImportFile, parseMeetingDocument } from "../../src/services/meetingRecordImport.ts";

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

test("supports only browser-readable text document formats", () => {
  assert.equal(isSupportedMeetingImportFile("minutes.txt", "text/plain"), true);
  assert.equal(isSupportedMeetingImportFile("minutes.md", ""), true);
  assert.equal(isSupportedMeetingImportFile("minutes.html", "text/html"), true);
  assert.equal(isSupportedMeetingImportFile("minutes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), false);
  assert.equal(isSupportedMeetingImportFile("minutes.pdf", "application/pdf"), false);
});
