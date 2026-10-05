import { expect, test, type Page, type TestInfo } from "@playwright/test";

test.describe.configure({ retries: 0 });

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Member record navigation runs once on desktop Chromium.");
}

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill("test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("clicking anywhere on a member tile opens a full member record with history", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/members");

  const card = page.locator('[data-testid^="member-card-"]').first();
  await expect(card).toBeVisible();
  const memberName = (await card.getByRole("heading").first().textContent())?.trim() || "";
  await card.click({ position: { x: 20, y: 20 } });

  await expect(page).toHaveURL(/\/leader\/members\/[^/]+$/);
  await expect(page.getByRole("heading", { name: memberName, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Member Details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Consent & Medical Indicators" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Member History" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("legacy Member History route folds back into Member Management", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/member-history");
  await expect(page).toHaveURL(/\/leader\/members$/);
  await expect(page.getByRole("heading", { name: "Member Management" })).toBeVisible();
});


test("SW-116 linked family member opens the canonical member record and Back returns to the family view", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/members/TEST_member_scout_01");

  const familyPanel = page.getByTestId("member-family-management");
  await expect(familyPanel).toBeVisible();

  // Build the relationship through the supported UI using canonical seeded members.
  // This keeps the regression independent of invented fixture IDs and also proves
  // the resulting family link is immediately navigable.
  await familyPanel.getByLabel("Search existing members").fill("Cubs 01");
  const candidate = familyPanel.getByTestId("family-candidate-TEST_member_cub_01");
  await expect(candidate).toBeVisible();
  await candidate.getByRole("button", { name: "Select" }).click();
  await familyPanel.getByRole("button", { name: "Link selected siblings" }).click();

  const sibling = familyPanel.locator('a[href="/leader/members/TEST_member_cub_01"]');
  await expect(sibling).toBeVisible();
  await sibling.click();

  await expect(page).toHaveURL(/\/leader\/members\/TEST_member_cub_01$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/leader\/members\/TEST_member_scout_01$/);
  await expect(page.getByTestId("member-family-management")).toBeVisible();
});


test("SW-134/135 medical indicators reflow and open the stable protected consent record", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Medical indicator regression runs on desktop and Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/members/TEST_member_beaver_01");

  const indicators = page.getByTestId("member-consent-medical-indicators");
  await expect(indicators).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));

  const medicalLink = indicators.getByRole("link", { name: /Open consent and medical details/ }).first();
  await expect(medicalLink).toBeVisible();
  const href = await medicalLink.getAttribute("href");
  expect(href).toMatch(/^\/leader\/consents\/.+/);
  await medicalLink.focus();
  await expect(medicalLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&")}$`));
  await expect(page.getByRole("heading", { name: "Important medical information" })).toBeVisible();
  const medicationPanel = page.getByTestId("medication-management-panel");
  await expect(medicationPanel).toBeVisible();
  await expect(medicationPanel.getByText("Medicine", { exact: true })).toBeVisible();
  await expect(medicationPanel).not.toContainText('{"');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));

  await page.goBack();
  await expect(page).toHaveURL(/\/leader\/members\/TEST_member_beaver_01$/);
  await expect(page.getByRole("heading", { name: "Consent & Medical Indicators" })).toBeVisible();
});


test("SW-293/294/136 member medical quick access preserves Member Management context", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Quick medical workflow runs on desktop and Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/members");
  const listQuick = page.getByTestId("member-list-medical-TEST_member_beaver_01");
  await expect(listQuick).toBeVisible();
  await listQuick.click();
  await expect(page).toHaveURL(/\/leader\/medical\/.+$/);
  await page.getByRole("link", { name: "Back to Member Management" }).click();
  await expect(page).toHaveURL(/\/leader\/members/);
  await expect(page.getByRole("heading", { name: "Member Management" })).toBeVisible();

  await page.goto("/leader/members/TEST_member_beaver_01");

  const quick = page.getByTestId("member-quick-medical");
  await expect(quick).toBeVisible();
  await expect(quick).toHaveAccessibleName(/Open quick medical information/);
  await quick.click();

  await expect(page).toHaveURL(/\/leader\/medical\/.+$/);
  await expect(page.getByRole("heading", { name: "Quick Medical Information" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Medical conditions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Medication" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parents / guardians" })).toBeVisible();
  await expect(page.getByText("Medical or medication information is recorded below. Review the recorded details and established action information.")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));

  await page.getByRole("link", { name: "Back to member" }).click();
  await expect(page).toHaveURL(/\/leader\/members\/TEST_member_beaver_01$/);
  await expect(page.getByRole("heading", { name: "Member Details" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Menu · Member Management/ })).toBeVisible();
});

test("SW-293 Back to member is dynamic for a second member and direct consent routes use the safe fallback", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Semantic consent return runs on desktop and Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);

  await page.goto("/leader/members/TEST_member_cub_01");
  const indicators = page.getByTestId("member-consent-medical-indicators");
  const consentLink = indicators.getByRole("link", { name: /Open consent and medical details/ }).first();
  await expect(consentLink).toBeVisible();
  await consentLink.click();
  await expect(page).toHaveURL(/\\/leader\\/consents\\/.+$/);
  await page.getByRole("link", { name: "Back to member" }).click();
  await expect(page).toHaveURL(/\\/leader\\/members\\/TEST_member_cub_01$/);
  await expect(page.getByRole("heading", { name: "Member Details" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Menu · Member Management/ })).toBeVisible();

  await page.goto("/leader/consents/TEST_flow_consent_youth_medication");
  await expect(page.getByRole("link", { name: "Back to consent" })).toBeVisible();
  await page.getByRole("link", { name: "Back to consent" }).click();
  await expect(page).toHaveURL(/\\/leader\\/consents$/);
  await expect(page.getByRole("heading", { name: "Consent Management" })).toBeVisible();

  await page.goto("/leader/medical/TEST_flow_consent_youth_medication");
  await expect(page.getByRole("link", { name: "Back to Consent Management" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Consent Management" }).click();
  await expect(page).toHaveURL(/\\/leader\\/consents$/);
});

test("SW-156 stable consent linkage survives a member surname change", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/members/TEST_member_beaver_01");
  const indicators = page.getByTestId("member-consent-medical-indicators");
  await expect(indicators.getByRole("link", { name: /Open consent and medical details/ }).first()).toBeVisible();

  const lastName = page.getByLabel("Last name");
  const original = await lastName.inputValue();
  await lastName.fill(original + "-Link-Test");
  await page.getByRole("button", { name: "Save Member" }).click();
  await expect(page.getByText("Member details updated.")).toBeVisible();
  await page.reload();
  await expect(indicators.getByRole("link", { name: /Open consent and medical details/ }).first()).toBeVisible();

  await page.getByLabel("Last name").fill(original);
  await page.getByRole("button", { name: "Save Member" }).click();
  await expect(page.getByText("Member details updated.")).toBeVisible();
});

test("SW-216 surname edits are reloaded from Firestore and remain visible in Member Management", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/members/TEST_member_beaver_06");

  const lastName = page.getByLabel("Last name");
  const original = await lastName.inputValue();
  const changed = original === "O'Neill-Smith" ? "Recovery-Test" : "O'Neill-Smith";
  await lastName.fill(changed);
  await page.getByRole("button", { name: "Save Member" }).click();
  await expect(page.getByText("Member details updated.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Last name")).toHaveValue(changed);
  await page.getByRole("link", { name: "Back to Member Management" }).click();
  await page.getByLabel("Search members").fill(changed);
  await expect(page.getByTestId("member-card-TEST_member_beaver_06")).toContainText(changed);

  await page.goto("/leader/members/TEST_member_beaver_06");
  await page.getByLabel("Last name").fill(original);
  await page.getByRole("button", { name: "Save Member" }).click();
  await expect(page.getByText("Member details updated.")).toBeVisible();
});

test("SW-258 section checklist preserves memberships and explicit Primary section after reload", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Section checklist regression runs on desktop and Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/members/TEST_member_beaver_06");

  const sections = page.getByRole("group", { name: "Member sections" });
  await expect(sections.getByRole("checkbox", { name: "Beavers" })).toBeChecked();
  for (const validSection of ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]) {
    await expect(sections.getByRole("checkbox", { name: validSection })).toBeVisible();
  }
  await expect(sections.getByRole("checkbox", { name: "Group" })).toHaveCount(0);
  await expect(sections.getByRole("checkbox", { name: "Other" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Primary section" })).toHaveText("Beavers");

  await sections.getByRole("checkbox", { name: "Cubs" }).check();
  await page.getByRole("combobox", { name: "Primary section" }).click();
  await page.getByRole("option", { name: "Cubs", exact: true }).click();
  await expect(sections.getByRole("checkbox", { name: "Cubs" })).toBeDisabled();
  await expect(sections.getByRole("checkbox", { name: "Beavers" })).toBeEnabled();
  await sections.getByRole("checkbox", { name: "Beavers" }).uncheck();

  await page.getByRole("button", { name: "Save Member" }).click();
  await expect(page.getByText("Member details updated.")).toBeVisible();
  await page.reload();
  await expect(sections.getByRole("checkbox", { name: "Cubs" })).toBeChecked();
  await expect(sections.getByRole("checkbox", { name: "Beavers" })).not.toBeChecked();
  await expect(page.getByRole("combobox", { name: "Primary section" })).toHaveText("Cubs");

  await sections.getByRole("checkbox", { name: "Beavers" }).check();
  await page.getByRole("combobox", { name: "Primary section" }).click();
  await page.getByRole("option", { name: "Beavers", exact: true }).click();
  await sections.getByRole("checkbox", { name: "Cubs" }).uncheck();
  await page.getByRole("button", { name: "Save Member" }).click();
  await expect(page.getByText("Member details updated.")).toBeVisible();
});

test("SW-266 Venture youth leadership role persists and filters in the selected section", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Youth-role persistence runs on desktop and Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/members/TEST_member_venture_01");
  const ventureRole = page.getByRole("combobox", { name: "Ventures role" });
  await expect(ventureRole).toBeVisible();
  await ventureRole.click();
  await page.getByRole("option", { name: "Executive Committee", exact: true }).click();
  await page.getByRole("button", { name: "Save Member" }).click();
  await expect(page.getByText("Member details updated.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Ventures role" })).toHaveText("Executive Committee");

  await page.goto("/leader/members?section=Ventures");
  await expect(page.getByTestId("member-card-TEST_member_venture_01")).toBeVisible();
  await page.getByRole("combobox", { name: "Role" }).click();
  await page.getByRole("option", { name: "Executive Committee", exact: true }).click();
  await expect(page.getByTestId("member-card-TEST_member_venture_01")).toBeVisible();
  await expect(page.locator("[data-testid^='member-card-']")).toHaveCount(1);

  await page.goto("/leader/members/TEST_member_venture_01");
  await page.getByRole("combobox", { name: "Ventures role" }).click();
  await page.getByRole("option", { name: "No role", exact: true }).click();
  await page.getByRole("button", { name: "Save Member" }).click();
  await expect(page.getByText("Member details updated.")).toBeVisible();
});

test("SW-218 newly created Venture member remains visible under Ventures and All Sections after reload", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Member creation visibility runs on desktop and Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  const firstName = `SW218-${Date.now()}`;
  const displayName = `${firstName} Venture-Test`;

  await page.goto("/leader/members");
  await page.getByRole("button", { name: "Add Member" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Existing Member" });
  await dialog.getByLabel("First name").fill(firstName);
  await dialog.getByLabel("Last name").fill("Venture-Test");
  await dialog.getByLabel("Date of birth").fill("2009-04-18");
  await dialog.getByRole("checkbox", { name: "Ventures" }).check();
  await expect(dialog.getByRole("checkbox", { name: "Ventures" })).toBeChecked();
  await expect(dialog.getByRole("combobox", { name: "Primary section" })).toHaveText("Ventures");
  await dialog.getByRole("button", { name: "Add Member" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId(/member-card-/).filter({ hasText: displayName })).toBeVisible();

  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Ventures", exact: true }).click();
  await expect(page.getByTestId("member-card-TEST_member_venture_01")).toBeVisible();
  const ventureCard = page.getByTestId(/member-card-/).filter({ hasText: displayName });
  await expect(ventureCard).toBeVisible();
  await expect(ventureCard).toContainText("Active");
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "All Sections" }).click();
  await expect(page.getByTestId("member-card-TEST_member_venture_01")).toBeVisible();
  await expect(page.getByTestId(/member-card-/).filter({ hasText: displayName })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Member Management" })).toBeVisible();
  await expect(page.getByTestId(/member-card-/).filter({ hasText: displayName })).toBeVisible();
  await page.goto("/leader");
  await page.goto("/leader/members?section=Ventures");
  await expect(page.getByTestId(/member-card-/).filter({ hasText: displayName })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
});
