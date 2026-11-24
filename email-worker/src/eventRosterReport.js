import { eventRosterExportAccess } from "../../src/security/eventRosterExportAccess.ts";
import { canonicalMemberSection, memberBelongsToSection } from "../../src/services/memberSectionCore.mjs";
import { readDocument } from "./memberMedical.js";
import { equal, profileForReport, projectedQuery, readCallerLeader, string } from "./youthConsentStatus.js";

const eventFields = ["title", "section", "startDate", "hidden"];
const idOf = name => name.split("/").at(-1);
const validId = id => typeof id === "string" && id.length > 0 && id.length <= 1500 && !id.includes("/") && ![".", ".."].includes(id);
const list = field => (field?.arrayValue?.values ?? []).map(value => value.stringValue).filter(Boolean);
const isHidden = fields => fields?.hidden?.booleanValue === true;

async function visibleEventChoices(base, token, fetcher) {
  const docs = await projectedQuery(base, token, "events", eventFields, undefined, fetcher);
  return docs.filter(({ fields }) => !isHidden(fields)).map(({ name, fields }) => ({
    id: idOf(name), title: string(fields, "title"), section: string(fields, "section"), startDate: string(fields, "startDate")
  })).filter(event => event.title).sort((a, b) => b.startDate.localeCompare(a.startDate) || a.title.localeCompare(b.title));
}

async function rosterRows(base, token, eventId, event, access, fetcher) {
  const audience = event.audience?.mapValue?.fields;
  const snapshot = Number(audience?.version?.integerValue) === 3
    ? await projectedQuery(`${base}/events/${encodeURIComponent(eventId)}`, token, "audienceMembers", ["memberId"],
      equal("eventId", eventId), fetcher)
    : [];
  const invited = new Set(Number(audience?.version?.integerValue) === 3
    ? snapshot.map(({ fields }) => string(fields, "memberId"))
    : list(audience?.resolvedMemberIds));
  const section = string(event, "section");
  const attendance = event.attendance?.mapValue?.fields ?? {};
  const consent = event.consent?.mapValue?.fields ?? {};
  const members = await projectedQuery(base, token, "members", ["displayName", "section", "sections", "status"], undefined, fetcher);
  return members.flatMap(({ name, fields }) => {
    const id = idOf(name);
    const currentSection = canonicalMemberSection(string(fields, "section"));
    const displayName = string(fields, "displayName");
    if (!displayName || !currentSection || (!access.group && !access.sections.includes(currentSection))) return [];
    const member = { section: currentSection, sections: list(fields.sections) };
    const inRoster = audience ? invited.has(id)
      : string(fields, "status") === "active" && (["All Sections", "Group"].includes(section) || memberBelongsToSection(member, section));
    if (!inRoster) return [];
    const attendanceValue = string(attendance, id);
    const consentValue = string(consent, id);
    return [{
      name: displayName, section: currentSection,
      attendance: ["attending", "not-attending"].includes(attendanceValue) ? attendanceValue : "invited",
      consent: ["received", "required", "not-required"].includes(consentValue)
        ? consentValue : event.consentRequired?.booleanValue === true ? "required" : "not-required"
    }];
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function handleEventRosterReport(request, { base, serviceToken, origin, fetcher = fetch }) {
  const headers = {
    "Content-Type": "application/json", "Cache-Control": "private, no-store", Vary: "Origin",
    "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  const reply = (status, body) => new Response(body ? JSON.stringify(body) : null, { status, headers });
  if (request.method === "OPTIONS") return reply(204);
  if (request.method !== "POST") return reply(405);
  try {
    const caller = await readCallerLeader(request, base, fetcher);
    if (!caller) return reply(403);
    const profile = profileForReport(caller.leader, await caller.read("organisationLeadership"));
    const access = eventRosterExportAccess(profile);
    if (!access.allowed) return reply(403);
    const input = await request.json().catch(() => null);
    if (!input || (input.eventId !== null && !validId(input.eventId))) return reply(400);
    if (input.eventId === null) {
      if (!access.group) return reply(403);
      return reply(200, { events: await visibleEventChoices(base, await serviceToken(), fetcher) });
    }

    const eventId = input.eventId;
    const token = await serviceToken();
    const callerToken = request.headers.get("Authorization").slice(7);
    const event = await readDocument(base, access.group ? token : callerToken, `events/${encodeURIComponent(eventId)}`,
      [...eventFields, "consentRequired", "attendance", "consent", "audience"], async (url, init) => {
        const result = await fetcher(url, init);
        return result.status === 403 ? new Response(null, { status: 404 }) : result;
      });
    if (!event || isHidden(event)) return reply(404);
    const rows = await rosterRows(base, token, eventId, event, access, fetcher);
    return reply(200, { title: string(event, "title"), startDate: string(event, "startDate"), rows });
  } catch {
    return reply(503);
  }
}
