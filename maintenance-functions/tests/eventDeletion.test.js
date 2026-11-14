import test from "node:test";
import assert from "node:assert/strict";
import { isCanonicalSuperAdmin, handleEventDeletion, commitCleanEventDeletion, EVENT_DELETION_EVIDENCE_COLLECTIONS } from "../src/eventDeletion.js";

test("only active canonical Super Admin is authorised", () => {
  assert.equal(isCanonicalSuperAdmin({ active: true, role: "super-admin", sections: ["Group"] }), true);
  for (const profile of [
    { active: false, role: "super-admin", sections: ["Group"] },
    { active: true, role: "admin", sections: ["Group"] },
    { active: true, role: "leader", sections: ["Group"] },
    { active: true, role: "super-admin", sections: [] },
    { active: true, role: "super-admin", sections: [""] },
    { active: true, role: "super-admin", sections: ["Group", null] },
    { active: true, role: "super-admin", sections: [" Group "] },
    { active: true, role: "super-admin", sections: ["Group"], section: "Group" },
    null
  ]) assert.equal(isCanonicalSuperAdmin(profile), false);
});

test("crafted requests from non-Super Admin are denied before event lookup", async () => {
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    assert.equal(path, "adminUsers/attacker");
    return { get: async () => ({ data: () => ({ active: true, role: "admin", sections: ["Group"] }) }) };
  } };
  await assert.rejects(handleEventDeletion(db, {}, { auth: { uid: "attacker" }, data: { action: "delete", eventId: "test-event" } }), /Super Admin access required/);
});

for (const status of ["open", "closed", "planned", "cancelled"]) {
  test(`callable deletes a clean ${status} event and its projections, then acknowledges a retry`, async () => {
  const revision = 1794400000000;
  const documents = new Map([
    ["adminUsers/root", { active: true, role: "super-admin", sections: ["Group"] }],
    ["events/old-event", { title: "Old event", section: "Cubs", status, attendance: {}, consent: {} }],
    ["publicEvents/old-event", {}],
    ["parentGalleryEvents/old-event", {}]
  ]);
  let eventRevision = revision;
  const empty = { empty: true, size: 0, get: async () => empty };
  const collection = { where: () => collection, limit: () => empty };
  const db = {
    collection: () => collection,
    doc: path => ({
      path,
      get: async () => {
        const data = documents.get(path);
        const millis = eventRevision;
        return { exists: !!data, data: () => data, updateTime: {
          toMillis: () => millis, isEqual: other => millis === other.toMillis()
        } };
      },
      listCollections: async () => [],
      collection: () => collection
    }),
    runTransaction: async work => {
      const writes = [];
      const result = await work({
        get: ref => ref.get(),
        update: (ref, fields) => writes.push(() => {
          documents.set(ref.path, { ...documents.get(ref.path), ...fields });
          eventRevision += 1;
        }),
        create: (ref, data) => writes.push(() => documents.set(ref.path, data)),
        delete: ref => writes.push(() => documents.delete(ref.path))
      });
      for (const write of writes) write();
      return result;
    }
  };
  const bucket = { getFiles: async () => [[]] };
  const auth = { auth: { uid: "root" }, data: { action: "delete", eventId: "old-event", confirmTitle: "Old event", revision, confirmation: "DELETE EVENT" } };
  assert.deepEqual(await handleEventDeletion(db, bucket, auth), { eventId: "old-event", deleted: true });
  for (const path of ["events/old-event", "publicEvents/old-event", "parentGalleryEvents/old-event"]) {
    assert.equal(documents.has(path), false);
  }
  const audit = documents.get("eventDeletionAudits/old-event");
  assert.equal(audit.eventLifecycle.status, status);
  assert.equal(audit.actorUid, "root");
  assert.equal(audit.revision, revision);
  assert.deepEqual(await handleEventDeletion(db, bucket, auth), { eventId: "old-event", deleted: true });
  assert.equal(documents.get("eventDeletionAudits/old-event"), audit);
  });
}
test("unauthenticated deletion is denied without any database access", async () => {
  await assert.rejects(handleEventDeletion({ doc: () => { throw new Error("database accessed"); } }, {}, { data: { action: "delete", eventId: "test" } }), /Sign in as Super Admin/);
});

test("inspection identifies hall and member audience evidence without allowing deletion", async () => {
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    if (path === "publicEvents/linked" || path === "parentGalleryEvents/linked") return { get: async () => ({ exists: false }) };
    assert.equal(path, "events/linked");
    return {
      get: async () => ({ exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Linked", section: "Cubs", hallResource: "group-hall", audience: { memberIds: ["member-1"] } }) }),
      listCollections: async () => [],
      collection: () => ({ limit: () => ({ get: async () => ({ empty: true }) }) })
    };
  } };
  const bucket = { getFiles: async () => [[]] };
  const request = { auth: { uid: "root" }, data: { action: "inspect", eventId: "linked" } };
  const inspection = await handleEventDeletion(db, bucket, request);
  assert.ok(inspection.blockers.includes("hall booking association"));
  assert.ok(inspection.blockers.includes("member audience evidence"));
  await assert.rejects(handleEventDeletion(db, bucket, { ...request, data: { action: "delete", eventId: "linked", confirmTitle: "Linked", revision: 1794400000000, confirmation: "DELETE EVENT" } }), /Deletion is blocked/);
});

test("malformed event identifiers are rejected before any event document read", async () => {
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    assert.equal(path, "adminUsers/root");
    return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
  } };
  for (const eventId of ["../other", "event/name", "", "a".repeat(129), null, 42]) {
    await assert.rejects(
      handleEventDeletion(db, {}, { auth: { uid: "root" }, data: { action: "delete", eventId } }),
      /Invalid event deletion request/
    );
  }
});

test("nonexistent events cannot be deleted", async () => {
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    if (path === "eventDeletionAudits/missing") return { get: async () => ({ data: () => undefined }) };
    assert.equal(path, "events/missing");
    return { get: async () => ({ exists: false }) };
  } };
  await assert.rejects(
    handleEventDeletion(db, {}, { auth: { uid: "root" }, data: { action: "delete", eventId: "missing", confirmTitle: "Missing", revision: 1794400000000, confirmation: "DELETE EVENT" } }),
    /Event no longer exists/
  );
});

test("inspection fails closed when Firestore revision is missing", async () => {
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    assert.equal(path, "events/legacy");
    return { get: async () => ({ exists: true, data: () => ({ title: "Legacy", section: "Cubs" }) }) };
  } };
  await assert.rejects(
    handleEventDeletion(db, {}, { auth: { uid: "root" }, data: { action: "inspect", eventId: "legacy" } }),
    /Event revision unavailable/
  );
});

test("deletion refuses stale revisions, mismatched titles and absent deliberate confirmation", async () => {
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    if (path === "publicEvents/event" || path === "parentGalleryEvents/event") return { get: async () => ({ exists: false }) };
    assert.equal(path, "events/event");
    return {
      get: async () => ({ exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Actual event", section: "Cubs" }) }),
      listCollections: async () => [],
      collection: () => ({ limit: () => ({ get: async () => ({ empty: true }) }) })
    };
  } };
  const bucket = { getFiles: async () => [[]] };
  const base = { action: "delete", eventId: "event", confirmTitle: "Actual event", revision: 1794400000000, confirmation: "DELETE EVENT" };
  for (const changes of [{ revision: 1794399999999 }, { confirmTitle: "Another event" }, { confirmation: "" }]) {
    await assert.rejects(
      handleEventDeletion(db, bucket, { auth: { uid: "root" }, data: { ...base, ...changes } }),
      /Refresh the review and confirm/
    );
  }
});

test("gallery inventory reports exact small counts and bounded larger counts", async () => {
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    if (path === "publicEvents/gallery" || path === "parentGalleryEvents/gallery") return { get: async () => ({ exists: false }) };
    assert.equal(path, "events/gallery");
    return {
      get: async () => ({ exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Gallery", section: "Cubs" }) }),
      listCollections: async () => [],
      collection: () => ({ limit: () => ({ get: async () => ({ empty: true }) }) })
    };
  } };
  let photoCount = 3;
  const bucket = { getFiles: async (options) => {
    assert.equal(options.maxResults, 101);
    assert.equal(options.prefix, "attachments/event-gallery/Cubs/gallery/");
    return [Array.from({ length: photoCount }, (_, i) => ({ name: String(i) }))];
  } };
  const request = { auth: { uid: "root" }, data: { action: "inspect", eventId: "gallery" } };
  const small = await handleEventDeletion(db, bucket, request);
  assert.equal(small.photoCount, 3);
  assert.equal(small.photoCountIsMinimum, false);
  photoCount = 101;
  const large = await handleEventDeletion(db, bucket, request);
  assert.equal(large.photoCount, 100);
  assert.equal(large.photoCountIsMinimum, true);
  assert.ok(large.blockers.some(value => value.includes("more than 100")));
});

test("inspection reports linked subcollection record counts without deleting anything", async () => {
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    if (path === "publicEvents/linked-count" || path === "parentGalleryEvents/linked-count") return { get: async () => ({ exists: false }) };
    assert.equal(path, "events/linked-count");
    return {
      get: async () => ({ exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Linked", section: "Cubs" }) }),
      listCollections: async () => [],
      collection: (name) => ({ limit: (count) => {
        assert.equal(count, 101);
        return { get: async () => ({ size: name === "audienceMembers" ? 2 : name === "programmes" ? 101 : 0 }) };
      } })
    };
  } };
  const result = await handleEventDeletion(db, { getFiles: async () => [[]] }, { auth: { uid: "root" }, data: { action: "inspect", eventId: "linked-count" } });
  assert.deepEqual(result.linked.audienceMembers, { count: 2, truncated: false });
  assert.deepEqual(result.linked.programmes, { count: 101, truncated: true });
  assert.ok(result.blockers.includes("audienceMembers (2 linked records)"));
  assert.ok(result.blockers.includes("programmes (more than 100 linked records)"));
});

test("inspection and deletion fail closed for missing persisted event titles", async () => {
  let storageAccessed = false;
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    assert.equal(path, "events/untitled");
    return { get: async () => ({ exists: true, data: () => ({ section: "Cubs" }), updateTime: { toMillis: () => 1794400000000 } }) };
  } };
  const bucket = { getFiles: async () => { storageAccessed = true; return [[]]; } };
  for (const action of ["inspect", "delete"]) {
    await assert.rejects(handleEventDeletion(db, bucket, { auth: { uid: "root" }, data: { action, eventId: "untitled", ...(action === "delete" ? { confirmTitle: "Untitled", revision: 1794400000000, confirmation: "DELETE EVENT" } : {}) } }), /Event title is missing/);
  }
  assert.equal(storageAccessed, false);
});

test("concurrent event edits invalidate inspection and deletion before confirmation", async () => {
  let reads = 0;
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    if (path === "publicEvents/racing" || path === "parentGalleryEvents/racing") return { get: async () => ({ exists: false }) };
    assert.equal(path, "events/racing");
    return {
      get: async () => ({ exists: true, updateTime: { toMillis: () => ++reads === 1 ? 1794400000000 : 1794400000001 }, data: () => ({ title: "Racing event", section: "Cubs" }) }),
      listCollections: async () => [],
      collection: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) })
    };
  } };
  for (const action of ["inspect", "delete"]) {
    reads = 0;
    await assert.rejects(
      handleEventDeletion(db, { getFiles: async () => [[]] }, { auth: { uid: "root" }, data: { action, eventId: "racing", confirmTitle: "Racing event", revision: 1794400000000, confirmation: "DELETE EVENT" } }),
      /Event changed during deletion review/
    );
  }
});

test("malformed persisted sections cannot escape gallery inventory scope", async () => {
  let section = "../other";
  let storageAccessed = false;
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    assert.equal(path, "events/scoped");
    return {
      get: async () => ({ exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Scoped event", section }) }),
      listCollections: async () => [],
      collection: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) })
    };
  } };
  const bucket = { getFiles: async () => { storageAccessed = true; return [[]]; } };
  for (section of ["../other", "Cubs/other", ".", "..", " Cubs", "Cubs ", "Cubs\\\\Other", ""]) {
    await assert.rejects(handleEventDeletion(db, bucket, { auth: { uid: "root" }, data: { action: "inspect", eventId: "scoped" } }), /Invalid event section/);
  }
  assert.equal(storageAccessed, false);
});

test("unknown nested event collections are surfaced as deletion blockers", async () => {
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    if (path === "publicEvents/extra" || path === "parentGalleryEvents/extra") return { get: async () => ({ exists: false }) };
    assert.equal(path, "events/extra");
    return {
      get: async () => ({ exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Extra", section: "Cubs" }) }),
      listCollections: async () => [{ id: "unexpectedHistory" }],
      collection: () => ({ limit: () => ({ get: async () => ({ size: 1 }) }) })
    };
  } };
  const inspection = await handleEventDeletion(db, { getFiles: async () => [[]] }, { auth: { uid: "root" }, data: { action: "inspect", eventId: "extra" } });
  assert.ok(inspection.blockers.includes("event subcollection requires recursive inventory: unexpectedHistory"));
  assert.equal(inspection.linked.unexpectedHistory.count, 1);
});

test("external consent responses are retained and reported as deletion blockers", async () => {
  const db = {
    collection(name) {
      assert.ok(["eventConsentLinks", "eventConsentResponses", "consentApplications", "financeTransactions", "equipmentLoans", "equipmentIncidents", "eventInvitations", "eventNotifications", "calendarEntries"].includes(name));
      return { where(field, op, id) {
        assert.equal(field, "eventId"); assert.equal(op, "=="); assert.equal(id, "consented");
        return { limit: (count) => { assert.equal(count, 101); return { get: async () => ({ size: name === "eventConsentResponses" ? 2 : 1 }) }; } };
      } };
    },
    doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
      if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
      if (path === "publicEvents/consented" || path === "parentGalleryEvents/consented") return { get: async () => ({ exists: false }) };
      assert.equal(path, "events/consented");
      return {
        get: async () => ({ exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Consent event", section: "Cubs" }) }),
        listCollections: async () => [],
        collection: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) })
      };
    }
  };
  const result = await handleEventDeletion(db, { getFiles: async () => [[]] }, { auth: { uid: "root" }, data: { action: "inspect", eventId: "consented" } });
  assert.ok(result.blockers.includes("eventConsentResponses (2 linked records)"));
  assert.ok(result.blockers.includes("eventConsentLinks (1 linked records)"));
});

test("financial and equipment references are reported without deletion", async () => {
  const external = { financeTransactions: 1, equipmentLoans: 2, equipmentIncidents: 1 };
  const db = {
    collection(name) {
      return { where(field, op, id) {
        assert.equal(field, "eventId"); assert.equal(op, "=="); assert.equal(id, "linked");
        return { limit: () => ({ get: async () => ({ size: external[name] ?? 0 }) }) };
      } };
    },
    doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
      if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
      if (path === "publicEvents/linked" || path === "parentGalleryEvents/linked") return { get: async () => ({ exists: false }) };
      assert.equal(path, "events/linked");
      return {
        get: async () => ({ exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Linked event", section: "Cubs" }) }),
        listCollections: async () => [],
        collection: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) })
      };
    }
  };
  const result = await handleEventDeletion(db, { getFiles: async () => [[]] }, { auth: { uid: "root" }, data: { action: "inspect", eventId: "linked" } });
  for (const [name, count] of Object.entries(external)) {
    assert.equal(result.linked[name].count, count);
    assert.ok(result.blockers.some(blocker => blocker.startsWith(name + " (")));
  }
});

test("external calendar, invitation and notification evidence blocks deletion", async () => {
  const counts = { eventInvitations: 2, eventNotifications: 1, calendarEntries: 101 };
  const db = {
    collection(name) {
      return { where(field, operator, value) {
        assert.equal(field, "eventId");
        assert.equal(operator, "==");
        assert.equal(value, "linked");
        return { limit(max) {
          assert.equal(max, 101);
          return { get: async () => ({ size: counts[name] ?? 0 }) };
        } };
      } };
    },
    doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
      if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
      if (path === "publicEvents/linked" || path === "parentGalleryEvents/linked") return { get: async () => ({ exists: false }) };
      assert.equal(path, "events/linked");
      return {
        get: async () => ({ exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Linked", section: "Cubs" }) }),
        listCollections: async () => [],
        collection: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) })
      };
    }
  };
  const request = { auth: { uid: "root" }, data: { action: "inspect", eventId: "linked" } };
  const inspection = await handleEventDeletion(db, { getFiles: async () => [[]] }, request);
  for (const [name, count] of Object.entries(counts)) {
    assert.equal(inspection.linked[name].count, count);
    assert.equal(inspection.linked[name].truncated, count >= 101);
    assert.ok(inspection.blockers.some(blocker => blocker.startsWith(name + " (")));
  }
  await assert.rejects(handleEventDeletion(db, { getFiles: async () => [[]] }, {
    ...request, data: { action: "delete", eventId: "linked", confirmTitle: "Linked", revision: 1794400000000, confirmation: "DELETE EVENT" }
  }), /Deletion is blocked/);
});


test("malformed delete confirmation fails before reading the event or inventory", async () => {
  const db = { doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    throw new Error("event lookup must not happen");
  } };
  for (const changes of [
    { confirmation: "" }, { revision: "123" }, { revision: 0 }, { confirmTitle: "" }
  ]) {
    await assert.rejects(handleEventDeletion(db, { getFiles: () => { throw new Error("storage accessed"); } }, {
      auth: { uid: "root" }, data: { action: "delete", eventId: "event", confirmTitle: "Event", revision: 123, confirmation: "DELETE EVENT", ...changes }
    }), /Refresh the review and confirm/);
  }
});


test("gallery access grants outside the event document block deletion", async () => {
  const revision = 1794400000000;
  const db = {
    collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }),
    doc(path) {
      if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
      if (path === "publicEvents/gallery-grants" || path === "parentGalleryEvents/gallery-grants") return { get: async () => ({ exists: false }) };
      if (path === "eventGalleryAccess/gallery-grants") return {
        get: async () => ({ exists: true }),
        listCollections: async () => [{
          id: "parents",
          limit: count => {
            assert.equal(count, 101);
            return { get: async () => ({ size: 2 }) };
          }
        }]
      };
      assert.equal(path, "events/gallery-grants");
      return {
        get: async () => ({ exists: true, updateTime: { toMillis: () => revision }, data: () => ({ title: "Gallery grants", section: "Cubs" }) }),
        listCollections: async () => [],
        collection: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) })
      };
    }
  };
  const request = { auth: { uid: "root" }, data: { action: "inspect", eventId: "gallery-grants" } };
  const inspection = await handleEventDeletion(db, { getFiles: async () => [[]] }, request);
  assert.ok(inspection.blockers.includes("event gallery access root"));
  assert.ok(inspection.blockers.includes("event gallery access parents (2 linked records)"));
  assert.deepEqual(inspection.linked["eventGalleryAccess/parents"], { count: 2, truncated: false });
  await assert.rejects(handleEventDeletion(db, { getFiles: async () => [[]] }, {
    ...request, data: { action: "delete", eventId: "gallery-grants", confirmTitle: "Gallery grants", revision, confirmation: "DELETE EVENT" }
  }), /Deletion is blocked/);
});


test("canonical consent applications linked by eventId are retained as deletion blockers", async () => {
  const revision = 1794400000000;
  const db = {
    collection(name) {
      return { where(field, op, id) {
        assert.equal(field, "eventId");
        assert.equal(op, "==");
        assert.equal(id, "consent-event");
        return { limit(n) {
          assert.equal(n, 101);
          return { get: async () => ({ size: name === "consentApplications" ? 2 : 0 }) };
        } };
      } };
    },
    doc(path) {
      if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
      if (path === "publicEvents/consent-event" || path === "parentGalleryEvents/consent-event") return { get: async () => ({ exists: false }) };
      if (path === "eventGalleryAccess/consent-event") return { get: async () => ({ exists: false }), listCollections: async () => [] };
      assert.equal(path, "events/consent-event");
      return {
        get: async () => ({ exists: true, updateTime: { toMillis: () => revision }, data: () => ({ title: "Consent event", section: "Cubs" }) }),
        listCollections: async () => [],
        collection: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) })
      };
    }
  };
  const bucket = { getFiles: async () => [[]] };
  const inspection = await handleEventDeletion(db, bucket, { auth: { uid: "root" }, data: { action: "inspect", eventId: "consent-event" } });
  assert.deepEqual(inspection.linked.consentApplications, { count: 2, truncated: false });
  assert.ok(inspection.blockers.includes("consentApplications (2 linked records)"));
  await assert.rejects(handleEventDeletion(db, bucket, {
    auth: { uid: "root" }, data: { action: "delete", eventId: "consent-event", confirmTitle: "Consent event", revision, confirmation: "DELETE EVENT" }
  }), /Deletion is blocked/);
});


test("gallery inventory uses the same section path normalisation as gallery uploads", async () => {
  const revision = 1794400000000;
  const db = {
    collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }),
    doc(path) {
      if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
      if (path === "publicEvents/all-sections" || path === "parentGalleryEvents/all-sections") return { get: async () => ({ exists: false }) };
      if (path === "eventGalleryAccess/all-sections") return { get: async () => ({ exists: false }), listCollections: async () => [] };
      assert.equal(path, "events/all-sections");
      return {
        get: async () => ({ exists: true, updateTime: { toMillis: () => revision }, data: () => ({ title: "All sections event", section: "All Sections" }) }),
        listCollections: async () => [],
        collection: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) })
      };
    }
  };
  const inspectedPrefixes = [];
  const bucket = { getFiles: async ({ prefix, maxResults }) => {
    inspectedPrefixes.push(prefix);
    assert.equal(maxResults, 101);
    return prefix.includes("/All Sections/") ? [[{ name: "legacy-photo" }]] : [[]];
  } };
  const inspection = await handleEventDeletion(db, bucket, { auth: { uid: "root" }, data: { action: "inspect", eventId: "all-sections" } });
  assert.equal(inspection.photoCount, 1);
  assert.deepEqual(inspectedPrefixes, [
    "attachments/event-gallery/All-Sections/all-sections/",
    "attachments/event-gallery/All Sections/all-sections/"
  ]);
  assert.ok(inspection.blockers.includes("gallery photos (1 found)"));
});


test("section-only audience evidence and unknown gallery access descendants block deletion", async () => {
  const revision = 1794400000000;
  const db = {
    collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }),
    doc(path) {
      if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
      if (path === "publicEvents/section-only" || path === "parentGalleryEvents/section-only") return { get: async () => ({ exists: false }) };
      if (path === "eventGalleryAccess/section-only") return {
        get: async () => ({ exists: false }),
        listCollections: async () => [{ id: "unexpected", limit: () => ({ get: async () => ({ size: 0 }) }) }]
      };
      assert.equal(path, "events/section-only");
      return {
        get: async () => ({ exists: true, updateTime: { toMillis: () => revision }, data: () => ({
          title: "Section only", section: "Cubs",
          audience: { version: 3, mode: "sections", sectionIds: ["Cubs"], memberIds: [], resolvedMemberIds: [] }
        }) }),
        listCollections: async () => [],
        collection: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) })
      };
    }
  };
  const bucket = { getFiles: async () => [[]] };
  const inspection = await handleEventDeletion(db, bucket, { auth: { uid: "root" }, data: { action: "inspect", eventId: "section-only" } });
  assert.ok(inspection.blockers.includes("section audience evidence"));
  assert.ok(inspection.blockers.includes("gallery access subcollection requires recursive inventory: unexpected"));
  await assert.rejects(handleEventDeletion(db, bucket, { auth: { uid: "root" }, data: {
    action: "delete", eventId: "section-only", confirmTitle: "Section only", revision, confirmation: "DELETE EVENT"
  } }), /Deletion is blocked/);
});


test("stale revision and title confirmations never trigger linked-record or Storage inventory", async () => {
  let eventReads = 0;
  const db = {
    collection: () => { throw new Error("external collection inventory must not run"); },
    doc(path) {
      if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
      assert.equal(path, "events/old-event");
      return { get: async () => {
        eventReads += 1;
        return { exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Actual title", section: "Cubs" }) };
      }, listCollections: () => { throw new Error("nested inventory must not run"); } };
    }
  };
  const bucket = { getFiles: () => { throw new Error("Storage inventory must not run"); } };
  for (const changes of [{ revision: 1794399999999 }, { confirmTitle: "Incorrect title" }]) {
    await assert.rejects(handleEventDeletion(db, bucket, { auth: { uid: "root" }, data: {
      action: "delete", eventId: "old-event", confirmTitle: "Actual title", revision: 1794400000000,
      confirmation: "DELETE EVENT", ...changes
    } }), /Refresh the review and confirm/);
  }
  assert.equal(eventReads, 2);
});


test("known event child collection with no direct documents still requires recursive inventory", async () => {
  const db = {
    collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }),
    doc(path) {
      if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Cubs"] }) }) };
      if (path === "publicEvents/nested" || path === "parentGalleryEvents/nested") return { get: async () => ({ exists: false }) };
      if (path === "eventGalleryAccess/nested") return { get: async () => ({ exists: false }), listCollections: async () => [] };
      assert.equal(path, "events/nested");
      return {
        get: async () => ({ exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Nested", section: "Cubs" }) }),
        listCollections: async () => [{ id: "audienceMembers" }],
        collection: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) })
      };
    }
  };
  const inspection = await handleEventDeletion(db, { getFiles: async () => [[]] }, {
    auth: { uid: "root" }, data: { action: "inspect", eventId: "nested" }
  });
  assert.equal(inspection.linked.audienceMembers.count, 0);
  assert.ok(inspection.blockers.includes("event subcollection requires recursive inventory: audienceMembers"));
});


test("failed external inventory reads never produce a deletion review or deletion success", async () => {
  const revision = 1794400000000;
  const reads = [];
  const db = {
    doc(path) {
      if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
      if (path === "publicEvents/failure" || path === "parentGalleryEvents/failure") return { get: async () => ({ exists: false }) };
      if (path === "eventGalleryAccess/failure") return { get: async () => ({ exists: false }), listCollections: async () => [] };
      assert.equal(path, "events/failure");
      return {
        get: async () => ({ exists: true, updateTime: { toMillis: () => revision }, data: () => ({ title: "Failure", section: "Cubs" }) }),
        listCollections: async () => [],
        collection: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) })
      };
    },
    collection(name) {
      return { where: () => ({ limit: () => ({ get: async () => {
        reads.push(name);
        if (name === "financeTransactions") throw new Error("simulated Firestore read failure");
        return { size: 0 };
      } }) }) };
    }
  };
  const bucket = { getFiles: async () => [[]] };
  for (const action of ["inspect", "delete"]) {
    const data = { action, eventId: "failure", confirmTitle: "Failure", revision, confirmation: "DELETE EVENT" };
    await assert.rejects(handleEventDeletion(db, bucket, { auth: { uid: "root" }, data }), /simulated Firestore read failure/);
  }
  assert.ok(reads.includes("financeTransactions"));
});

test("Storage inventory failure prevents both review and deletion", async () => {
  const db = {
    doc(path) {
      if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
      assert.equal(path, "events/failure");
      return {
        get: async () => ({ exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Failure", section: "Cubs" }) }),
        listCollections: async () => [],
        collection: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) })
      };
    }
  };
  const bucket = { getFiles: async () => { throw new Error("simulated Storage listing failure"); } };
  for (const action of ["inspect", "delete"]) {
    await assert.rejects(handleEventDeletion(db, bucket, { auth: { uid: "root" }, data: {
      action, eventId: "failure", confirmTitle: "Failure", revision: 1794400000000, confirmation: "DELETE EVENT"
    } }), /simulated Storage listing failure/);
  }
});


test("clean-event finalisation atomically writes audit and deletes canonical event", async () => {
  const revision = 1794400000000;
  const writes = [];
  const db = {
    doc: path => ({ path, listCollections: async () => [], collection: name => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
    collection: name => ({ where: () => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
    runTransaction: async callback => {
      const transaction = {
        get: async ref => ref.kind === "consentQuery" ? { empty: true, size: 0 } : ref.path === "adminUsers/root"
          ? { exists: true, data: () => ({ active: true, role: "super-admin", sections: ["Cubs"] }) }
          : ref.path === "events/clean"
          ? { exists: true, updateTime: { toMillis: () => revision }, data: () => ({ title: "Clean", section: "Cubs" }) }
          : { exists: false },
        create: (ref, data) => writes.push(["create", ref.path, data]),
        delete: ref => writes.push(["delete", ref.path])
      };
      return callback(transaction);
    }
  };
  const result = await commitCleanEventDeletion(db, { eventId: "clean", title: "Clean", section: "Cubs", revision, actorUid: "root" });
  assert.deepEqual(result, { eventId: "clean", deleted: true });
  assert.equal(writes.length, 2);
  assert.equal(writes[0][1], "eventDeletionAudits/clean");
  assert.equal(writes[0][2].actorUid, "root");
  assert.equal(writes[0][2].outcome, "deleted");
  assert.deepEqual(writes[0][2].eventLifecycle, { status: null, startDate: null, endDate: null });
  assert.deepEqual(writes[0][2].removedProjections, []);
  assert.equal(writes[1][1], "events/clean");
});

test("clean-event finalisation rejects stale events and retained references without writes", async () => {
  let writes = 0;
  const db = {
    doc: path => ({ path, listCollections: async () => [], collection: name => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
    collection: name => ({ where: () => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
    runTransaction: async callback => callback({
      get: async ref => ref.kind === "consentQuery" ? { empty: true, size: 0 } : ref.path === "adminUsers/root"
          ? { exists: true, data: () => ({ active: true, role: "super-admin", sections: ["Cubs"] }) }
          : ref.path === "events/clean"
        ? { exists: true, updateTime: { toMillis: () => 12 }, data: () => ({ title: "Clean", section: "Cubs" }) }
        : { exists: false },
      create: () => { writes++; },
      delete: () => { writes++; }
    })
  };
  const request = { eventId: "clean", title: "Clean", section: "Cubs", revision: 13, actorUid: "root" };
  await assert.rejects(commitCleanEventDeletion(db, request), /Event changed/);
  await assert.rejects(commitCleanEventDeletion(db, { ...request, retainedReferences: ["consent"] }), /no retained references/);
  assert.equal(writes, 0);
});


test("clean-event finalisation denies revoked Super Admin inside transaction without writes", async () => {
  let writes = 0;
  const db = {
    doc: path => ({ path, listCollections: async () => [], collection: name => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
    collection: name => ({ where: () => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
    runTransaction: async callback => callback({
      get: async ref => ref.kind === "consentQuery" ? { empty: true, size: 0 } : ref.path === "adminUsers/root"
        ? { exists: true, data: () => ({ active: false, role: "super-admin", sections: ["Cubs"] }) }
        : ref.path === "events/clean"
          ? { exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Clean", section: "Cubs" }) }
          : { exists: false },
      create: () => { writes++; },
      delete: () => { writes++; }
    })
  };
  await assert.rejects(commitCleanEventDeletion(db, {
    eventId: "clean", title: "Clean", section: "Cubs", revision: 1794400000000, actorUid: "root"
  }), /Super Admin access required/);
  assert.equal(writes, 0);
});


test("clean-event finalisation removes public and parent projections in the same audited transaction", async () => {
  const revision = 1794400000000;
  const writes = [];
  const db = {
    doc: path => ({ path, listCollections: async () => [], collection: name => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
    collection: name => ({ where: () => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
    runTransaction: async callback => callback({
      get: async ref => {
        if (ref.kind === "consentQuery") return { empty: true, size: 0 };
        if (ref.path === "adminUsers/root") return { exists: true, data: () => ({ active: true, role: "super-admin", sections: ["Cubs"] }) };
        if (ref.path === "events/clean") return { exists: true, updateTime: { toMillis: () => revision }, data: () => ({ title: "Clean", section: "Cubs" }) };
        if (ref.path === "publicEvents/clean" || ref.path === "parentGalleryEvents/clean") return { exists: true };
        return { exists: false };
      },
      create: (ref, data) => {
        assert.deepEqual(data.removedProjections, ["publicEvents", "parentGalleryEvents"]);
        writes.push(["create", ref.path]);
      },
      delete: ref => writes.push(["delete", ref.path])
    })
  };
  const result = await commitCleanEventDeletion(db, { eventId: "clean", title: "Clean", section: "Cubs", revision, actorUid: "root" });
  assert.equal(result.deleted, true);
  assert.deepEqual(writes, [
    ["create", "eventDeletionAudits/clean"],
    ["delete", "publicEvents/clean"],
    ["delete", "parentGalleryEvents/clean"],
    ["delete", "events/clean"]
  ]);
});


test("clean-event finalisation refuses a gallery access root added after inspection", async () => {
  const revision = 1794400000000;
  let writes = 0;
  const db = {
    doc: path => ({ path, listCollections: async () => [], collection: name => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
    collection: name => ({ where: () => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
    runTransaction: async callback => callback({
      get: async ref => {
        if (ref.kind === "consentQuery") return { empty: true, size: 0 };
        if (ref.path === "adminUsers/root") return { exists: true, data: () => ({ active: true, role: "super-admin", sections: ["Cubs"] }) };
        if (ref.path === "events/clean") return { exists: true, updateTime: { toMillis: () => revision }, data: () => ({ title: "Clean", section: "Cubs" }) };
        return { exists: ref.path === "eventGalleryAccess/clean" };
      },
      create: () => { writes++; },
      delete: () => { writes++; }
    })
  };
  await assert.rejects(commitCleanEventDeletion(db, {
    eventId: "clean", title: "Clean", section: "Cubs", revision, actorUid: "root"
  }), /gallery access must be reconciled/);
  assert.equal(writes, 0);
});


test("clean-event transaction refuses embedded safeguarding, audience and hall evidence", async () => {
  const revision = 1794400000000;
  const evidenceCases = [
    { attendance: { member: true } },
    { consent: { member: true } },
    { consentLinkToken: "token" },
    { hallResource: "hall" },
    { hallInterval: "interval" },
    { hallRevision: 1 },
    { audience: { sectionIds: ["Cubs"], memberIds: [], resolvedMemberIds: [] } },
    { audience: { sectionIds: [], memberIds: ["member"], resolvedMemberIds: [] } },
    { audience: { sectionIds: [], memberIds: [], resolvedMemberIds: ["member"] } },
    { audience: { memberIds: [] } }
  ];
  for (const evidence of evidenceCases) {
    let writes = 0;
    const db = {
      doc: path => ({ path, listCollections: async () => [], collection: name => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
    collection: name => ({ where: () => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
      runTransaction: async callback => callback({
        get: async ref => {
          if (ref.kind === "consentQuery") return { empty: true, size: 0 };
        if (ref.kind === "consentQuery") return { empty: true, size: 0 };
          if (ref.path === "adminUsers/root") return { exists: true, data: () => ({ active: true, role: "super-admin", sections: ["Cubs"] }) };
          if (ref.path === "events/clean") return {
            exists: true, updateTime: { toMillis: () => revision },
            data: () => ({ title: "Clean", section: "Cubs", ...evidence })
          };
          return { exists: false };
        },
        create: () => { writes++; },
        delete: () => { writes++; }
      })
    };
    await assert.rejects(commitCleanEventDeletion(db, {
      eventId: "clean", title: "Clean", section: "Cubs", revision, actorUid: "root"
    }), /retained safeguarding, audience or booking evidence/);
    assert.equal(writes, 0);
  }
});


test("clean-event transaction blocks independent consent responses without writes", async () => {
  const revision = 1794400000000;
  let writes = 0;
  const db = {
    doc: path => ({ path, listCollections: async () => [], collection: name => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
    collection: name => ({ where: (field, op, id) => {
      assert.deepEqual([field, op, id], ["eventId", "==", "clean"]);
      return { limit: count => {
        assert.equal(count, 1);
        return { kind: "consentQuery", name };
      } };
    } }),
    runTransaction: async callback => callback({
      get: async ref => {
        if (ref.kind === "consentQuery") return {
          empty: ref.name !== "eventConsentResponses",
          size: ref.name === "eventConsentResponses" ? 1 : 0
        };
        if (ref.path === "adminUsers/root") return { exists: true, data: () => ({ active: true, role: "super-admin", sections: ["Cubs"] }) };
        if (ref.path === "events/clean") return { exists: true, updateTime: { toMillis: () => revision }, data: () => ({ title: "Clean", section: "Cubs" }) };
        return { exists: false };
      },
      create: () => { writes++; },
      delete: () => { writes++; }
    })
  };
  await assert.rejects(commitCleanEventDeletion(db, {
    eventId: "clean", title: "Clean", section: "Cubs", revision, actorUid: "root"
  }), /Retained eventConsentResponses evidence/);
  assert.equal(writes, 0);
});

test("clean-event transaction refuses financial and equipment references", async () => {
  const revision = 1794400000000;
  for (const retained of ["financeTransactions", "equipmentLoans", "equipmentIncidents", "eventInvitations", "eventNotifications", "calendarEntries"]) {
    let writes = 0;
    const db = {
      doc: path => ({ path, listCollections: async () => [], collection: name => ({ limit: () => ({ kind: "consentQuery", name }) }) }),
      collection: name => ({ where: () => ({ limit: () => ({ kind: "referenceQuery", name }) }) }),
      runTransaction: async callback => callback({
        get: async ref => {
          if (ref.kind === "referenceQuery") return { empty: ref.name !== retained, size: ref.name === retained ? 1 : 0 };
          if (ref.path === "adminUsers/root") return { exists: true, data: () => ({ active: true, role: "super-admin", sections: ["Cubs"] }) };
          if (ref.path === "events/clean") return { exists: true, updateTime: { toMillis: () => revision }, data: () => ({ title: "Clean", section: "Cubs" }) };
          return { exists: false };
        },
        create: () => { writes++; },
        delete: () => { writes++; }
      })
    };
    await assert.rejects(commitCleanEventDeletion(db, {
      eventId: "clean", title: "Clean", section: "Cubs", revision, actorUid: "root"
    }), new RegExp("Retained " + retained + " evidence"));
    assert.equal(writes, 0);
  }
});

test("clean-event transaction blocks event-owned child records added after inspection", async () => {
  const revision = 1794400000000;
  for (const retained of ["audienceMembers", "programmeAccess", "programmes", "leaderAttendance"]) {
    let writes = 0;
    const db = {
      doc: path => ({ path, listCollections: async () => [], collection: name => ({ limit: () => ({ kind: "childQuery", name }) }) }),
      collection: name => ({ where: () => ({ limit: () => ({ kind: "externalQuery", name }) }) }),
      runTransaction: async callback => callback({
        get: async ref => {
          if (ref.kind === "externalQuery") return { empty: true, size: 0 };
          if (ref.kind === "childQuery") return { empty: ref.name !== retained, size: ref.name === retained ? 1 : 0 };
          if (ref.path === "adminUsers/root") return { exists: true, data: () => ({ active: true, role: "super-admin", sections: ["Cubs"] }) };
          if (ref.path === "events/clean") return { exists: true, updateTime: { toMillis: () => revision }, data: () => ({ title: "Clean", section: "Cubs" }) };
          return { exists: false };
        },
        create: () => { writes++; },
        delete: () => { writes++; }
      })
    };
    await assert.rejects(commitCleanEventDeletion(db, {
      eventId: "clean", title: "Clean", section: "Cubs", revision, actorUid: "root"
    }), new RegExp("Retained event " + retained + " records"));
    assert.equal(writes, 0);
  }
});

test("clean-event finalisation refuses orphaned gallery grants beneath missing root", async () => {
  let transactions = 0;
  const db = {
    doc: path => ({
      path,
      listCollections: async () => path === "eventGalleryAccess/clean" ? [{ id: "parents" }] : []
    }),
    runTransaction: async () => { transactions++; }
  };
  await assert.rejects(commitCleanEventDeletion(db, {
    eventId: "clean", title: "Clean", section: "Cubs", revision: 1794400000000, actorUid: "root"
  }), /gallery access descendants must be reconciled/);
  assert.equal(transactions, 0);
});

test("clean-event audit retains past and closed event lifecycle metadata", async () => {
  const revision = 1794400000000;
  let audit;
  const db = {
    doc: path => ({ path, listCollections: async () => [], collection: name => ({ limit: () => ({ kind: "referenceQuery", name }) }) }),
    collection: name => ({ where: () => ({ limit: () => ({ kind: "referenceQuery", name }) }) }),
    runTransaction: async callback => callback({
      get: async ref => {
        if (ref.kind === "referenceQuery") return { empty: true, size: 0 };
        if (ref.path === "adminUsers/root") return { exists: true, data: () => ({ active: true, role: "super-admin", sections: ["Cubs"] }) };
        if (ref.path === "events/closed") return {
          exists: true, updateTime: { toMillis: () => revision },
          data: () => ({ title: "Closed", section: "Cubs", status: "closed", startDate: "2025-01-01", endDate: "2025-01-02" })
        };
        return { exists: false };
      },
      create: (ref, data) => { if (ref.path === "eventDeletionAudits/closed") audit = data; },
      delete: () => {}
    })
  };
  await commitCleanEventDeletion(db, { eventId: "closed", title: "Closed", section: "Cubs", revision, actorUid: "root" });
  assert.deepEqual(audit.eventLifecycle, {
    status: "closed", startDate: "2025-01-01", endDate: "2025-01-02"
  });
});

test("review and finalisation share one complete external evidence inventory", () => {
  assert.deepEqual([...EVENT_DELETION_EVIDENCE_COLLECTIONS], [
    "eventConsentLinks", "eventConsentResponses", "consentApplications",
    "financeTransactions", "equipmentLoans", "equipmentIncidents",
    "eventInvitations", "eventNotifications", "calendarEntries"
  ]);
  assert.equal(new Set(EVENT_DELETION_EVIDENCE_COLLECTIONS).size, EVENT_DELETION_EVIDENCE_COLLECTIONS.length);
  assert.equal(Object.isFrozen(EVENT_DELETION_EVIDENCE_COLLECTIONS), true);
});

test("clean-event finalisation refuses unknown event descendants before transaction", async () => {
  let transactions = 0;
  const db = {
    doc: path => ({
      path,
      listCollections: async () => path === "events/clean" ? [{ id: "customEvidence" }] : []
    }),
    runTransaction: async () => { transactions++; }
  };
  await assert.rejects(commitCleanEventDeletion(db, {
    eventId: "clean", title: "Clean", section: "Cubs",
    revision: 1794400000000, actorUid: "root"
  }), /Event descendants must be reconciled/);
  assert.equal(transactions, 0);
});
