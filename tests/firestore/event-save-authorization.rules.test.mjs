import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seedDocuments(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const [path, data] of entries) await setDoc(doc(context.firestore(), path), data);
  });
}

function eventRecord(uid, section) {
  return {
    title: "Programme Scouter event",
    description: "",
    eventType: "Activity",
    section,
    location: "",
    meetingPoint: "",
    returnDetails: "",
    leaderNotes: "",
    startDate: "2026-11-01",
    endDate: "2026-11-01",
    status: "open",
    consentRequired: false,
    audience: {
      version: 3,
      mode: "sections",
      semantics: "snapshot",
      sectionIds: [section],
      memberIds: [],
      resolvedMemberIds: []
    },
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080
    }
  });
});

beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

test("Programme Scouter can reopen an appointment-scoped event and save its projections", async () => {
  const event = {
    ...eventRecord("programme-cubs", "Cubs"),
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z")
  };
  const membership = {
    eventId: "programme-cubs-event",
    eventSection: "Cubs",
    memberId: "cub-1",
    scopeSection: "Cubs",
    selectedBySection: true,
    selectedIndividually: false,
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedBy: "programme-cubs"
  };
  await seedDocuments([
    ["adminUsers/programme-cubs", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/programme-cubs", {
      active: true,
      scoutingRole: "Programme Scouter",
      organisationSection: "Cubs",
      appointments: [
        { appointment: "Group Scout Leader", scope: "Group", active: true },
        { appointment: "Programme Scouter", scope: "Scouts", active: false },
        { appointment: "Group President", scope: "Group", active: true },
        { appointment: "Assistant Group Scout Leader", scope: "Group", active: true },
        { appointment: "Programme Scouter", scope: "Scouts", active: false },
        { appointment: "Programme Scouter", scope: "Cub Scouts", active: true },
        { appointment: "Programme Scouter", scope: "Scouts", active: false }
      ]
    }],
    ["members/cub-1", { status: "active", section: "Cubs", sections: ["Cubs"] }],
    ["events/programme-cubs-event", event],
    ["events/programme-cubs-event/audienceMembers/cub-1", membership]
  ]);
  const db = testEnv.authenticatedContext("programme-cubs").firestore();
  const eventRef = doc(db, "events/programme-cubs-event");
  await assertSucceeds(getDoc(eventRef));
  await assertSucceeds(getDoc(doc(db, "events/programme-cubs-event/audienceMembers/cub-1")));

  const publicProjection = {
    eventId: "programme-cubs-event",
    title: "Programme Scouter event",
    description: "",
    eventType: "Activity",
    section: "Cubs",
    location: "",
    startDate: "2026-11-01",
    endDate: "2026-11-01",
    updatedAt: serverTimestamp()
  };
  await assertSucceeds(setDoc(doc(db, "publicEvents/programme-cubs-event"), publicProjection));
  await assertSucceeds(setDoc(doc(db, "parentGalleryEvents/programme-cubs-event"), {
    ...publicProjection,
    status: "open"
  }));
  await assertSucceeds(deleteDoc(doc(db, "publicEvents/programme-cubs-event")));
  await assertSucceeds(deleteDoc(doc(db, "parentGalleryEvents/programme-cubs-event")));

  await assertFails(setDoc(doc(db, "events/programme-cubs-direct-write"), eventRecord("programme-cubs", "Cubs")));
  const reopened = await assertSucceeds(getDoc(eventRef));
  assert.equal(reopened.data().title, "Programme Scouter event");
});

test("Programme Scouter remains denied for an unassigned event section", async () => {
  await seedDocuments([
    ["adminUsers/programme-cubs", { active: true, role: "leader", sections: ["Group"] }],
    ["organisationLeadership/programme-cubs", {
      active: true,
      scoutingRole: "Programme Scouter",
      organisationSection: "Cubs",
      appointments: [{ appointment: "Programme Scouter", scope: "Cubs", active: true }]
    }]
  ]);
  const db = testEnv.authenticatedContext("programme-cubs").firestore();
  await assertFails(setDoc(doc(db, "events/programme-scouts-event"), eventRecord("programme-cubs", "Scouts")));
});

test("a leader with no section appointment cannot save an event outside profile sections", async () => {
  await seedDocuments([
    ["adminUsers/ordinary-leader", { active: true, role: "leader", sections: ["Beavers"] }],
    ["organisationLeadership/ordinary-leader", {
      active: true,
      scoutingRole: "Programme Scouter",
      organisationSection: "Cubs",
      appointments: [{ appointment: "Programme Scouter", scope: "Cubs", active: false }]
    }]
  ]);
  const db = testEnv.authenticatedContext("ordinary-leader").firestore();
  await assertFails(setDoc(doc(db, "events/unauthorized-event"), eventRecord("ordinary-leader", "Cubs")));
});
