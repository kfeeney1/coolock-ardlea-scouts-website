import { canonicalMemberSections } from "../../src/services/memberSectionCore.mjs";
import { medicalPresentationDefinition } from "../../src/services/medicalPresentation.ts";
import { equal, projectedQuery, readCallerLeader, string } from "./youthConsentStatus.js";

const clinicalFields = medicalPresentationDefinition.filter(group => group.id !== "contacts").flatMap(group => group.fields);
const rosterFields = ["memberId", "formType", "status", "submittedAt", "parentUpdatedAt"];
export const medicationFields = ["enabled", "medicineName", "dosage", "frequency", "method", "selfAdmin", "otherInfo"];
const youthForm = "youth-activity-consent";

const sectionOf = fields => canonicalMemberSections(
  fields.sections?.arrayValue?.values?.map(value => value.stringValue), string(fields, "section")
)[0] ?? "";
const idOf = doc => doc.name.split("/").pop();
const isLinkedForm = fields => string(fields, "formType") === youthForm && validId(string(fields, "memberId"));
const validId = value => typeof value === "string" && value.length > 0 && value.length <= 1500 && !value.includes("/") && ![".", ".."].includes(value);

export async function readDocument(base, token, path, fields, fetcher) {
  const url = new URL(`${base}/${path}`);
  for (const field of fields) url.searchParams.append("mask.fieldPaths", field);
  const response = await fetcher(url.href, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Report document read failed.");
  return (await response.json()).fields ?? {};
}

function projectMedication(fields) {
  return Object.fromEntries(medicationFields.flatMap(key => {
    const value = fields?.[key]?.stringValue ?? fields?.[key]?.booleanValue;
    return value === undefined ? [] : [[key, value]];
  }));
}

export function projectMedical(fields) {
  const data = Object.fromEntries(clinicalFields.flatMap(key =>
    typeof fields[key]?.stringValue === "string" ? [[key, fields[key].stringValue]] : []));
  const medication = fields.medicationManagement?.mapValue?.fields;
  if (medication) {
    const medications = medication.medications?.arrayValue?.values?.map(entry => projectMedication(entry.mapValue?.fields));
    data.medicationManagement = { ...projectMedication(medication), ...(medications?.length && { medications }) };
  }
  return data;
}

async function listMembers(base, token, fetcher) {
  const [members, forms] = await Promise.all([
    projectedQuery(base, token, "members", ["displayName", "section", "sections"], undefined, fetcher),
    projectedQuery(base, token, "consentApplications", rosterFields, equal("formType", youthForm), fetcher)
  ]);
  const newest = new Map();
  for (const form of forms) {
    const fields = form.fields ?? {};
    if (!isLinkedForm(fields) || string(fields, "status") === "archived") continue;
    const id = string(fields, "memberId");
    const time = Math.max(Date.parse(fields.submittedAt?.timestampValue) || 0, Date.parse(fields.parentUpdatedAt?.timestampValue) || 0);
    const previous = newest.get(id);
    if (!previous || time > previous.time) newest.set(id, { time, consentId: idOf(form) });
  }
  return members.flatMap(member => {
    const fields = member.fields ?? {};
    const entry = newest.get(idOf(member));
    const name = string(fields, "displayName");
    return entry && name ? [{ consentId: entry.consentId, name, section: sectionOf(fields) }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function handleMemberMedical(request, { base, serviceToken, origin, fetcher = fetch }) {
  const headers = {
    "Content-Type": "application/json", "Cache-Control": "private, no-store", Vary: "Origin",
    "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  const reply = (status, body) => new Response(body ? JSON.stringify(body) : null, { status, headers });
  if (request.method === "OPTIONS") return reply(204);
  if (request.method !== "POST") return reply(405);
  try {
    if (!await readCallerLeader(request, base, fetcher)) return reply(403);
    const input = await request.json().catch(() => null);
    if (!input || (input.consentId !== null && !validId(input.consentId))) return reply(400);
    const token = await serviceToken();
    if (input.consentId === null) return reply(200, { members: await listMembers(base, token, fetcher) });
    const id = input.consentId;
    const fields = await readDocument(base, token, `consentApplications/${encodeURIComponent(id)}`,
      ["memberId", "formType", ...clinicalFields, "medicationManagement.medications", ...medicationFields.map(field => `medicationManagement.${field}`)], fetcher);
    if (!fields || !isLinkedForm(fields)) return reply(404);
    const member = await readDocument(base, token, `members/${encodeURIComponent(string(fields, "memberId"))}`,
      ["displayName", "section", "sections"], fetcher);
    if (!member) return reply(404);
    return reply(200, { record: { id, memberName: string(member, "displayName"), section: sectionOf(member), data: projectMedical(fields) } });
  } catch {
    return reply(503);
  }
}
