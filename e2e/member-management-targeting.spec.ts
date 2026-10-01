import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
    test.skip(testInfo.project.name !== "chromium", "Member Management targeting runs once on desktop Chromium.");
}

async function loginAdmin(page: Page) {
    await page.goto("/leader/login");
    await page.getByLabel("Email address").fill("test.webadmin@example.com");
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}


test("active Member Management is surname-first across All Sections, filters and search", async ({ page }, testInfo) => {
    test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Surname ordering runs on desktop Chromium and Pixel 7 Chromium.");
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/members");

    const cards = page.locator("[data-testid^='member-card-']");
    await expect(cards.first()).toBeVisible();
    const readNames = async () => cards.evaluateAll((items) => items.map((card) => ({
        firstName: card.getAttribute("data-member-first-name")?.trim().replace(/\s+/g, " ") || "",
        lastName: card.getAttribute("data-member-last-name")?.trim().replace(/\s+/g, " ") || "",
        displayName: card.querySelector("h5")?.textContent?.trim() || "",
    })));
    const compareText = (left: string, right: string) => left.localeCompare(right, "en-IE", { sensitivity: "base" });
    const expectSurnameFirstOrder = (members: Awaited<ReturnType<typeof readNames>>) => {
        const sorted = [...members].sort((a, b) => {
            const aSurname = a.lastName.toLocaleLowerCase("en-IE");
            const bSurname = b.lastName.toLocaleLowerCase("en-IE");
            if (!aSurname || !bSurname) {
                if (!aSurname && bSurname) return 1;
                if (aSurname && !bSurname) return -1;
            }
            return compareText(aSurname || a.firstName || a.displayName, bSurname || b.firstName || b.displayName)
                || compareText(a.firstName, b.firstName)
                || compareText(a.displayName, b.displayName);
        });
        expect(members).toEqual(sorted);
    };
    const allMembers = await readNames();
    expect(allMembers.length).toBeGreaterThan(1);
    expectSurnameFirstOrder(allMembers);

    await page.getByRole("combobox", { name: "Section" }).click();
    await page.getByRole("option", { name: "Beavers", exact: true }).click();
    const sectionMembers = await readNames();
    expect(sectionMembers.length).toBeGreaterThan(0);
    expectSurnameFirstOrder(sectionMembers);

    const search = page.getByRole("textbox", { name: "Search members" });
    await search.fill(sectionMembers[0].lastName || sectionMembers[0].firstName);
    const searchedMembers = await readNames();
    expectSurnameFirstOrder(searchedMembers);
});

test("member status tiles filter and jump to member results", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/members");

    const summary = page.getByRole("group", { name: "Member status summary" });
    const inactiveTile = summary.getByRole("button", { name: /Inactive/ });
    await inactiveTile.click();

    const results = page.getByRole("region", { name: "Member results" });
    await expect(results).toBeFocused();
    await expect(results).toBeInViewport();
    await expect(inactiveTile).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveText(/Inactive/);

    const header = page.locator("[data-site-sticky-header]");
    await expect(header).toBeVisible();
    const [headerBox, resultsBox] = await Promise.all([header.boundingBox(), results.boundingBox()]);
    expect(headerBox).not.toBeNull();
    expect(resultsBox).not.toBeNull();
    expect(resultsBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
});

test("member status tiles support keyboard activation", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/members");

    const summary = page.getByRole("group", { name: "Member status summary" });
    const totalTile = summary.getByRole("button", { name: /Total/ });
    await totalTile.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("region", { name: "Member results" })).toBeFocused();
    await expect(totalTile).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveText(/All Statuses/);
});

test("member status change requires review and cancel does not persist it", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/members");

    const card = page.getByTestId("member-card-TEST_member_beaver_01");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Active");
    const memberName = (await card.getByRole("heading").textContent())?.trim() || "";
    await card.getByRole("button", { name: "Manage" }).click();

    await expect(page).toHaveURL(/\/leader\/members\/TEST_member_beaver_01$/);
    await expect(page.getByRole("heading", { name: memberName, level: 1 })).toBeVisible();

    const familyPanel = page.getByTestId("member-family-management");
    await expect(familyPanel).toBeVisible();
    await expect(familyPanel).toContainText(/do not grant Parent Portal access/i);
    await expect(familyPanel.getByLabel("Search existing members")).toBeVisible();

    const status = page.getByRole("combobox").filter({ hasText: "Active" });
    await status.click();
    await page.getByRole("option", { name: "Left", exact: true }).click();
    await page.getByRole("button", { name: "Save Member", exact: true }).click();

    const confirmation = page.getByRole("dialog", { name: "Confirm member status change?" });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText(memberName);
    await expect(confirmation).toContainText("Active to Left");
    await expect(confirmation).toContainText("record and lifecycle history are retained");
    await expect(confirmation).toContainText(/explicit parent-child links only/i);
    await expect(confirmation.getByRole("button", { name: "Disable member only", exact: true })).toBeVisible();

    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(confirmation).toBeHidden();
    await expect(page.getByRole("combobox").filter({ hasText: "Left" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: memberName, level: 1 })).toBeVisible();
    await expect(page.getByRole("combobox").filter({ hasText: "Active" })).toBeVisible();
});


test("display name follows member name until deliberately customised", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/members/TEST_member_beaver_01");

    const firstName = page.getByLabel("First name");
    const lastName = page.getByLabel("Last name");
    const displayName = page.getByLabel("Display name");
    const originalFirst = await firstName.inputValue();
    const originalLast = await lastName.inputValue();

    // The canonical fixture intentionally has a legacy/custom display label.
    // Reset it first so this test exercises the automatic-name lifecycle rather
    // than incorrectly assuming every existing member is already automatic.
    const reset = page.getByRole("button", { name: "Reset to automatic" });
    if (await reset.isVisible()) await reset.click();
    await expect(displayName).toHaveValue(`${originalFirst} ${originalLast}`);

    await firstName.fill(originalFirst + " Test");
    await expect(displayName).toHaveValue(`${originalFirst} Test ${originalLast}`);

    await displayName.fill("Preferred Test Name");
    await expect(page.getByRole("button", { name: "Reset to automatic" })).toBeVisible();
    await lastName.fill(originalLast + " Changed");
    await expect(displayName).toHaveValue("Preferred Test Name");

    await page.getByRole("button", { name: "Reset to automatic" }).click();
    await expect(displayName).toHaveValue(`${originalFirst} Test ${originalLast} Changed`);
    await expect(page.getByRole("button", { name: "Reset to automatic" })).toBeHidden();

    // Do not persist fixture mutations; reload proves the editor-only lifecycle is reversible.
    await page.reload();
    await expect(firstName).toHaveValue(originalFirst);
    await expect(lastName).toHaveValue(originalLast);
});
