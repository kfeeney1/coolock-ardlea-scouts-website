import assert from "node:assert/strict";
import test from "node:test";
import { handleMemberMedical } from "../src/memberMedical.js";

const string = stringValue => ({ stringValue });
const authorization = `Bearer header.${btoa(JSON.stringify({ sub: "leader" })).replaceAll("=", "")}.signature`;
const request = consentId => new Request("https://worker.example/member-medical", {
  method: "POST", headers: { Authorization: authorization }, body: JSON.stringify({ consentId })
});

test("an active section leader can read another section’s medical fields without receiving the full consent", async () => {
  const response = await handleMemberMedical(request("consent"), {
    base: "https://firestore.example/documents", origin: "https://site.example",
    serviceToken: async () => "service",
    fetcher: async (url, init) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/adminUsers/leader")) {
        assert.equal(init.headers.Authorization, authorization);
        return Response.json({ fields: { active: { booleanValue: true }, role: string("leader"), sections: { arrayValue: { values: [string("Cubs")] } } } });
      }
      assert.equal(init.headers.Authorization, "Bearer service");
      if (path.endsWith("/consentApplications/consent")) {
        assert.ok(!new URL(url).searchParams.getAll("mask.fieldPaths").includes("sig1Name"));
        return Response.json({ fields: {
          formType: string("youth-activity-consent"), memberId: string("member"),
          medicalFurtherInfo: string("Synthetic allergy"), homeAddress: string("private"), sig1Name: string("private")
        } });
      }
      assert.ok(path.endsWith("/members/member"));
      return Response.json({ fields: { displayName: string("Synthetic member"), section: string("Scouts") } });
    }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await response.json(), { record: {
    id: "consent", memberName: "Synthetic member", section: "Scouts",
    data: { medicalFurtherInfo: "Synthetic allergy" }
  } });
});

test("an inactive account cannot obtain directory or clinical reads", async () => {
  let privileged = false;
  const response = await handleMemberMedical(request(null), {
    base: "https://firestore.example/documents", origin: "https://site.example",
    serviceToken: async () => { privileged = true; return ""; },
    fetcher: async () => Response.json({ fields: { active: { booleanValue: false }, role: string("leader") } })
  });
  assert.equal(response.status, 403);
  assert.equal(privileged, false);
});
