import assert from "node:assert/strict";
import test from "node:test";

import { buildGalleryAccessProjection, hasCurrentPhotoConsent } from "../../src/services/eventGalleryAccess.ts";

test("photo consent must be active, explicit and in date", () => {
    assert.equal(hasCurrentPhotoConsent({ id: "c1", memberId: "m1", status: "active", formType: "youth-activity-consent", photoConsent: true, consentFrom: "2026-01-01", consentTo: "2026-12-31" }, "2026-08-31"), true);
    assert.equal(hasCurrentPhotoConsent({ id: "c2", memberId: "m1", status: "active", formType: "youth-activity-consent", photoConsent: false }, "2026-08-31"), false);
    assert.equal(hasCurrentPhotoConsent({ id: "c3", memberId: "m1", status: "inactive", formType: "youth-activity-consent", photoConsent: true }, "2026-08-31"), false);
    assert.equal(hasCurrentPhotoConsent({ id: "c4", memberId: "m1", status: "active", formType: "youth-activity-consent", photoConsent: true, consentTo: "2026-08-30" }, "2026-08-31"), false);
});

test("projection only grants linked attending children with current photo consent", () => {
    const projection = buildGalleryAccessProjection({
        parentUid: "parent-1",
        eventId: "event-1",
        section: "Cubs",
        eventDate: "2026-08-31",
        linkedMemberIds: ["m1", "m2"],
        attendingMemberIds: ["m1", "m3"],
        consentApplications: [
            { id: "c1", memberId: "m1", status: "active", formType: "youth-activity-consent", photoConsent: true },
            { id: "c2", memberId: "m2", status: "active", formType: "youth-activity-consent", photoConsent: true },
            { id: "c3", memberId: "m3", status: "active", formType: "youth-activity-consent", photoConsent: true },
        ],
    });

    assert.deepEqual(projection.memberIds, ["m1"]);
    assert.equal(projection.active, true);
    assert.deepEqual(projection.consentApplicationIds, ["c1"]);
});

test("withdrawal produces a fail-closed projection", () => {
    const projection = buildGalleryAccessProjection({
        parentUid: "parent-1",
        eventId: "event-1",
        section: "Cubs",
        eventDate: "2026-08-31",
        linkedMemberIds: ["m1"],
        attendingMemberIds: ["m1"],
        consentApplications: [{ id: "c1", memberId: "m1", status: "active", formType: "youth-activity-consent", photoConsent: false }],
    });

    assert.equal(projection.active, false);
    assert.deepEqual(projection.memberIds, []);
});
