import assert from "node:assert/strict";
import test from "node:test";
import { handleChairpersonReports } from "../src/chairpersonReports.js";

const string = stringValue => ({ stringValue });
const boolean = booleanValue => ({ booleanValue });

test("the active Chairperson gets aggregate counts and group minutes only", async () => {
  let appointmentActive = true;
  let privilegedQueries = 0;
  const token = `Bearer header.${btoa(JSON.stringify({ sub: "chair" })).replaceAll("=", "")}.signature`;
  const load = report => handleChairpersonReports(new Request("https://worker.example/chairperson-reports", {
    method: "POST", headers: { Authorization: token }, body: JSON.stringify({ report })
  }), {
    base: "https://firestore.example/documents", origin: "https://site.example",
    serviceToken: async () => "service",
    fetcher: async (url, init) => {
      if (url.endsWith("/adminUsers/chair")) {
        assert.equal(init.headers.Authorization, token);
        return Response.json({ fields: {
          active: boolean(true), role: string("leader"), sections: { arrayValue: { values: [string("Cubs")] } }
        } });
      }
      if (url.endsWith("/organisationLeadership/chair")) return Response.json({ fields: {
        active: boolean(true), appointments: { arrayValue: { values: [{ mapValue: { fields: {
          appointment: string("Group Chairperson"), scope: string("Group"), active: boolean(appointmentActive)
        } } }] } }
      } });
      privilegedQueries++;
      const { structuredQuery } = JSON.parse(init.body);
      assert.equal(init.headers.Authorization, "Bearer service");
      assert.ok(!structuredQuery.select.fields.some(field => ["attachment", "parentName"].includes(field.fieldPath)));
      if (report === "membership") return Response.json([{ document: {
        fields: { displayName: string("Synthetic member"), section: string("Scouts"), status: string("active") }
      } }]);
      assert.deepEqual(structuredQuery.where.fieldFilter.value, string("group"));
      return Response.json(["Group", "Scouts"].map(section => ({ document: {
        name: `meetingRecords/${section}`, fields: {
          section: string(section), title: string(`${section} minutes`), meetingDate: string("2026-11-01"),
          notes: string("Synthetic minutes"), attachment: string("private")
        }
      } })));
    }
  });
  const membership = await load("membership");
  assert.equal(membership.status, 200);
  const counts = await membership.json();
  assert.deepEqual(counts.rows[0], { section: "Scouts", active: 1, inactive: 0, left: 0, total: 1 });
  assert.ok(!JSON.stringify(counts).includes("Synthetic member"));
  const meeting = await load("minutes");
  assert.equal(meeting.status, 200);
  assert.deepEqual((await meeting.json()).rows.map(({ section, title, attachment }) => ({ section, title, attachment })),
    [{ section: "Group", title: "Group minutes", attachment: undefined }]);
  appointmentActive = false;
  assert.equal((await load("membership")).status, 403);
  assert.equal(privilegedQueries, 2);
});
