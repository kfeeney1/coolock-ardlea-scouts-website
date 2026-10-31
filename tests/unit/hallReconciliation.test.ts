import test from "node:test";
import assert from "node:assert/strict";
import {auditHallReservations, validateHallAuditOptions} from "../../scripts/hall-reconciliation.mjs";
import {hallAuditEnvironment} from "../../scripts/audit-hall-reservations.mjs";
import {occupiedHallDays} from "../../email-worker/src/hallBookingModel.js";
import {hallSourceIdentity} from "../../email-worker/src/hallSourceReservation.js";
import {hallInstant} from "../../src/services/hallBookingTime.ts";
const from = "2026-10-24", through = "2026-11-07", options = {from, through};
const booking = (id = "one", interval = {date: "2026-10-25", startTime: "18:00", endDate: "2026-10-25", endTime: "19:00"}) => ({id, resourceId: "group-hall", kind: "internal", state: "confirmed", revision: 1, interval});
function fixture() {
  return {collections: new Map<string, Map<string, any>>(), versions: new Map<string, string>(), evidence: new Map<string, any>(), truncated: [] as string[]};
}
function records(snapshot: ReturnType<typeof fixture>, collection: string) {
  let value = snapshot.collections.get(collection); if (!value) {value = new Map(); snapshot.collections.set(collection, value);} return value;
}
function add(snapshot: ReturnType<typeof fixture>, value: any) {
  records(snapshot, "hall/group/bookings").set(value.id, value);
  snapshot.evidence.set(value.id, {history: {next: structuredClone(value), actorUid: "actor", at: "2026-10-24T12:00:00.000Z"}, audit: {targetId: value.id, action: "hall-booking-save", actorUid: "actor"}});
  for (const [date, slots] of occupiedHallDays(value)) {
    const days = records(snapshot, "hall/group/days"), publicDays = records(snapshot, "hallAvailability");
    const previous = days.get(date)?.reservations ?? [];
    const reservations = [...previous, ...slots.map(slot => ({bookingId: value.id, ...slot}))].sort((a, b) => a.start - b.start);
    days.set(date, {reservations});
    const start = hallInstant(date, "00:00"), end = hallInstant(date, "23:59") + 60_000;
    publicDays.set(date, {occupied: reservations.map(slot => ({start: new Date(Math.max(start, slot.start)).toISOString(), end: new Date(Math.min(end, slot.end)).toISOString()}))});
  }
}
const codes = async (snapshot: ReturnType<typeof fixture>, extra = {}) => (await auditHallReservations(snapshot, {...options, ...extra})).issues.map((issue: any) => issue.code);
test("bounded recurrence, exceptions and Dublin DST indexes reconcile without mutation or activation approval", async () => {
  const db = fixture();
  add(db, {...booking(), interval: {date: "2026-10-24", startTime: "23:00", endDate: "2026-10-25", endTime: "03:00"}, recurrence: {frequency: "weekly", until: "2026-11-07"}, exceptions: [{date: "2026-10-31", action: "cancel"}]});
  const before = structuredClone(db), report = await auditHallReservations(db, options);
  assert.deepEqual(report.issues, []); assert.equal(report.consistent, true); assert.equal(report.activationApproved, false); assert.deepEqual(db, before);
  const slot = records(db, "hallAvailability").get("2026-10-25").occupied[0]; assert.equal(Date.parse(slot.end) - Date.parse(slot.start), 4 * 60 * 60_000);
});
test("source identity, schedule, duplicates and missing/orphaned reservation ownership are diagnosed", async () => {
  const db = fixture(), {bookingId} = await hallSourceIdentity("meeting", "meeting-001");
  const source = {meetingDate: "2026-10-25", status: "open", hallResource: "group-hall", hallRevision: 1, hallStartTime: "18:00", hallEndTime: "19:00", notes: "PRIVATE programme"};
  records(db, "weeklyMeetings").set("meeting-001", source);
  assert.ok((await codes(db)).includes("missing-source-reservation"));
  const value = {...booking(bookingId), source: {collection: "weeklyMeetings", id: "meeting-001"}}; add(db, value); assert.deepEqual(await codes(db), []);
  source.hallEndTime = "20:00"; assert.ok((await codes(db)).includes("source-schedule-mismatch")); source.hallEndTime = "19:00";
  add(db, {...value, id: "duplicate"}); const duplicate = await codes(db); assert.ok(duplicate.includes("noncanonical-source-id")); assert.ok(duplicate.includes("duplicate-source-reservations"));
  records(db, "weeklyMeetings").delete("meeting-001"); assert.ok((await codes(db)).includes("orphaned-source"));
});
test("legacy classification requires an explicit current source version and never infers hall use", async () => {
  const db = fixture(), path = "events/legacy";
  records(db, "events").set("legacy", {startDate: "2026-10-25", endDate: "2026-10-26", status: "open", location: "Group hall", title: "PRIVATE"}); db.versions.set(path, "100:20");
  assert.ok((await codes(db)).includes("unconfirmed-source-use"));
  const decision = {path, version: "100:20", resource: "none"}; assert.deepEqual(await codes(db, {decisions: [decision]}), []);
  assert.ok((await codes(db, {decisions: [{...decision, version: "100:19"}]})).includes("stale-decision"));
  assert.ok((await codes(db, {decisions: [{...decision, resource: "group-hall"}]})).includes("confirmed-hall-needs-reservation"));
  assert.ok((await codes(db, {decisions: [{...decision, path: "events/missing"}]})).includes("orphaned-decision"));
  const report = await auditHallReservations(db, options); assert.equal(JSON.stringify(report).includes("PRIVATE"), false); assert.equal(JSON.stringify(report).includes("Group hall"), false);
});
test("active overlap fails, half-open adjacency succeeds and cancellation must remove old indexes", async () => {
  const db = fixture(); add(db, booking()); add(db, booking("adjacent", {date: "2026-10-25", startTime: "19:00", endDate: "2026-10-25", endTime: "20:00"})); assert.deepEqual(await codes(db), []);
  add(db, booking("overlap")); assert.ok((await codes(db)).includes("overlapping-bookings"));
  const second = fixture(); add(second, booking()); records(second, "hall/group/bookings").get("one").state = "cancelled";
  const failures = await codes(second); for (const code of ["day-index-mismatch", "public-availability-mismatch", "history-head-mismatch"]) assert.ok(failures.includes(code));
});
test("missing, extra, malformed and privacy-leaking indexes/projections never produce a clean report", async () => {
  for (const change of ["missing-day", "extra-day", "missing-public", "private-field", "private-slot", "malformed-index"]) {
    const db = fixture(); add(db, booking()); const date = "2026-10-25";
    if (change === "missing-day") records(db, "hall/group/days").delete(date);
    if (change === "extra-day") records(db, "hall/group/days").set("2026-10-26", records(db, "hall/group/days").get(date));
    if (change === "missing-public") records(db, "hallAvailability").delete(date);
    if (change === "private-field") records(db, "hallAvailability").get(date).contact = "PRIVATE contact";
    if (change === "private-slot") records(db, "hallAvailability").get(date).occupied[0].purpose = "PRIVATE purpose";
    if (change === "malformed-index") records(db, "hall/group/days").get(date).reservations = "PRIVATE malformed";
    const report = await auditHallReservations(db, options); assert.equal(report.consistent, false, change); assert.equal(JSON.stringify(report).includes("PRIVATE"), false);
  }
});
test("current audit heads, invalid revisions, source drift and projection booleans are checked", async () => {
  const db = fixture(); add(db, booking()); db.evidence.clear(); let result = await codes(db); assert.ok(result.includes("history-head-mismatch")); assert.ok(result.includes("audit-head-mismatch"));
  records(db, "hall/group/bookings").get("one").revision = 0; assert.ok((await codes(db)).includes("invalid-revision"));
  records(db, "siteSettings").set("hallHirePublic", {enabled: true, notes: "PRIVATE"}); records(db, "hall").set("group", {ready: true});
  result = await codes(db); for (const code of ["public-settings-shape", "rollout-projection-mismatch", "readiness-projection-mismatch"]) assert.ok(result.includes(code));
});
test("horizons, unknown/duplicate decisions and incomplete scans fail closed", async () => {
  assert.throws(() => validateHallAuditOptions({from, through: "2028-01-01"})); assert.throws(() => validateHallAuditOptions({from, through: "invalid"}));
  const decision = {path: "events/one", version: "1:0", resource: "none"};
  for (const decisions of [[decision, decision], [{...decision, path: "members/private"}], [{...decision, notes: "PRIVATE"}]]) assert.throws(() => validateHallAuditOptions({...options, decisions}));
  const db = fixture(); db.truncated.push("events"); assert.ok((await codes(db)).includes("scan-limit"));
});
test("CLI requires an explicit matching environment and offers no apply/deploy/activation switch", () => {
  const args = ["--project=demo-hall-audit", `--from=${from}`, `--through=${through}`];
  assert.equal(hallAuditEnvironment(args, {FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080"}).project, "demo-hall-audit");
  for (const argv of [args.slice(1), [...args, "--apply=true"], [...args, "--project=production"]]) assert.throws(() => hallAuditEnvironment(argv, {FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080"}));
  assert.throws(() => hallAuditEnvironment(args, {})); assert.throws(() => hallAuditEnvironment(args, {FIRESTORE_EMULATOR_HOST: "remote.example:8080"}));
  assert.throws(() => hallAuditEnvironment(["--project=coolock-ardlea-scouts-test", `--from=${from}`, `--through=${through}`], {GCLOUD_PROJECT: "coolock-ardlea-scouts"}));
});
