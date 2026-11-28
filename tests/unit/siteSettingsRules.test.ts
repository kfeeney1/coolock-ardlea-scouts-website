import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

test("site settings keep session reads separate from Super Admin-only canonical settings", () => {
    const start = rules.indexOf("match /siteSettings/{settingsId}");
    const end = rules.indexOf("match /publicSiteContent/{contentId}", start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);

    const block = rules.slice(start, end);
    assert.match(block, /allow get: if \(signedIn\(\) && settingsId == "session"\)/);
    assert.match(block, /settingsId in \["parentLogin", "parentConsent", "hallHire"\] && isSuperAdmin\(\)/);
    assert.match(block, /settingsId == "publicNavigation"/);
    assert.match(block, /return settingsId == "session"\s*\? isAdmin\(\)/);
    assert.match(block, /: isSuperAdmin\(\) && \(\s*settingsId == "hallHire"[\s\S]*?\|\| settingsId == "parentLogin"[\s\S]*?\|\| settingsId == "parentConsent"[\s\S]*?\|\| settingsId == "publicNavigation"[\s\S]*?\n\s*\);/);
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
        assert.match(block, new RegExp(`_writeData\\.${field} >= 5`));
        assert.match(block, new RegExp(`_writeData\\.${field} <= 240`));
    }
    assert.match(block, /_writeData\.updatedBy == request\.auth\.uid/);
    assert.match(block, /_writeData\.updatedAt == request\.time/);
    assert.match(block, /getAfter\([^\n]+siteSettings\/publicNavigation\)/);
    assert.match(block, /getAfter\([^\n]+siteSettings\/parentLogin\)/);
    assert.match(block, /_writeData\.parentLoginEnabled is bool/);
    assert.match(block, /_writeData\.keys\(\)\.hasOnly\(\["parentLoginEnabled", "parentConsentEnabled"\]\)/);
    assert.match(block, /_writeData\.parentConsentEnabled is bool/);
    assert.match(block, /_writeData\.keys\(\)\.hasOnly\(\["parentConsentEnabled", "updatedAt", "updatedBy"\]\)/);
    assert.match(block, /getAfter\([^\n]+siteSettings\/parentConsent\)/);
});
