import assert from "node:assert/strict";
import test from "node:test";
import { handleEventRosterReport } from "../src/eventRosterReport.js";

const string = stringValue => ({ stringValue });
const boolean = booleanValue => ({ booleanValue });
const map = fields => ({ mapValue: { fields } });

test("roster export enforces current section, visible events, and recorded consent", async () => {
  let appointment = "Section Leader";
  let scope = "Cubs";
  let active = true;
  let hidden = false;
  let eventReadable = true;
  const token = `Bearer header.${btoa(JSON.stringify({ sub: "synthetic" })).replaceAll("=", "")}.sig`;
  function run(eventId = "synthetic-event") {
    return handleEventRosterReport(new Request("https://worker.example/event-roster-report", {
      method: "POST", headers: { Authorization: token }, body: JSON.stringify({ eventId, sections: ["Scouts"] })
    }), {
      base: "https://firestore.example/documents", origin: "https://site.example", serviceToken: async () => "service",
      fetcher: async (raw, init) => {
        const path = new URL(raw).pathname;
        if (path.endsWith("adminUsers/synthetic")) return Response.json({ fields: {
          active: boolean(true), role: string("leader"), sections: { arrayValue: { values: [string("Cubs")] } }
        } });
        if (path.endsWith("organisationLeadership/synthetic")) return Response.json({ fields: {
          active: boolean(true), appointments: { arrayValue: { values: [map({
            appointment: string(appointment), scope: string(scope), active: boolean(active)
          })] } }
        } });
        if (path.endsWith("/events/synthetic-event")) {
          assert.equal(init.headers.Authorization, scope === "Group" ? "Bearer service" : token);
          if (!eventReadable) return new Response(null, { status: 403 });
          return Response.json({ fields: {
            title: string("Synthetic camp"), section: string("All Sections"), hidden: boolean(hidden),
            consentRequired: boolean(true), consent: map({ cub: string("received") }),
            audience: map({ version: { integerValue: "3" } })
          } });
        }
        assert.equal(init.headers.Authorization, "Bearer service");
        const query = JSON.parse(init.body).structuredQuery;
        if (query.from[0].collectionId === "events") return Response.json([false, true].map((hidden, index) => ({
          document: { name: `events/event-${index}`, fields: { title: string("Camp"), hidden: boolean(hidden) } }
        })));
        if (query.from[0].collectionId === "audienceMembers") return Response.json(["cub", "scout"].map(id => ({
          document: { fields: { memberId: string(id) } }
        })));
        return Response.json([["cub", "Cubs"], ["scout", "Scouts"], ["outside", "Cubs"]].map(([id, section]) => ({
          document: { name: `members/${id}`, fields: { displayName: string(id), section: string(section) } }
        })));
      }
    });
  }
  const section = await run();
  assert.equal(section.status, 200);
  assert.equal(section.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual((await section.json()).rows, [{ name: "cub", section: "Cubs", attendance: "invited", consent: "received" }]);
  eventReadable = false;
  assert.equal((await run()).status, 404);
  eventReadable = true;
  appointment = "Group Treasurer";
  scope = "Group";
  const group = await run();
  assert.equal(group.status, 200);
  assert.deepEqual((await group.json()).rows.map(({ name, consent }) => [name, consent]), [["cub", "received"], ["scout", "required"]]);
  assert.deepEqual((await (await run(null)).json()).events.map(event => event.id), ["event-0"]);
  hidden = true;
  assert.equal((await run()).status, 404);
  active = false;
  assert.equal((await run()).status, 403);
});
