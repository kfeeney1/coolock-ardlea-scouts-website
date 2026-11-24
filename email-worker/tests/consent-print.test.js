import assert from "node:assert/strict";
import test from "node:test";
import { handleConsentPrint } from "../src/consentPrint.js";

const string = stringValue => ({ stringValue });
const boolean = booleanValue => ({ booleanValue });

test("individual consent printing enforces approved current scope before reading form details", async () => {
  let appointment = "Section Leader";
  let scope = "Cubs";
  let memberSection = "Cubs";
  let enabled = true;
  let linkedMember = "synthetic-member";
  let detailReads = 0;
  const run = () => handleConsentPrint(new Request("https://worker.example/consent-print", {
    method: "POST",
    headers: { Authorization: `Bearer header.${btoa(JSON.stringify({ sub: "synthetic" })).replaceAll("=", "")}.sig` },
    body: JSON.stringify({ consentId: "synthetic-consent", section: "Cubs" })
  }), {
    base: "https://firestore.example/documents", origin: "https://site.example", serviceToken: async () => "service",
    fetcher: async (raw, init) => {
      const url = new URL(raw);
      const fields = url.searchParams.getAll("mask.fieldPaths");
      if (url.pathname.endsWith("adminUsers/synthetic")) return Response.json({ fields: {
        active: boolean(true), role: string("leader"), sections: { arrayValue: { values: [string("Cubs")] } }
      } });
      if (url.pathname.endsWith("organisationLeadership/synthetic")) return Response.json({ fields: {
        active: boolean(true), appointments: { arrayValue: { values: [{ mapValue: { fields: {
          appointment: string(appointment), scope: string(scope), active: boolean(enabled)
        } } }] } }
      } });
      assert.equal(init.headers.Authorization, "Bearer service");
      if (url.pathname.endsWith("members/synthetic-member")) return Response.json({ fields: {
        section: string(memberSection), displayName: string("Synthetic <Member>")
      } });
      assert.ok(url.pathname.endsWith("consentApplications/synthetic-consent"));
      const detail = fields.includes("allergies");
      if (detail) detailReads++;
      return Response.json({ fields: {
        memberId: string(linkedMember), formType: string("youth-activity-consent"), status: string("active"),
        ...(detail && { allergies: string("Synthetic <allergy>"), internalNote: string("Excluded private note") })
      } });
    }
  });
  const allowed = await run();
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("Cache-Control"), "private, no-store");
  const pdf = await allowed.json();
  assert.equal(pdf.section, "Cubs");
  assert.match(pdf.html, /Synthetic &lt;Member&gt;/);
  assert.match(pdf.html, /Synthetic &lt;allergy&gt;/);
  assert.doesNotMatch(pdf.html, /Excluded private note/);
  memberSection = "Scouts";
  assert.equal((await run()).status, 404);
  assert.equal(detailReads, 1);

  appointment = "Group Treasurer";
  scope = "Group";
  assert.equal((await run()).status, 200);
  linkedMember = "";
  assert.equal((await run()).status, 404);
  enabled = false;
  assert.equal((await run()).status, 403);
  assert.equal(detailReads, 2);
});
