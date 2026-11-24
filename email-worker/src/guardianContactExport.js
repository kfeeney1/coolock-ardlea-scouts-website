import { guardianContactExportAccess } from "../../src/security/guardianContactExportAccess.ts";
import { canonicalMemberSection, memberSectionStorageAliases } from "../../src/services/memberSectionCore.mjs";
import { memberReportCsv } from "../../src/services/reportingLogic.ts";
import { equal, profileForReport, projectedQuery, readCallerLeader, string } from "./youthConsentStatus.js";

const fields = ["displayName", "section", "status", "parentName", "emailAddress", "mobileNumber"];

export async function handleGuardianContactExport(request, { base, serviceToken, origin, fetcher = fetch }) {
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
    const access = guardianContactExportAccess(profile);
    if (!access.allowed) return reply(403);

    const token = await serviceToken();
    const filters = access.group ? [undefined] :
      access.sections.flatMap(section => memberSectionStorageAliases(section).map(alias => equal("section", alias)));
    const documents = (await Promise.all(filters.map(where =>
      projectedQuery(base, token, "members", fields, where, fetcher)))).flat();
    const members = new Map();
    for (const { name, fields: data } of documents) {
      const section = canonicalMemberSection(string(data, "section"));
      const displayName = string(data, "displayName");
      const status = string(data, "status");
      if (!displayName || !section || !["active", "inactive", "left"].includes(status)
        || (!access.group && !access.sections.includes(section))) continue;
      members.set(name, {
        id: name.split("/").pop(), displayName, section, status,
        parentName: string(data, "parentName"), emailAddress: string(data, "emailAddress"),
        mobileNumber: string(data, "mobileNumber")
      });
    }
    const rows = [...members.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
    return reply(200, {
      csv: memberReportCsv(rows), count: rows.length,
      scope: access.group ? "All sections" : access.sections.join(", ")
    });
  } catch {
    return reply(503);
  }
}
