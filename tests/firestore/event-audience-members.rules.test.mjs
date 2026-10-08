import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, collectionGroup, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";

const projectId = "coolock-ardlea-scouts";
let testEnv;

async function seed(entries) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const [path, data] of entries) await setDoc(doc(context.firestore(), path), data);
  });
}

function eventAudience(mode = "members", sectionIds = []) {
  return { version: 3, mode, semantics: "snapshot", sectionIds, memberIds: [], resolvedMemberIds: [] };
}

function eventRecord(section = "Cubs", mode = "members", sectionIds = []) {
  return {
    title: "Selected Cubs event",
    description: "",
    eventType: "Camp",
    section,
    startDate: "2099-05-10",
    endDate: "2099-05-11",
    status: "open",
    consentRequired: false,
    audience: eventAudience(mode, sectionIds),
    createdBy: "leader-cubs",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: "leader-cubs",
  };
}

function membership(eventId, memberId, scopeSection, extras = {}) {
  return {
    eventId,
    eventSection: "Cubs",
    memberId,
    scopeSection,
    selectedBySection: false,
    selectedIndividually: true,
    updatedAt: serverTimestamp(),
    updatedBy: "leader-cubs",
    ...extras,
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

test("a leader can invite an active member from another section in their own authorised scope", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs", "Scouts"] }],
    ["members/member-scout", { status: "active", section: "Scouts", sections: ["Scouts"] }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs").firestore();
  const batch = writeBatch(db);
  batch.set(doc(db, "events/event-1"), eventRecord());
  batch.set(doc(db, "events/event-1/audienceMembers/member-scout"), membership("event-1", "member-scout", "Scouts"));
  await assertSucceeds(batch.commit());
});

test("Firestore rejects inactive and out-of-scope selected members", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs"] }],
    ["members/member-scout", { status: "active", section: "Scouts", sections: ["Scouts"] }],
    ["members/member-inactive", { status: "inactive", section: "Cubs", sections: ["Cubs"] }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs").firestore();

  const outOfScope = writeBatch(db);
  outOfScope.set(doc(db, "events/event-out-of-scope"), eventRecord("Cubs", "members", []));
  outOfScope.set(doc(db, "events/event-out-of-scope/audienceMembers/member-scout"), membership("event-out-of-scope", "member-scout", "Scouts"));
  await assertFails(outOfScope.commit());

  const inactive = writeBatch(db);
  inactive.set(doc(db, "events/event-inactive"), eventRecord("Cubs", "members", []));
  inactive.set(doc(db, "events/event-inactive/audienceMembers/member-inactive"), membership("event-inactive", "member-inactive", "Cubs"));
  await assertFails(inactive.commit());
});

test("a multi-section member has one deduplicated audience record", async () => {
  await seed([
    ["adminUsers/leader-cubs", { active: true, role: "leader", sections: ["Cubs", "Scouts"] }],
    ["members/member-multi", { status: "active", section: "Cubs", sections: ["Cubs", "Scouts"] }],
  ]);
  const db = testEnv.authenticatedContext("leader-cubs").firestore();
  const batch = writeBatch(db);
  batch.set(doc(db, "events/event-multi"), eventRecord("Cubs", "sections", ["Cubs", "Scouts"]));
  batch.set(doc(db, "events/event-multi/audienceMembers/member-multi"), membership("event-multi", "member-multi", "Cubs", {
    selectedBySection: true,
    selectedIndividually: true,
  }));
  await assertSucceeds(batch.commit());
  const audience = await assertSucceeds(getDocs(query(
    collection(db, "events/event-multi/audienceMembers"),
    where("eventId", "==", "event-multi"),
  )));
  if (audience.size !== 1) throw new Error(`Expected one record for the multi-section member, received ${audience.size}.`);
});

test("only an approved linked parent can read their active child's event audience record", async () => {
  await seed([
    ["parentAccounts/parent-cub", { status: "approved", memberIds: ["member-cub"], linkedSections: ["Cubs"] }],
    ["parentAccounts/parent-other", { status: "approved", memberIds: ["member-scout"], linkedSections: ["Scouts"] }],
    ["parentAccounts/parent-pending", { status: "pending", memberIds: ["member-cub"], linkedSections: ["Cubs"] }],
    ["members/member-cub", { status: "active", section: "Cubs", sections: ["Cubs"] }],
    ["members/member-scout", { status: "active", section: "Scouts", sections: ["Scouts"] }],
    ["events/event-1", eventRecord()],
    ["events/event-1/audienceMembers/member-cub", { ...membership("event-1", "member-cub", "Cubs"), selectedBySection: true, selectedIndividually: false }],
  ]);
  const parentDb = testEnv.authenticatedContext("parent-cub").firestore();
  const otherDb = testEnv.authenticatedContext("parent-other").firestore();
  const pendingDb = testEnv.authenticatedContext("parent-pending").firestore();

  await assertSucceeds(getDoc(doc(parentDb, "events/event-1/audienceMembers/member-cub")));
  await assertFails(getDoc(doc(otherDb, "events/event-1/audienceMembers/member-cub")));
  await assertFails(getDoc(doc(pendingDb, "events/event-1/audienceMembers/member-cub")));
});

test("selected-event consent-link lists require a matching server-authorized audience record", async () => {
  await seed([
    ["parentAccounts/parent-cub", { status: "approved", memberIds: ["member-cub"], linkedSections: ["Cubs"] }],
    ["parentAccounts/parent-other", { status: "approved", memberIds: ["member-scout"], linkedSections: ["Scouts"] }],
    ["members/member-cub", { status: "active", section: "Cubs", sections: ["Cubs"] }],
    ["events/event-1", eventRecord()],
    ["events/event-1/audienceMembers/member-cub", { ...membership("event-1", "member-cub", "Cubs"), selectedBySection: true, selectedIndividually: false }],
    ["eventConsentLinks/link-1", {
      token: "link-1", eventId: "event-1", title: "Selected Cubs event", eventType: "Camp", section: "Cubs",
      startDate: "2099-05-10", endDate: "2099-05-11", active: true, audienceVersion: 3,
      audienceMemberIds: ["member-cub"],
    }],
    ["eventConsentLinks/link-legacy", {
      token: "link-legacy", eventId: "event-legacy", title: "Legacy Cubs event", eventType: "Camp", section: "Cubs",
      startDate: "2099-05-12", endDate: "2099-05-13", active: true, audienceVersion: 2,
      audienceMemberIds: ["member-cub"],
    }],
  ]);
  const parentDb = testEnv.authenticatedContext("parent-cub").firestore();
  const otherDb = testEnv.authenticatedContext("parent-other").firestore();

  const audience = await assertSucceeds(getDocs(query(
    collectionGroup(parentDb, "audienceMembers"),
    where("memberId", "in", ["member-cub"]),
  )));
  if (audience.size !== 1) throw new Error(`Expected one linked-parent event audience record, received ${audience.size}.`);
  await assertSucceeds(getDoc(doc(parentDb, "events/event-1")));
  await assertFails(getDoc(doc(otherDb, "events/event-1")));
  const legacyLinks = await assertSucceeds(getDocs(query(
    collection(parentDb, "eventConsentLinks"),
    where("active", "==", true),
    where("audienceVersion", "==", 2),
    where("section", "in", ["Cubs", "Group", "All Sections"]),
  )));
  if (legacyLinks.size !== 1 || legacyLinks.docs[0].id !== "link-legacy") throw new Error("Legacy parent event links remain available to the linked account.");
  await assertFails(getDocs(query(
    collection(otherDb, "eventConsentLinks"),
    where("active", "==", true),
    where("audienceVersion", "==", 2),
    where("section", "in", ["Scouts"]),
  )));
  await assertFails(getDocs(query(
    collectionGroup(otherDb, "audienceMembers"),
    where("memberId", "in", ["member-cub"]),
  )));
});
