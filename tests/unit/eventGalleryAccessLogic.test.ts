import assert from "node:assert/strict";
import test from "node:test";

import { buildGalleryAccessDecision, consentCoversEvent, galleryAccessDocumentPath } from "../../src/services/eventGalleryAccessLogic.ts";

const baseInput = {
    event: { id: "event-1", section: "Cubs", startDate: "2026-09-12", attendance: { "member-1": "attending" } },
    parent: { uid: "parent-1", status: "approved", memberIds: ["member-1"], linkedSections: ["Cubs"] },
    member: { id: "member-1", section: "Cubs" },
    consent: {
        id: "consent-1",
        memberId: "member-1",
        section: "Cubs",
        formType: "youth-activity-consent",
        status: "active",
        photoConsent: "Yes",
        consentFrom: "2026-09-01",
        consentTo: "2026-09-30"
    }
};

test("gallery access requires explicit current photo consent", () => {
    assert.deepEqual(buildGalleryAccessDecision(baseInput), {
        eventId: "event-1",
        section: "Cubs",
        parentUid: "parent-1",
        memberId: "member-1",
        consentApplicationId: "consent-1",
        active: true
    });

    assert.throws(
        () => buildGalleryAccessDecision({ ...baseInput, consent: { ...baseInput.consent, photoConsent: "No" } }),
        /Photo sharing consent has not been granted/
    );
});

test("gallery access is isolated to the linked family, section and attending child", () => {
    assert.throws(
        () => buildGalleryAccessDecision({ ...baseInput, parent: { ...baseInput.parent, memberIds: ["member-other"] } }),
        /not linked to this member/
    );
    assert.throws(
        () => buildGalleryAccessDecision({ ...baseInput, parent: { ...baseInput.parent, linkedSections: ["Scouts"] } }),
        /not linked to the event section/
    );
    assert.throws(
        () => buildGalleryAccessDecision({ ...baseInput, event: { ...baseInput.event, attendance: { "member-1": "invited" } } }),
        /must be attending/
    );
});

test("gallery access requires consent covering the event date", () => {
    assert.equal(consentCoversEvent("2026-09-01", "2026-09-30", "2026-09-12"), true);
    assert.equal(consentCoversEvent("2026-09-13", "2026-09-30", "2026-09-12"), false);
    assert.equal(consentCoversEvent("", "2026-09-30", "2026-09-12"), false);
    assert.throws(
        () => buildGalleryAccessDecision({ ...baseInput, consent: { ...baseInput.consent, consentTo: "2026-09-10" } }),
        /does not cover the event date/
    );
});

test("gallery access projection path is exact and rejects path injection", () => {
    assert.equal(galleryAccessDocumentPath("event-1", "parent-1"), "eventGalleryAccess/event-1/parents/parent-1");
    assert.throws(() => galleryAccessDocumentPath("event/other", "parent-1"), /document IDs/);
    assert.throws(() => galleryAccessDocumentPath("event-1", "parent/other"), /document IDs/);
});
