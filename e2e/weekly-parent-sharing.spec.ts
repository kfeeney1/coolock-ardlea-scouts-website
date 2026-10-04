import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;
const sectionLeaderEmail = process.env.E2E_SECTION_LEADER_EMAIL || "test.scout.section.leader@example.com";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Weekly parent-sharing coverage runs once on desktop Chromium.");
}

async function login(page: Page, email: string, portal: "parent" | "leader") {
  await page.goto(portal === "parent" ? "/parent" : "/leader/login");
  await page.getByLabel(portal === "parent" ? "Email" : "Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("approved parent sees programme and badgework but never leader-only meeting data", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !parentEmail, "Configure canonical E2E parent credentials.");
  await login(page, parentEmail!, "parent");
  await expect(page.getByText(/Your account is approved and linked to 2 member records/i)).toBeVisible();

  const programme = page.getByTestId("parent-weekly-programme");
  await expect(programme.getByRole("heading", { name: "Weekly Meeting Programme" })).toBeVisible();
  await expect(programme.getByText("Opening game", { exact: false }).first()).toBeVisible();
  await expect(programme.getByText("Adventure Skills", { exact: false }).first()).toBeVisible();
  await expect(programme).not.toContainText("TEST Completed Badge");
  await expect(programme).not.toContainText("TEST minor graze");
  await expect(programme).not.toContainText("Historical post-meeting note");
  await expect(programme).not.toContainText("Section Leader");
});

test("leader WhatsApp share includes programme, completed badgework and equipment without member identity", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure canonical E2E leader credentials.");
  await login(page, sectionLeaderEmail, "leader");
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await page.goto("/leader/weekly");

  const historyCard = page.getByTestId(/meeting-history-/).filter({ hasText: "15 Jan 2099 · Scouts" });
  await expect(historyCard).toBeVisible();
  await historyCard.getByRole("button", { name: "View / Edit", exact: true }).click();

  const share = page.getByTestId("weekly-whatsapp-share");
  await expect(share).toBeVisible();
  await expect(share).toBeEnabled();
  const href = await share.getAttribute("href");
  expect(href).toBeTruthy();
  expect(href).toMatch(/^https:\/\/wa\.me\/\?text=/);
  const text = decodeURIComponent(href!.split("?text=")[1] || "");
  expect(text).toContain("Opening game");
  expect(text).toContain("Adventure Skills");
  expect(text).toContain("Equipment: Cones");
  expect(text).toContain("Badgework:");
  expect(text).toContain("TEST Completed Badge");
  for (const privateValue of ["TEST minor graze", "Historical post-meeting note", "Section Leader", "Fast opener", "Reusable programme template"]) {
    expect(text).not.toContain(privateValue);
  }
});


test("SW-290 completed Badgework entered in UI survives save reload and WhatsApp share", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure canonical E2E leader credentials.");
  await login(page, sectionLeaderEmail, "leader");
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await page.goto("/leader/weekly/create");
  await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible();
  await page.getByLabel("Meeting date").fill("2099-04-12");
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await page.getByRole("button", { name: "Mark all present", exact: true }).click();
  await page.getByRole("button", { name: "Completed Badgework", exact: true }).click();
  const completed = page.getByLabel(/Other completed badges · /).first();
  await expect(completed).toBeVisible();
  await completed.fill("SW-290 Lifecycle Badge");
  await page.getByRole("button", { name: "Save Meeting", exact: true }).click();
  await expect(page.getByText("Meeting saved.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Completed Badgework", exact: true }).click();
  await expect(page.getByLabel(/Other completed badges · /).first()).toHaveValue("SW-290 Lifecycle Badge");

  const share = page.getByTestId("weekly-whatsapp-share");
  await expect(share).toBeEnabled();
  const href = await share.getAttribute("href");
  expect(href).toMatch(/^https:\/\/wa\.me\/\?text=/);
  const text = decodeURIComponent(href!.split("?text=")[1] || "");
  expect(text).toContain("Badgework:");
  expect(text).toContain("SW-290 Lifecycle Badge");
});
