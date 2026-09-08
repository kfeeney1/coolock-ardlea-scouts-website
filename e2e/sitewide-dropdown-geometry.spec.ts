import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";

function supportedProject(testInfo: TestInfo) {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Site-wide dropdown geometry runs on desktop Chromium and Pixel 7 Chromium.");
}

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(adminEmail);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function viewportState(page: Page) {
  return page.evaluate(() => ({
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    clientWidth: document.documentElement.clientWidth
  }));
}

async function placeTriggerAtViewportEdge(trigger: Locator) {
  await trigger.evaluate((element) => {
    element.scrollIntoView({ block: "end", inline: "nearest", behavior: "instant" });
  });
  await expect(trigger).toBeInViewport();
}

async function expectAttachedDropdown(page: Page, trigger: Locator, verifyScrollDismiss = false) {
  await expect(trigger).toBeVisible();
  await placeTriggerAtViewportEdge(trigger);
  const triggerHandle = await trigger.elementHandle();
  expect(triggerHandle).not.toBeNull();
  const beforeOpen = await viewportState(page);

  await trigger.click();
  const listbox = page.getByRole("listbox").last();
  await expect(listbox).toBeVisible();
  await expect.poll(() => viewportState(page)).toEqual(beforeOpen);

  const [triggerBox, menuBox] = await Promise.all([
    triggerHandle!.boundingBox(),
    listbox.boundingBox()
  ]);
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();

  const verticalGap = Math.max(
    triggerBox!.y - (menuBox!.y + menuBox!.height),
    menuBox!.y - (triggerBox!.y + triggerBox!.height),
    0
  );
  expect(verticalGap).toBeLessThanOrEqual(2);
  expect(menuBox!.x).toBeLessThan(triggerBox!.x + triggerBox!.width);
  expect(menuBox!.x + menuBox!.width).toBeGreaterThan(triggerBox!.x);

  if (verifyScrollDismiss) {
    const beforeScroll = await viewportState(page);
    const scrollDelta = await page.evaluate(() => {
      const remainingBelow = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      const delta = remainingBelow >= 80 ? Math.min(160, remainingBelow) : -Math.min(160, window.scrollY);
      window.scrollBy({ top: delta, behavior: "instant" });
      return delta;
    });
    expect(scrollDelta).not.toBe(0);
    await expect(listbox).toBeHidden();
    await expect.poll(async () => (await viewportState(page)).scrollY).toBe(beforeScroll.scrollY + scrollDelta);
    return;
  }

  await page.keyboard.press("Escape");
  await expect(listbox).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => viewportState(page)).toEqual(beforeOpen);
}

test("representative site-wide dropdowns stay attached at viewport edges", async ({ page }, testInfo) => {
  supportedProject(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);

  await page.goto("/leader/join");
  await expectAttachedDropdown(page, page.getByRole("combobox", { name: "Status" }).first());

  await page.goto("/leader/access");
  await expect(page.getByTestId("leader-access-TEST_uid_multi_section_leader")).toBeVisible();
  await expectAttachedDropdown(page, page.getByRole("combobox", { name: "Reports to" }).first());

  await page.goto("/leader/badgework");
  await expect(page.getByRole("heading", { name: "Adventure Skills Badgework", exact: true })).toBeVisible();
  await expectAttachedDropdown(page, page.getByRole("combobox", { name: "Section", exact: true }), true);
});
