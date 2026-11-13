import test from "node:test";
import assert from "node:assert/strict";
import { isCanonicalSuperAdmin, handleEventDeletion } from "../src/eventDeletion.js";

test("only active canonical Super Admin is authorised", () => {
  assert.equal(isCanonicalSuperAdmin({ active: true, role: "super-admin", sections: ["Group"] }), true);
  for (const profile of [
    { active: false, role: "super-admin", sections: ["Group"] },
    { active: true, role: "admin", sections: ["Group"] },
    { active: true, role: "leader", sections: ["Group"] },
    { active: true, role: "super-admin", sections: [] },
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

test("even clean-looking events cannot be deleted before external evidence reconciliation", async () => {
  const db = { collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: 0 }) }) }) }), doc(path) {
    if (path.startsWith("eventGalleryAccess/")) return {
      get: async () => ({ exists: false }),
      listCollections: async () => []
    };
    if (path === "adminUsers/root") return { get: async () => ({ data: () => ({ active: true, role: "super-admin", sections: ["Group"] }) }) };
    if (path === "publicEvents/old-event" || path === "parentGalleryEvents/old-event") return { get: async () => ({ exists: false }) };
    assert.equal(path, "events/old-event");
    return {
      get: async () => ({ exists: true, updateTime: { toMillis: () => 1794400000000 }, data: () => ({ title: "Old event", section: "Cubs", attendance: {}, consent: {} }) }),
      listCollections: async () => [],
      collection: () => ({ limit: () => ({ get: async () => ({ empty: true }) }) })
    };
  } };
  const bucket = { getFiles: async () => [[]] };
  const auth = { auth: { uid: "root" }, data: { action: "delete", eventId: "old-event", confirmTitle: "Old event", revision: 1794400000000, confirmation: "DELETE EVENT" } };
  await assert.rejects(handleEventDeletion(db, bucket, auth), /Deletion is blocked/);
  const inspection = await handleEventDeletion(db, bucket, { ...auth, data: { ...auth.data, action: "inspect" } });
  assert.ok(inspection.blockers.includes("cross-collection evidence verification pending"));
});

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
  await assert.rejects(handleEventDeletion(db, bucket, { auth: { uid: "root" }, data: base }), /Deletion is blocked/);
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
  assert.ok(inspection.blockers.includes("unrecognised event subcollection: unexpectedHistory"));
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
  const bucket = { getFiles: async ({ prefix, maxResults }) => {
    assert.equal(prefix, "attachments/event-gallery/All-Sections/all-sections/");
    assert.equal(maxResults, 101);
    return [[{ name: "photo" }]];
  } };
  const inspection = await handleEventDeletion(db, bucket, { auth: { uid: "root" }, data: { action: "inspect", eventId: "all-sections" } });
  assert.equal(inspection.photoCount, 1);
  assert.ok(inspection.blockers.includes("gallery photos (1 found)"));
});
