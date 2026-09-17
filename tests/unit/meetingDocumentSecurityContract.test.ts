import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const firestore = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const storage = readFileSync(new URL("../../storage.rules", import.meta.url), "utf8");

test("meeting attachment metadata is bound to its meeting and controlled MIME types", () => {
  assert.match(firestore, /attachments\/meeting-documents\/.*meetingId/);
  assert.match(firestore, /attachment\.contentType in \[/);
  assert.match(firestore, /attachment\.size > 0/);
});

test("meeting document storage remains authenticated and section scoped", () => {
  assert.match(storage, /match \/attachments\/meeting-documents\/\{section\}\/\{meetingId\}/);
  assert.match(storage, /validMeetingDocumentWrite\(section, meetingId\)/);
  assert.match(storage, /request\.resource\.metadata\.ownerId == meetingId/);
  assert.doesNotMatch(storage, /meeting-documents[\s\S]{0,300}allow get: if true/);
});
