import assert from "node:assert/strict";
import { test } from "node:test";
import { createEventSaveHandler, EVENT_BACKEND_PROJECT_ID } from "../src/handler.js";
import { handleEventAudienceSave } from "../../email-worker/src/productionRoutes.js";

const string = (value) => ({ stringValue: value });
const list = (values) => ({ arrayValue: { values: values.map(string) } });
const prefix = `projects/${EVENT_BACKEND_PROJECT_ID}/databases/(default)/documents`;
const token = `header.${Buffer.from(JSON.stringify({ sub: "leader-1", user_id: "leader-1" })).toString("base64url")}.signature`;
const leader = { fields: { active: { booleanValue: true }, role: string("leader"), sections: list(["Cubs"]) } };
const members = [
  { name: `${prefix}/members/cub-1`, fields: { status: string("active"), section: string("Cubs"), sections: list(["Cubs"]) } },
  { name: `${prefix}/members/scout-1`, fields: { status: string("active"), section: string("Scouts"), sections: list(["Scouts"]) } }
];

test("Firebase TEST creates, retries, edits and reopens a Cubs Activity without email credentials", async () => {
  const documents = new Map();
  let commits = 0;
  let failCommit = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.hostname, "firestore.googleapis.com");
    assert.equal(parsed.pathname.includes(`/projects/${EVENT_BACKEND_PROJECT_ID}/`), true);
    if (parsed.pathname.endsWith("/adminUsers/leader-1")) {
      assert.equal(init.headers.Authorization, `Bearer ${token}`);
      return Response.json(leader);
    }
    if (parsed.pathname.endsWith("/organisationLeadership/leader-1")) {
      assert.equal(init.headers.Authorization, `Bearer ${token}`);
      return new Response("missing", { status: 404 });
    }
    assert.equal(init.headers.Authorization, "Bearer runtime-access-token");
    if (parsed.pathname.endsWith("/members")) return Response.json({ documents: members });
    if (parsed.pathname.endsWith("/audienceMembers")) {
      return Response.json({ documents: [...documents.values()].filter((document) => document.name.includes("/audienceMembers/")) });
    }
    if (parsed.pathname.endsWith("/documents:commit")) {
      if (failCommit) return new Response("unavailable", { status: 503 });
      commits += 1;
      const body = JSON.parse(init.body);
      for (const write of body.writes) {
        if (write.delete) documents.delete(write.delete);
        if (write.update) {
          const current = documents.get(write.update.name);
          if (write.currentDocument?.exists === false) assert.equal(current, undefined);
          if (write.currentDocument?.updateTime) assert.equal(current.updateTime, write.currentDocument.updateTime);
          documents.set(write.update.name, {
            name: write.update.name,
            fields: write.updateMask ? { ...current.fields, ...write.update.fields } : write.update.fields,
            updateTime: `2099-05-10T00:00:0${commits}.000Z`
          });
        }
      }
      return Response.json({ writeResults: body.writes.map(() => ({ updateTime: "2099-05-10T00:00:00.000Z" })) });
    }
    const name = parsed.pathname.split("/documents/")[1];
    const found = documents.get(`${prefix}/${name}`);
    return found ? Response.json(found) : new Response("missing", { status: 404 });
  };
  const save = createEventSaveHandler({
    projectId: EVENT_BACKEND_PROJECT_ID,
    verifyIdToken: async (value) => { assert.equal(value, token); return { uid: "leader-1" }; },
    getServiceAccessToken: async () => "runtime-access-token",
    saveAudience: handleEventAudienceSave
  });
  const input = {
    title: "Camping1", description: "", eventType: "Activity", section: "Cubs",
    location: "Scout den", meetingPoint: "", returnDetails: "", leaderNotes: "",
    startDate: "2099-05-10", endDate: "2099-05-11", status: "draft", consentRequired: false
  };
  const request = (body) => new Request("https://coolock-ardlea-scouts-test.web.app/api/event-audience-save", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const body = { operation: "create", eventId: "event-1", input, audience: { sectionIds: ["Cubs"], memberIds: [] } };
  try {
    assert.equal((await save(request(body))).status, 200);
    assert.equal(documents.get(`${prefix}/events/event-1`).fields.title.stringValue, "Camping1");
    const retry = await save(request(body));
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).alreadyExists, true);
    assert.equal(commits, 1);

    const edit = { ...body, operation: "update", input: { ...input, title: "Camping1 edited" } };
    assert.equal((await save(request(edit))).status, 200);
    assert.equal(commits, 2);
    assert.equal(documents.get(`${prefix}/events/event-1`).fields.title.stringValue, "Camping1 edited");
    assert.equal(documents.get(`${prefix}/events/event-1`).fields.createdBy.stringValue, "leader-1");

    failCommit = true;
    const failed = await save(request({ ...edit, input: { ...edit.input, title: "Unsaved edit" } }));
    assert.equal(failed.status, 503);
    assert.equal((await failed.json()).ok, false);
    assert.equal(documents.get(`${prefix}/events/event-1`).fields.title.stringValue, "Camping1 edited");
    failCommit = false;
    const outsideScope = await save(request({ ...edit, audience: { sectionIds: [], memberIds: ["scout-1"] } }));
    assert.equal(outsideScope.status, 403);
    assert.equal(commits, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
