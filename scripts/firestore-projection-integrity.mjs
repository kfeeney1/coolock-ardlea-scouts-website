const text = (value) => typeof value === "string" ? value.trim() : "";
const dateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value));
const whole = (value) => typeof value === "number" && Number.isInteger(value);

export function validateProjectionIntegrity(collections) {
  const errors = [];
  const fail = (collection, id, message) => errors.push(`${collection}/${id}: ${message}`);
  const records = (name) => collections.get(name) || new Map();
  const weeklyMeetings = records("weeklyMeetings");
  const events = records("events");

  for (const [id, data] of records("programmeLibrary")) {
    if (!["activity", "badgework"].includes(data.kind)) fail("programmeLibrary", id, "kind must be activity or badgework");
    if (!text(data.section) || !text(data.name)) fail("programmeLibrary", id, "section and name are required");
    if (!whole(data.durationMinutes) || data.durationMinutes < 0 || data.durationMinutes > 360) fail("programmeLibrary", id, "durationMinutes must be a whole number from 0 to 360");
    for (const field of ["leader", "notes", "equipment"]) if (typeof data[field] !== "string") fail("programmeLibrary", id, `${field} must be a string`);
  }

  for (const [id, data] of records("parentWeeklyMeetings")) {
    const source = weeklyMeetings.get(id);
    if (!source) {
      fail("parentWeeklyMeetings", id, "has no weeklyMeetings source");
      continue;
    }
    if (!text(data.section) || data.section !== source.section) fail("parentWeeklyMeetings", id, "section differs from source meeting");
    if (!dateOnly(data.meetingDate) || data.meetingDate !== source.meetingDate) fail("parentWeeklyMeetings", id, "meetingDate differs from source meeting");
    if (!["open", "closed"].includes(data.status)) fail("parentWeeklyMeetings", id, "status must be open or closed");
    if (!Array.isArray(data.activities) || !Array.isArray(data.badgework)) fail("parentWeeklyMeetings", id, "activities and badgework must be arrays");
  }

  for (const [id, data] of records("parentGalleryEvents")) {
    const source = events.get(id);
    if (!source) {
      fail("parentGalleryEvents", id, "has no events source");
      continue;
    }
    if (text(data.eventId) !== id) fail("parentGalleryEvents", id, "eventId must match document id");
    for (const field of ["title", "eventType", "section", "startDate", "endDate", "status"]) {
      if (!text(data[field]) || data[field] !== source[field]) fail("parentGalleryEvents", id, `${field} differs from source event`);
    }
    if (!["open", "closed", "completed"].includes(data.status)) fail("parentGalleryEvents", id, "source status is not gallery-retainable");
  }

  for (const [id, data] of records("siteSettings")) {
    if (id !== "session") fail("siteSettings", id, "unexpected settings document id");
    for (const field of ["parentInactivityMinutes", "leaderDesktopInactivityMinutes", "leaderPhoneInactivityMinutes"]) {
      if (!whole(data[field]) || data[field] < 5 || data[field] > 240) fail("siteSettings", id, `${field} must be a whole number from 5 to 240`);
    }
    if (!text(data.updatedBy)) fail("siteSettings", id, "updatedBy is required");
  }

  return errors.sort();
}

