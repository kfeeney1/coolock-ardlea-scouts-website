import assert from "node:assert/strict";
import test from "node:test";
import { handleGuardianContactExport } from "../src/guardianContactExport.js";

const string = stringValue => ({ stringValue });
const boolean = booleanValue => ({ booleanValue });

test("guardian contact CSV applies current appointment scope and projects only export columns", async () => {
  let appointment = "Section Leader";
  let scope = "Cubs";
  let active = true;
  let privilegedQueries = 0;
  const authorization = `Bearer header.${btoa(JSON.stringify({ sub: "synthetic" })).replaceAll("=", "")}.signature`;
  const run = () => handleGuardianContactExport(new Request("https://worker.example/guardian-contact-export", {
    method: "POST", headers: { Authorization: authorization }, body: '{"sections":["Scouts"]}'
  }), {
    base: "https://firestore.example/documents", origin: "https://site.example",
    serviceToken: async () => "service",
    fetcher: async (url, init) => {
      if (url.includes("/adminUsers/")) {
        assert.equal(init.headers.Authorization, authorization);
        return Response.json({ fields: {
          active: boolean(true), role: string("leader"),
          sections: { arrayValue: { values: [string("Cubs")] } }
        } });
      }
      if (url.includes("/organisationLeadership/")) return Response.json({ fields: {
        active: boolean(true), appointments: { arrayValue: { values: [{ mapValue: { fields: {
          appointment: string(appointment), scope: string(scope), active: boolean(active)
        } } }] } }
      } });
      privilegedQueries++;
      const { structuredQuery } = JSON.parse(init.body);
      assert.equal(init.headers.Authorization, "Bearer service");
      assert.deepEqual(structuredQuery.select.fields.map(field => field.fieldPath),
        ["displayName", "section", "status", "parentName", "emailAddress", "mobileNumber"]);
      if (appointment === "Section Leader") {
        assert.equal(structuredQuery.where.fieldFilter.field.fieldPath, "section");
        assert.match(structuredQuery.where.fieldFilter.value.stringValue, /^Cub/);
      } else {
        assert.equal(structuredQuery.where, undefined);
      }
      return Response.json(["Cub Scouts", "Scouts"].map(section => ({ document: {
        name: `members/${section}`, fields: {
          displayName: string(`Synthetic ${section}`), section: string(section),
          status: string("active"), emailAddress: string(`${section.split(" ")[0]}@example.invalid`),
          medicalDetails: string("private")
        }
      } })));
    }
  });

  const sectionResponse = await run();
  assert.equal(sectionResponse.status, 200);
  assert.equal(sectionResponse.headers.get("Cache-Control"), "private, no-store");
  const sectionCsv = await sectionResponse.json();
  assert.equal(sectionCsv.count, 1);
  assert.equal(sectionCsv.scope, "Cubs");
  assert.match(sectionCsv.csv, /Cub@example.invalid/);
  assert.doesNotMatch(sectionCsv.csv, /Scouts@example.invalid|private/);

  appointment = "Group Treasurer";
  scope = "Group";
  const groupResponse = await run();
  assert.equal(groupResponse.status, 200);
  const groupCsv = await groupResponse.json();
  assert.equal(groupCsv.count, 2);
  assert.match(groupCsv.csv, /Scouts@example.invalid/);

  const queriesBeforeDenial = privilegedQueries;
  active = false;
  assert.equal((await run()).status, 403);
  active = true;
  appointment = "Programme Scouter";
  scope = "Cubs";
  assert.equal((await run()).status, 403);
  appointment = "Section Leader";
  scope = "Scouts";
  assert.equal((await run()).status, 403);
  assert.equal(privilegedQueries, queriesBeforeDenial);
});
