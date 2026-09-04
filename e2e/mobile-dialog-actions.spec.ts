import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const accounts = [
  ["default", process.env.E2E_ADMIN_EMAIL],
  ["modern", process.env.E2E_MODERN_SUPER_ADMIN_EMAIL]
] as const;

function mobileOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile dialog actions run on the Pixel 7 project only.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

for (const [theme, email] of accounts) {
  test(`${theme} theme keeps long confirmation actions usable on mobile`, async ({ page }, testInfo) => {
    mobileOnly(testInfo);
    test.skip(!password || !email, `Configure the ${theme} theme E2E account.`);

    await login(page, email!);
    await page.goto("/leader/parent-access");
    const pendingCard = page.getByTestId("parent-access-TEST_flow_parent_pending");
    await expect(pendingCard).toBeVisible();
    await pendingCard.getByRole("button", { name: "Manage Linked Children", exact: true }).click();
    await page.getByLabel("Search members for Test Pending Parent").fill("Riley Nolan");
    await page.getByRole("checkbox").check();
    await pendingCard.getByRole("button", { name: "Approve Access", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Approve parent access?" });
    const actions = dialog.locator(".MuiDialogActions-root");
    const back = actions.getByRole("button", { name: "Back to review", exact: true });
    const approve = actions.getByRole("button", { name: "Approve Access", exact: true });
    await expect(actions).toBeVisible();
    await expect(back).toBeVisible();
    await expect(approve).toBeVisible();

    const [actionsBox, backBox, approveBox] = await Promise.all([
      actions.boundingBox(),
      back.boundingBox(),
      approve.boundingBox()
    ]);
    expect(actionsBox).not.toBeNull();
    expect(backBox).not.toBeNull();
    expect(approveBox).not.toBeNull();
    expect(actionsBox!.x).toBeGreaterThanOrEqual(0);
    expect(actionsBox!.x + actionsBox!.width).toBeLessThanOrEqual(412);
    expect(backBox!.width).toBe(approveBox!.width);
    expect(approveBox!.y + approveBox!.height).toBeLessThanOrEqual(backBox!.y);

    await back.click();
    await expect(dialog).toBeHidden();
  });
}
