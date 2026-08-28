import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

test("site session settings are readable to signed-in users but writable only by admins", () => {
    const start = rules.indexOf("match /siteSettings/{settingsId}");
    const end = rules.indexOf("match /publicSiteContent/{contentId}", start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);

    const block = rules.slice(start, end);
    assert.match(block, /allow get: if signedIn\(\) && settingsId == "session"/);
    assert.match(block, /allow create, update: if isAdmin\(\)/);
    assert.match(block, /allow delete: if false/);
    assert.doesNotMatch(block, /allow (create|update).*isActiveLeader\(\)/);
});

test("site session settings enforce bounded timeout values and audit fields", () => {
    const start = rules.indexOf("match /siteSettings/{settingsId}");
    const end = rules.indexOf("match /publicSiteContent/{contentId}", start);
    const block = rules.slice(start, end);

    for (const field of [
        "parentInactivityMinutes",
        "leaderDesktopInactivityMinutes",
        "leaderPhoneInactivityMinutes"
    ]) {
        assert.match(block, new RegExp(`request\\.resource\\.data\\.${field} >= 5`));
        assert.match(block, new RegExp(`request\\.resource\\.data\\.${field} <= 240`));
    }
    assert.match(block, /request\.resource\.data\.updatedBy == request\.auth\.uid/);
    assert.match(block, /request\.resource\.data\.updatedAt == request\.time/);
});
