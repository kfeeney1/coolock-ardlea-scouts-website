import assert from "node:assert/strict";
import test from "node:test";
import { buildYouthConsentStatus, handleYouthConsentStatus } from "../src/youthConsentStatus.js";

const string = stringValue => ({ stringValue });
const boolean = booleanValue => ({ booleanValue });
const array = values => ({ arrayValue: { values } });
const member = (id, section) => ({ name: `members/${id}`, fields: { section: string(section), displayName: string(id), status: string("active") } });
const form = (memberId, submittedAt, consentTo, status = "active") => ({ fields: {
  memberId: string(memberId), formType: string("youth-activity-consent"), status: string(status),
  submittedAt: { timestampValue: submittedAt }, consentTo: string(consentTo), medicationManagement: string("private")
} });

test("annual status follows the current section and latest non-archived completion", () => {
  const members = [member("transferred", "Cubs"), member("missing", "Cubs"), member("expired", "Beavers")];
  const forms = [
    form("transferred", "2024-10-01T00:00:00Z", "2025-10-01"),
    form("transferred", "2026-10-01T00:00:00Z", "2027-10-01"),
    form("transferred", "2026-11-01T00:00:00Z", "2026-11-01", "archived"),
    form("expired", "2026-10-01T00:00:00Z", "2026-11-01")
  ];
  const today = new Date("2026-11-23");
  const group = buildYouthConsentStatus(members, forms, { group: true, sections: [] }, today);
  assert.deepEqual(group, { totals: { current: 1, missing: 1, expired: 1, "renewal-required": 0 }, rows: [] });
  const cubs = buildYouthConsentStatus(members, forms, { group: false, sections: ["Cubs"] }, today);
  assert.deepEqual(cubs.rows, [
    { id: "missing", name: "missing", section: "Cubs", status: "missing", validUntil: null },
    { id: "transferred", name: "transferred", section: "Cubs", status: "current", validUntil: "2027-10-01" }
  ]);
  const mixed = buildYouthConsentStatus(members, forms, { group: true, sections: ["Cubs"] }, today);
  assert.deepEqual(mixed, { totals: group.totals, rows: cubs.rows });
  const beavers = buildYouthConsentStatus(members, forms, { group: false, sections: ["Beavers"] }, today);
  assert.deepEqual(beavers.rows.map(row => row.id), ["expired"]);
});

test("endpoint checks the caller and only returns rows from effective Section Leader appointments", async () => {
  const authorization = `Bearer header.${btoa(JSON.stringify({ sub: "leader" })).replaceAll("=", "")}.signature`;
  const request = new Request("https://worker.example/youth-consent-status", { method: "POST", headers: { Authorization: authorization } });
  const appointment = (name, scope, endDate) => ({ mapValue: { fields: {
    appointment: string(name), scope: string(scope), active: boolean(true), ...(endDate ? { endDate: string(endDate) } : {})
  } } });
  let appointments = [appointment("Section Leader", "Cubs"), appointment("Group Treasurer", "Group"), appointment("Section Leader", "Beavers", "2000-01-01")];
  let privileged = 0;
  const result = () => handleYouthConsentStatus(request, {
    base: "https://firestore.example/documents", origin: "https://site.example",
    serviceToken: async () => { privileged++; return "service-token"; },
    fetcher: async (url, init) => {
      if (url.endsWith("/adminUsers/leader")) {
        assert.equal(init.headers.Authorization, authorization);
        return Response.json({ fields: { active: boolean(true), role: string("leader"), sections: array([string("Cubs"), string("Beavers")]) } });
      }
      if (url.endsWith("/organisationLeadership/leader")) {
        return Response.json({ fields: { active: boolean(true), appointments: array(appointments) } });
      }
      const { structuredQuery } = JSON.parse(init.body);
      assert.ok(structuredQuery.select.fields.every(({ fieldPath }) => fieldPath !== "medicationManagement"));
      return Response.json(structuredQuery.from[0].collectionId === "members"
        ? [member("cub", "Cubs"), member("beaver", "Beavers")].map(document => ({ document }))
        : []);
    }
  });
  const response = await result();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual((await response.json()).rows.map(row => row.id), ["cub"]);
  appointments = appointments.slice(1);
  assert.equal((await result()).status, 403);
  assert.equal(privileged, 1);
});
