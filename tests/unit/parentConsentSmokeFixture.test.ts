import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildParentConsentSmokeFixture, parentConsentSmokeIds, validateParentConsentSmokeFixture } from "../../scripts/parent-consent-smoke-fixture.mjs";

function validFixture() {
  const { parentEmail, childId } = parentConsentSmokeIds;
  const parent = { email: parentEmail, status: "approved", memberIds: [childId], linkedSections: ["Cubs"] };
  const child = { status: "active", section: "Cubs" };
  const { event, audienceMembership, consentLink } = buildParentConsentSmokeFixture("2099-05-10");
  return {
    parent,
    child,
    event,
    audienceMembership,
    consentLink,
    consentSettings: { parentConsentEnabled: true },
    publicNavigationSettings: { parentConsentEnabled: true }
  };
}

test("consent smoke fixture links its approved parent to an active Cubs child and selected event audience", () => {
  const fixture = validFixture();
  assert.equal(validateParentConsentSmokeFixture(fixture), true);
  assert.ok(fixture.parent.memberIds.includes(parentConsentSmokeIds.childId));
  assert.equal(fixture.event.consentRequired, true);
  assert.equal(fixture.event.audience.version, 3);
  assert.equal(fixture.audienceMembership.selectedIndividually, true);
  assert.equal(fixture.consentLink.active, true);
  assert.equal(fixture.consentLink.audienceVersion, 3);
});

test("consent smoke fixture verification names missing prerequisites", () => {
  assert.throws(
    () => validateParentConsentSmokeFixture({}),
    /Parent Portal consent smoke fixture invalid: missing parentAccounts\/TEST_uid_cub_parent_1;.*missing members\/TEST_member_cub_01;.*missing events\/TEST_parent_consent_smoke_cubs;.*missing events\/TEST_parent_consent_smoke_cubs\/audienceMembers\/TEST_member_cub_01;.*missing eventConsentLinks\/TEST_CUB_PARENT_CONSENT_SMOKE/
  );
});

test("consent smoke fixture verification rejects a missing child link, consent requirement, or audience record", () => {
  const fixture = validFixture();
  fixture.parent.memberIds = [];
  fixture.event.consentRequired = false;
  fixture.audienceMembership.selectedIndividually = false;
  assert.throws(
    () => validateParentConsentSmokeFixture(fixture),
    /must link TEST_member_cub_01.*must require consent.*must include the linked child through the selected-member audience/
  );
});

test("consent smoke fixture requires the persisted Parent Portal consent setting and public projection", () => {
  const fixture = validFixture();
  fixture.consentSettings.parentConsentEnabled = false;
  fixture.publicNavigationSettings.parentConsentEnabled = false;
  assert.throws(
    () => validateParentConsentSmokeFixture(fixture),
    /siteSettings\/parentConsent\.parentConsentEnabled must be true.*siteSettings\/publicNavigation\.parentConsentEnabled must be true/
  );
});

test("deployment smoke requires the named request and bounds loading diagnostics on both browser projects", () => {
  const workflow = readFileSync(".github/workflows/firebase-hosting-test.yml", "utf8");
  const smoke = readFileSync("e2e/test-environment-smoke.spec.ts", "utf8");
  const localSeed = readFileSync("scripts/seed-playwright-records.mjs", "utf8");

  assert.match(workflow, /seed-parent-consent-smoke\.mjs seed/);
  assert.match(workflow, /--project=chromium --project=mobile-chromium/);
  assert.match(localSeed, /buildParentConsentSmokeFixture/);
  assert.match(localSeed, /validateParentConsentSmokeFixture/);
  assert.match(smoke, /parent-event-consent-tile-TEST_CUB_PARENT_CONSENT_SMOKE/);
  assert.match(smoke, /timeout:\s*20000/);
  assert.match(smoke, /message:\s*"The eligible parent must receive the seeded Cubs consent request/);
  assert.match(smoke, /still loading the consent query/);
});
