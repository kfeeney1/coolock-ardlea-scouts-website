import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { handleProductionRoute } from "../src/productionRoutes.js";

function encode(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
function idToken(uid) { return `${encode({ alg: "none", typ: "JWT" })}.${encode({ user_id: uid, sub: uid })}.signature`; }
function stringValue(value) { return { stringValue: value }; }
function booleanValue(value) { return { booleanValue: value }; }
function arrayValue(values) { return { arrayValue: { values: values.map(stringValue) } }; }
function mapValue(value) { return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === "boolean" ? booleanValue(item) : stringValue(item)])) } }; }
function appointmentDocument(appointments, scoutingRole = "Programme Scouter", organisationSection = "Cubs") {
  return {
    name: "projects/demo/databases/(default)/documents/organisationLeadership/leader-1",
    fields: {
      active: booleanValue(true),
      scoutingRole: stringValue(scoutingRole),
      organisationSection: stringValue(organisationSection),
      appointments: { arrayValue: { values: appointments.map(mapValue) } }
    }
  };
}
function memberDocument(id, section, status = "active") {
  return {
    name: `projects/demo/databases/(default)/documents/members/${id}`,
    fields: { section: stringValue(section), sections: arrayValue([section]), status: stringValue(status) }
  };
}

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const leader = {
  name: "projects/demo/databases/(default)/documents/adminUsers/leader-1",
  fields: {
    active: booleanValue(true),
    role: stringValue("leader"),
    sections: arrayValue(["Beavers", "Cubs"])
  }
};

function makeEnvironment(memberDocs, commits, leadership = null, profile = leader) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") {
      return Response.json({ access_token: "service-token", expires_in: 3600 });
    }
    if (url.endsWith("/adminUsers/leader-1")) return Response.json(profile);
    if (url.endsWith("/organisationLeadership/leader-1")) return leadership ? Response.json(leadership) : new Response("", { status: 404 });
    if (url.includes("/members?pageSize=100")) return Response.json({ documents: memberDocs });
    if (url.endsWith("/events/event-new")) return new Response("{}", { status: 404 });
    if (url.endsWith("/documents:commit")) {
      commits.push(JSON.parse(init.body));
      return Response.json({ writeResults: [] });
    }
    throw new Error(`Unexpected fetch ${init.method || "GET"} ${url}`);
  };
  return () => { globalThis.fetch = originalFetch; };
}

test("Programme Scouter event save accepts only active appointment sections", async () => {
  const commits = [];
  const assignedCubs = appointmentDocument([
    { appointment: "Programme Scouter", scope: "Cubs", active: true },
    { appointment: "Programme Scouter", scope: "Scouts", active: false }
  ]);
  const scopedLeader = {
    ...leader,
    fields: { ...leader.fields, sections: arrayValue(["Group"]) }
  };
  const originalFetch = globalThis.fetch;
  const members = [memberDocument("cub-1", "Cubs"), memberDocument("scout-1", "Scouts")];
  const restoreFetch = makeEnvironment(members, commits, assignedCubs);
  // Keep the system role active while exercising appointment-only section scope.
  const currentFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    if (String(input).endsWith("/adminUsers/leader-1")) return Response.json(scopedLeader);
    return currentFetch(input, init);
  };
  try {
    const body = {
      operation: "create",
      eventId: "event-new",
      input: { ...eventInput(), section: "Cubs" },
      audience: { sectionIds: ["Cubs"], memberIds: [] }
    };
    const response = await handleProductionRoute(request(body), {
      FIREBASE_PROJECT_ID: "demo",
      FIREBASE_SERVICE_ACCOUNT_EMAIL: "firebase-adminsdk@demo.iam.gserviceaccount.com",
      FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: privatePem
    }, body, "/event-audience-save");

    assert.equal(response.status, 200);
    assert.equal((await response.json()).invitedCount, 1);
    assert.equal(commits.length, 1);
  } finally {
    restoreFetch();
    globalThis.fetch = originalFetch;
  }
});

test("Programme Scouter cannot save events outside active appointment scope", async () => {
  const commits = [];
  const assignedCubs = appointmentDocument([
    { appointment: "Programme Scouter", scope: "Cubs", active: true },
    { appointment: "Programme Scouter", scope: "Scouts", active: false }
  ]);
  const scopedLeader = { ...leader, fields: { ...leader.fields, sections: arrayValue(["Group"]) } };
  const originalFetch = globalThis.fetch;
  const restoreFetch = makeEnvironment([memberDocument("scout-1", "Scouts")], commits, assignedCubs);
  const currentFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    if (String(input).endsWith("/adminUsers/leader-1")) return Response.json(scopedLeader);
    return currentFetch(input, init);
  };
  try {
    const body = {
      operation: "create",
      eventId: "event-new",
      input: { ...eventInput(), section: "Scouts" },
      audience: { sectionIds: [], memberIds: ["scout-1"] }
    };
    const response = await handleProductionRoute(request(body), {
      FIREBASE_PROJECT_ID: "demo",
      FIREBASE_SERVICE_ACCOUNT_EMAIL: "firebase-adminsdk@demo.iam.gserviceaccount.com",
      FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: privatePem
    }, body, "/event-audience-save");

    assert.equal(response.status, 403);
    assert.equal(commits.length, 0);
  } finally {
    restoreFetch();
    globalThis.fetch = originalFetch;
  }
});

test("an inactive leader profile is denied before event audience writes", async () => {
  const commits = [];
  const inactiveLeader = {
    ...leader,
    fields: { ...leader.fields, active: booleanValue(false) }
  };
  const originalFetch = globalThis.fetch;
  const restoreFetch = makeEnvironment([], commits, null, inactiveLeader);
  try {
    const body = {
      operation: "create",
      eventId: "event-new",
      input: eventInput(),
      audience: { sectionIds: ["Beavers"], memberIds: [] }
    };
    const response = await handleProductionRoute(request(body), {
      FIREBASE_PROJECT_ID: "demo",
      FIREBASE_SERVICE_ACCOUNT_EMAIL: "firebase-adminsdk@demo.iam.gserviceaccount.com",
      FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: privatePem
    }, body, "/event-audience-save");

    assert.equal(response.status, 403);
    assert.equal(commits.length, 0);
  } finally {
    restoreFetch();
    globalThis.fetch = originalFetch;
  }
});

function request(body) {
  return new Request("https://worker.example.test/event-audience-save", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken("leader-1")}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function eventInput() {
  return {
    title: "Cross section weekend",
    description: "",
    eventType: "Camp",
    section: "Beavers",
    location: "Scout den",
    meetingPoint: "Main gate",
    returnDetails: "",
    leaderNotes: "",
    startDate: "2099-05-10",
    endDate: "2099-05-10",
    status: "open",
    consentRequired: false
  };
}

test("event audience save validates scope and commits Group-sized audiences atomically", async () => {
  const commits = [];
  const members = Array.from({ length: 28 }, (_, index) => memberDocument(`member-${index + 1}`, index < 14 ? "Beavers" : "Cubs"));
  const restoreFetch = makeEnvironment(members, commits);
  try {
    const response = await handleProductionRoute(request({
      operation: "create",
      eventId: "event-new",
      input: { ...eventInput(), consentRequired: true },
      audience: { sectionIds: ["Beavers", "Cubs"], memberIds: [] }
    }), {
      FIREBASE_PROJECT_ID: "demo",
      FIREBASE_SERVICE_ACCOUNT_EMAIL: "firebase-adminsdk@demo.iam.gserviceaccount.com",
      FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: privatePem
    }, {
      operation: "create",
      eventId: "event-new",
      input: eventInput(),
      audience: { sectionIds: ["Beavers", "Cubs"], memberIds: [] }
    }, "/event-audience-save");

    assert.equal(response.status, 200);
    assert.equal((await response.json()).invitedCount, 28);
    assert.equal(commits.length, 1);
    assert.equal(commits[0].writes.length, 31);
    assert.equal(commits[0].writes[0].update.name.endsWith("/events/event-new"), true);
    const programme = commits[0].writes.find(write => write.update?.name.endsWith("/programmes/parent"));
    assert.ok(programme, "Audience-safe programme must commit with the event");
    assert.equal(programme.update.fields.leaderNotes, undefined);
    assert.equal(programme.update.fields.attendance, undefined);
    const membershipWrite = commits[0].writes.find(write => write.update?.name.includes("/audienceMembers/"));
    assert.equal(membershipWrite.update.fields.startDate.stringValue, eventInput().startDate);
    assert.equal(membershipWrite.update.fields.programmeVisible.booleanValue, true);
    const storedAudience = commits[0].writes[0].update.fields.audience.mapValue.fields;
    assert.equal(storedAudience.version.integerValue, "3");
    assert.deepEqual(storedAudience.sectionIds.arrayValue.values.map((value) => value.stringValue), ["Beavers", "Cubs"]);
    assert.deepEqual(storedAudience.resolvedMemberIds.arrayValue.values, []);
  } finally {
    restoreFetch();
  }
});

test("event audience save rejects a crafted out-of-scope member ID before writing", async () => {
  const commits = [];
  const restoreFetch = makeEnvironment([memberDocument("member-scout", "Scouts")], commits);
  try {
    const body = {
      operation: "create",
      eventId: "event-new",
      input: eventInput(),
      audience: { sectionIds: [], memberIds: ["member-scout"] }
    };
    const response = await handleProductionRoute(request(body), {
      FIREBASE_PROJECT_ID: "demo",
      FIREBASE_SERVICE_ACCOUNT_EMAIL: "firebase-adminsdk@demo.iam.gserviceaccount.com",
      FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: privatePem
    }, body, "/event-audience-save");
    assert.equal(response.status, 403);
    assert.equal(commits.length, 0);
  } finally {
    restoreFetch();
  }
});

test("event audience edit preserves RSVP and consent history in the atomic commit", async () => {
  const commits = [];
  const originalFetch = globalThis.fetch;
  const existingEvent = {
    name: "projects/demo/databases/(default)/documents/events/event-existing",
    updateTime: "2026-10-11T09:00:00.000Z",
    fields: {
      createdBy: stringValue("leader-1"),
      title: stringValue("Cross section weekend"),
      section: stringValue("Beavers"),
      status: stringValue("open"),
      consentRequired: booleanValue(true),
      attendance: { mapValue: { fields: { "member-1": stringValue("attending") } } },
      consent: { mapValue: { fields: { "member-1": stringValue("received") } } }
    }
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "service-token", expires_in: 3600 });
    if (url.endsWith("/adminUsers/leader-1")) return Response.json(leader);
    if (url.endsWith("/organisationLeadership/leader-1")) return new Response("", { status: 404 });
    if (url.includes("/members?pageSize=100")) return Response.json({ documents: [memberDocument("member-1", "Beavers"), memberDocument("member-2", "Beavers")] });
    if (url.endsWith("/events/event-existing")) return Response.json(existingEvent);
    if (url.includes("/events/event-existing/audienceMembers?pageSize=100")) return Response.json({ documents: [{
      name: "projects/demo/databases/(default)/documents/events/event-existing/audienceMembers/member-1",
      updateTime: "2026-10-11T09:00:00.000Z",
      fields: { eventId: stringValue("event-existing"), memberId: stringValue("member-1") }
    }] });
    if (url.endsWith("/documents:commit")) {
      commits.push(JSON.parse(init.body));
      return Response.json({ writeResults: [] });
    }
    throw new Error(`Unexpected fetch ${init.method || "GET"} ${url}`);
  };
  try {
    const body = {
      operation: "update",
      eventId: "event-existing",
      input: { ...eventInput(), consentRequired: true },
      audience: { sectionIds: [], memberIds: ["member-1", "member-2"] }
    };
    const response = await handleProductionRoute(request(body), {
      FIREBASE_PROJECT_ID: "demo",
      FIREBASE_SERVICE_ACCOUNT_EMAIL: "firebase-adminsdk@demo.iam.gserviceaccount.com",
      FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: privatePem
    }, body, "/event-audience-save");
    assert.equal(response.status, 200);
    assert.equal(commits.length, 1);
    assert.equal(commits[0].writes.length, 5);
    assert.equal(commits[0].writes[0].currentDocument.updateTime, existingEvent.updateTime);
    const fields = commits[0].writes[0].update.fields;
    assert.equal(fields.attendance.mapValue.fields["member-1"].stringValue, "attending");
    assert.equal(fields.consent.mapValue.fields["member-1"].stringValue, "received");
    assert.equal(fields.attendance.mapValue.fields["member-2"].stringValue, "invited");
    assert.equal(fields.consent.mapValue.fields["member-2"].stringValue, "required");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("hall-marked backend event updates reject schedule bypass and preserve marker with an updateTime lease", async () => {
  const commits = [], input = eventInput();
  const originalFetch = globalThis.fetch;
  const fields = Object.fromEntries(Object.entries(input).filter(([, value]) => typeof value === "string").map(([key, value]) => [key, stringValue(value)]));
  const existing = {name: "projects/demo/databases/(default)/documents/events/event-existing", updateTime: "2026-10-30T12:00:00.000Z", fields: {...fields, hallResource: stringValue("group-hall"), hallRevision: {integerValue: "1"}, consentRequired: booleanValue(false)}};
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url === "https://oauth2.googleapis.com/token") return Response.json({access_token: "service-token", expires_in: 3600});
    if (url.endsWith("/adminUsers/leader-1")) return Response.json(leader);
    if (url.endsWith("/organisationLeadership/leader-1")) return new Response("", {status: 404});
    if (url.includes("/members?pageSize=100")) return Response.json({documents: [memberDocument("member-1", "Beavers")]});
    if (url.endsWith("/events/event-existing")) return Response.json(existing);
    if (url.includes("/events/event-existing/audienceMembers?pageSize=100")) return Response.json({documents: []});
    if (url.endsWith("/documents:commit")) {commits.push(JSON.parse(init.body)); return Response.json({writeResults: []});}
    throw new Error(`Unexpected request ${url}`);
  };
  const env = {FIREBASE_PROJECT_ID: "demo", FIREBASE_SERVICE_ACCOUNT_EMAIL: "firebase-adminsdk@demo.iam.gserviceaccount.com", FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: privatePem};
  try {
    for (const change of [{startDate: "2099-05-09"}, {endDate: "2099-05-11"}, {section: "Cubs"}]) {
      const body = {operation: "update", eventId: "event-existing", input: {...input, ...change}, audience: {sectionIds: ["Beavers"], memberIds: []}};
      const response = await handleProductionRoute(request(body), env, body, "/event-audience-save");
      assert.equal(response.status, 409); assert.equal(commits.length, 0);
    }
    const body = {operation: "update", eventId: "event-existing", input: {...input, title: "Ordinary programme change"}, audience: {sectionIds: ["Beavers"], memberIds: []}};
    const response = await handleProductionRoute(request(body), env, body, "/event-audience-save");
    assert.equal(response.status, 200); assert.equal(commits.length, 1);
    const write = commits[0].writes[0]; assert.equal(write.currentDocument.updateTime, existing.updateTime);
    assert.equal(write.updateMask.fieldPaths.includes("hallResource"), false); assert.equal(write.update.fields.hallResource, undefined);
    assert.equal(write.updateMask.fieldPaths.includes("hallRevision"), false);
  } finally {globalThis.fetch = originalFetch;}
});
