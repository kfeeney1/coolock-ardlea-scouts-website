import { eventConsentReportAccess } from "../../src/security/eventConsentReportAccess.ts";
import { normalizeScoutingAppointmentAssignments } from "../../src/security/scoutingAppointments.ts";
import { evaluateMemberFormLifecycle } from "../../src/services/formRenewalLogic.ts";
import { canonicalMemberSection, canonicalMemberSections, isMemberProgrammeSection } from "../../src/services/memberSectionCore.mjs";

const string = (fields, key) => fields?.[key]?.stringValue ?? "";
const active = fields => fields?.active?.booleanValue === true;
const array = (fields, key) => fields?.[key]?.arrayValue?.values ?? [];
const timestamp = (fields, key) => fields?.[key]?.timestampValue ? new Date(fields[key].timestampValue) : null;

function profileForReport(leader, leadership) {
  const role = string(leader, "role");
  if (!active(leader) || !["leader", "admin", "super-admin"].includes(role) || Object.hasOwn(leader, "section")) return null;
  const sections = array(leader, "sections").map(item => canonicalMemberSection(item.stringValue)).filter(Boolean);
  if (!sections.length) return null;
  const records = active(leadership) ? array(leadership, "appointments") : [];
  const assignments = records.map(({ mapValue }) => {
    const fields = mapValue?.fields;
    return {
      appointment: string(fields, "appointment"), scope: string(fields, "scope"),
      active: fields?.active?.booleanValue, startDate: string(fields, "startDate"), endDate: string(fields, "endDate")
    };
  });
  return {
    role, sections,
    appointments: normalizeScoutingAppointmentAssignments(assignments,
      active(leadership) && !records.length ? string(leadership, "scoutingRole") : "",
      string(leadership, "organisationSection"))
  };
}

function equal(fieldPath, stringValue) {
  return { fieldFilter: { field: { fieldPath }, op: "EQUAL", value: { stringValue } } };
}

async function projectedQuery(base, token, collectionId, fields, where, fetcher) {
  const response = await fetcher(`${base}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], select: { fields: fields.map(fieldPath => ({ fieldPath })) }, where } })
  });
  if (!response.ok) throw new Error("Consent status query failed.");
  return (await response.json()).flatMap(row => row.document ? [row.document] : []);
}

export function buildYouthConsentStatus(members, forms, access, asOf = new Date()) {
  const byMember = new Map();
  for (const { fields } of forms) {
    const memberId = string(fields, "memberId");
    if (!memberId) continue;
    const form = {
      memberId, formType: string(fields, "formType"), status: string(fields, "status"),
      consentTo: string(fields, "consentTo"), submittedAt: timestamp(fields, "submittedAt"),
      parentUpdatedAt: timestamp(fields, "parentUpdatedAt"), updatedAt: null
    };
    const records = byMember.get(memberId) ?? [];
    records.push(form);
    byMember.set(memberId, records);
  }

  const totals = { current: 0, missing: 0, expired: 0, "renewal-required": 0 };
  const rows = [];
  for (const { name, fields } of members) {
    const id = name.split("/").pop();
    const section = canonicalMemberSections(array(fields, "sections").map(item => item.stringValue), string(fields, "section"))[0];
    if (string(fields, "status") !== "active" || !isMemberProgrammeSection(section)
      || (!access.group && !access.sections.includes(section))) continue;
    const lifecycle = evaluateMemberFormLifecycle({ id, active: true }, byMember.get(id) ?? [], asOf);
    totals[lifecycle.status]++;
    if (access.sections.includes(section)) rows.push({
      id, section, name: string(fields, "displayName"), status: lifecycle.status,
      validUntil: lifecycle.validUntil?.toISOString().slice(0, 10) ?? null
    });
  }
  rows.sort((left, right) => left.section.localeCompare(right.section) || left.name.localeCompare(right.name));
  return { totals, rows };
}

export async function handleYouthConsentStatus(request, { base, serviceToken, origin, fetcher = fetch }) {
  const headers = {
    "Content-Type": "application/json", "Cache-Control": "private, no-store", Vary: "Origin",
    "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  const reply = (status, body) => new Response(body ? JSON.stringify(body) : null, { status, headers });
  if (request.method === "OPTIONS") return reply(204);
  if (request.method !== "POST") return reply(405);
  const authorization = request.headers.get("Authorization") ?? "";
  let uid;
  try {
    const encoded = authorization.match(/^Bearer [^.]+\.([^.]+)\.[^.]+$/)?.[1]?.replaceAll("-", "+").replaceAll("_", "/");
    uid = JSON.parse(atob(encoded)).sub;
  } catch { return reply(401); }
  if (typeof uid !== "string" || !uid || uid.includes("/")) return reply(401);
  const read = async collection => {
    const res = await fetcher(`${base}/${collection}/${encodeURIComponent(uid)}`, { headers: { Authorization: authorization } });
    return res.ok ? (await res.json()).fields : null;
  };

  try {
    // Firestore verifies the caller token before the endpoint uses service credentials.
    const [leader, leadership] = await Promise.all([read("adminUsers"), read("organisationLeadership")]);
    const access = eventConsentReportAccess(profileForReport(leader, leadership));
    if (!access.canOpen) return reply(403);
    const token = await serviceToken();
    const [members, forms] = await Promise.all([
      projectedQuery(base, token, "members", ["displayName", "section", "sections", "status"], equal("status", "active"), fetcher),
      projectedQuery(base, token, "consentApplications",
        ["memberId", "formType", "status", "consentTo", "submittedAt", "parentUpdatedAt"],
        equal("formType", "youth-activity-consent"), fetcher)
    ]);
    return reply(200, buildYouthConsentStatus(members, forms, access));
  } catch {
    return reply(503);
  }
}
