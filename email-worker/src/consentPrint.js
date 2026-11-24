import { canPrintYouthConsent } from "../../src/security/consentPrintAccess.ts";
import { consentRecordPrintHtml } from "../../src/services/consentManagementLogic.ts";
import { medicalPresentationDefinition } from "../../src/services/medicalPresentation.ts";
import { canonicalMemberSection } from "../../src/services/memberSectionCore.mjs";
import { medicationFields, projectMedical, readDocument } from "./memberMedical.js";
import { profileForReport, readCallerLeader, string } from "./youthConsentStatus.js";

const identityFields = ["memberId", "formType", "status"];
const formFields = ["childDOB", "consentFrom", "consentTo", "submittedAt", "parentEmail", "signature", "signedBy",
  ...medicalPresentationDefinition.flatMap(group => group.fields)];
const validId = id => typeof id === "string" && id.length > 0 && id.length <= 1500 && !id.includes("/") && ![".", ".."].includes(id);
const linkedYouth = fields => fields && string(fields, "formType") === "youth-activity-consent"
  && ["active", "reviewed", "expired", "archived"].includes(string(fields, "status"))
  && validId(string(fields, "memberId"));

export async function handleConsentPrint(request, { base, serviceToken, origin, fetcher = fetch }) {
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
    if (!profile || !profile.sections.some(section => canPrintYouthConsent(profile, section))) return reply(403);
    const { consentId } = await request.json().catch(() => ({})) ?? {};
    if (!validId(consentId)) return reply(400);

    const token = await serviceToken();
    const path = `consentApplications/${encodeURIComponent(consentId)}`;
    const identity = await readDocument(base, token, path, identityFields, fetcher);
    if (!linkedYouth(identity)) return reply(404);
    const memberId = string(identity, "memberId");
    const member = await readDocument(base, token, `members/${encodeURIComponent(memberId)}`, ["section", "displayName"], fetcher);
    const section = canonicalMemberSection(string(member, "section"));
    if (!member || !section || !canPrintYouthConsent(profile, section)) return reply(404);
    const form = await readDocument(base, token, path, [...identityFields, ...formFields, "medicationManagement.medications",
      ...medicationFields.map(field => `medicationManagement.${field}`)], fetcher);
    if (!linkedYouth(form) || string(form, "memberId") !== memberId) return reply(404);
    const submittedAt = new Date(form.submittedAt?.timestampValue ?? "");
    const data = Object.fromEntries(formFields.flatMap(key => typeof form[key]?.stringValue === "string" ? [[key, form[key].stringValue]] : []));
    const html = consentRecordPrintHtml({
      type: "youth", section, memberName: string(member, "displayName"),
      consentTo: string(form, "consentTo"), submittedAt: Number.isNaN(submittedAt.getTime()) ? null : submittedAt, data: { ...data, ...projectMedical(form) }
    });
    return reply(200, { html, section });
  } catch {
    return reply(503);
  }
}
