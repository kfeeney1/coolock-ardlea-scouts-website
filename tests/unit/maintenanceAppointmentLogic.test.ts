import {test} from "node:test";
import assert from "node:assert/strict";
import {appointmentErrors, appointmentCalendarEntry, appointmentSavedPath, cleanAppointment, emptyAppointment} from "../../src/services/maintenanceAppointmentLogic.ts";
test("maintenance appointment validates real dates, required title and strictly increasing local times", () => {
  const input = {...emptyAppointment("2026-10-22"), title: "Boiler service"};
  assert.deepEqual(appointmentErrors(input), {});
  assert.ok(appointmentErrors({...input, date: "2026-02-30"}).date);
  assert.ok(appointmentErrors({...input, title: "  "}).title);
  assert.ok(appointmentErrors({...input, allDay: false}).startTime);
  for(const endTime of ["10:00", "09:59", "24:00"]) assert.ok(appointmentErrors({...input, allDay: false, startTime: "10:00", endTime}).endTime);
  assert.deepEqual(appointmentErrors({...input, allDay: false, startTime: "10:00", endTime: "10:01"}), {});
});
test("appointment persistence excludes snapshot metadata and maps one canonical group-wide entry", () => {
  const input = {...emptyAppointment("2026-10-22"), title: " Boiler service ", startTime: "10:00", endTime: "11:00", id: "private-metadata", revision: 9};
  const clean = cleanAppointment(input);
  assert.equal(clean.title, "Boiler service"); assert.equal(clean.startTime, ""); assert.equal("id" in clean, false); assert.equal("revision" in clean, false);
  const entry = appointmentCalendarEntry({...clean, id: input.id, revision: 9});
  assert.equal(entry.type, "maintenance"); assert.equal(entry.section, "Group"); assert.equal(entry.time, ""); assert.match(entry.path, /private-metadata$/);
});
test("saving an appointment returns to its date and reveals it without losing compatible filters", () => {
  assert.equal(appointmentSavedPath("/calendar?month=2026-09&type=meeting&section=Scouts", "2026-10-22"), "/calendar?month=2026-10&type=maintenance");
  assert.equal(appointmentSavedPath("/calendar?month=2026-09&type=all&section=Group", "2026-10-22"), "/calendar?month=2026-10&type=all&section=Group");
});
