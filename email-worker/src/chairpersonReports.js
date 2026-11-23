import { hasChairpersonReportAccess } from "../../src/security/chairpersonReportAccess.ts";
import { membershipTotals } from "../../src/services/reportingLogic.ts";
import { equal, profileForReport, projectedQuery, readCallerLeader, string } from "./youthConsentStatus.js";

async function totals(base, token, fetcher) {
  const documents = await projectedQuery(base, token, "members", ["displayName", "section", "status"], undefined, fetcher);
  const rows = documents.flatMap(({ fields = {} }) => {
    const section = string(fields, "section").trim();
    const status = string(fields, "status");
    return string(fields, "displayName").trim() && section && ["active", "inactive", "left"].includes(status) ? [{ section, status }] : [];
  });
  return rows.length ? membershipTotals(rows) : [];
}

const minutesFields = ["title", "meetingDate", "section", "attendees", "notes", "decisions", "actions"];
async function minutes(base, token, fetcher) {
  const documents = await projectedQuery(base, token, "meetingRecords", minutesFields, equal("meetingType", "group"), fetcher);
  return documents.flatMap(({ name, fields = {} }) => {
    const title = string(fields, "title");
    const meetingDate = string(fields, "meetingDate");
    if (string(fields, "section") !== "Group" || !title || !meetingDate) return [];
    return [{
      id: name.split("/").pop(), title, meetingDate, section: "Group",
      attendees: (fields.attendees?.arrayValue?.values ?? []).map(value => value.stringValue).filter(Boolean),
      notes: string(fields, "notes"), decisions: string(fields, "decisions"), actions: string(fields, "actions")
    }];
  }).sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
}

export async function handleChairpersonReports(request, { base, serviceToken, origin, fetcher = fetch }) {
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
    if (!hasChairpersonReportAccess(profile)) return reply(403);
    const { report } = await request.json().catch(() => ({})) ?? {};
    if (!["membership", "minutes"].includes(report)) return reply(400);
    const token = await serviceToken();
    return reply(200, { rows: await (report === "membership" ? totals : minutes)(base, token, fetcher) });
  } catch {
    return reply(503);
  }
}
