import assert from "node:assert/strict";
import test from "node:test";

import {
    buildWhatsAppCommunicationUrl,
    communicationTemplates,
    eligibleCommunicationRecipients,
    validateCommunication
} from "../../src/services/communicationLogic.ts";

const recipients = [
    { id: "a", displayName: "Ava", section: "Scouts", status: "active" },
    { id: "b", displayName: "Ben", section: "Cubs", status: "active" },
    { id: "c", displayName: "Cara", section: "Scouts", status: "inactive" }
];

test("eligibleCommunicationRecipients keeps active members in the selected section", () => {
    assert.deepEqual(
        eligibleCommunicationRecipients(recipients, "Scouts").map((item) => item.id),
        ["a"]
    );
});

test("eligibleCommunicationRecipients can span all already-authorized sections", () => {
    assert.deepEqual(
        eligibleCommunicationRecipients(recipients, "all").map((item) => item.id),
        ["a", "b"]
    );
});

test("validateCommunication requires recipients and bounded content", () => {
    assert.equal(validateCommunication("Subject", "Message", 0), "Select at least one recipient.");
    assert.equal(validateCommunication("", "Message", 1), "Enter a subject.");
    assert.equal(validateCommunication("Subject", "", 1), "Enter a message.");
    assert.equal(validateCommunication("x".repeat(121), "Message", 1), "Subject must be 120 characters or fewer.");
    assert.equal(validateCommunication("Subject", "x".repeat(2501), "Message", 1), "Message must be 2,500 characters or fewer.");
    assert.equal(validateCommunication("Subject", "Message", 1), null);
});

test("communication templates provide editable starting content", () => {
    assert.match(communicationTemplates["meeting-reminder"].subject, /meeting/i);
    assert.ok(communicationTemplates["action-required"].message.length > 0);
});

test("WhatsApp share URL contains only the composed subject and message", () => {
    const url = buildWhatsAppCommunicationUrl(" Scout reminder ", " Bring your necker. ");
    assert.equal(url, "https://wa.me/?text=Scout%20reminder%0A%0ABring%20your%20necker.");
    assert.doesNotMatch(url, /parent|recipient|email|phone/i);
});
