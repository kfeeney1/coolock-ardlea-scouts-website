import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Operations overview checks run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
}

for (const [role, email] of [
  ["Admin", "test.admin@example.com"],
  ["Super Admin", "test.superadmin@example.com"]
] as const) {
  test(`${role} sees the full operations overview and approval queues`, async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

    await login(page, email);
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();

    const overview = page.getByTestId("admin-overview");
    await expect(overview.getByText("Scope: All sections")).toBeVisible();
    await expect(overview.getByText("Pending Parent Requests")).toBeVisible();
    await expect(overview.getByText("Pending Leader Requests")).toBeVisible();
    await expect(overview.getByText("New Join Applications")).toBeVisible();
    await expect(overview.getByText("Active Members")).toBeVisible();
    await expect(overview.getByText("Outstanding Event Consent")).toBeVisible();
    await expect(overview.getByRole("heading", { name: "Members by Section" })).toBeVisible();
    await expect(overview.getByRole("heading", { name: "Upcoming Events" })).toBeVisible();
    await expect(overview.getByRole("link", { name: "Manage Members" })).toHaveAttribute("href", "/leader/members");
    await expect(overview.getByRole("link", { name: "View All" })).toHaveAttribute("href", "/leader/events");
  });
}

test("section leader sees a scoped operations overview without admin approval queues", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.leader.only@example.com");
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();

  const overview = page.getByTestId("admin-overview");
  await expect(overview.getByText(/^Scope:/)).toBeVisible();
  await expect(overview.getByText("New Join Applications")).toBeVisible();
  await expect(overview.getByText("Active Members")).toBeVisible();
  await expect(overview.getByText("Outstanding Event Consent")).toBeVisible();
  await expect(overview.getByText("Pending Parent Requests")).toHaveCount(0);
  await expect(overview.getByText("Pending Leader Requests")).toHaveCount(0);
});
