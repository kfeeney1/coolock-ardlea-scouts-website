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
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight
  }));
}

async function placeTriggerAtViewportEdge(trigger: Locator) {
  await trigger.evaluate((element) => {
    element.scrollIntoView({ block: "end", inline: "nearest", behavior: "instant" });
  });
  await expect(trigger).toBeInViewport();
}

async function controlledListbox(page: Page, trigger: Locator) {
  await expect.poll(() => trigger.getAttribute("aria-controls")).not.toBeNull();
  const listboxId = await trigger.getAttribute("aria-controls");
  expect(listboxId).toBeTruthy();
  const listbox = page.locator(`[id="${listboxId}"]`);
  await expect(listbox).toHaveRole("listbox");
  await expect(listbox).toBeVisible();
  return listbox;
}

async function expectAttachedGeometry(page: Page, trigger: Locator, listbox: Locator) {
  const [triggerBox, menuBox, viewport] = await Promise.all([
    trigger.boundingBox(),
    listbox.boundingBox(),
    viewportState(page)
  ]);
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();

  const verticalGap = Math.max(
    triggerBox!.y - (menuBox!.y + menuBox!.height),
    menuBox!.y - (triggerBox!.y + triggerBox!.height),
    0
  );
  expect(verticalGap).toBeLessThanOrEqual(8);
  expect(menuBox!.x).toBeLessThan(triggerBox!.x + triggerBox!.width);
  expect(menuBox!.x + menuBox!.width).toBeGreaterThan(triggerBox!.x);
  expect(menuBox!.x).toBeGreaterThanOrEqual(-1);
  expect(menuBox!.y).toBeGreaterThanOrEqual(-1);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport.clientWidth + 1);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(viewport.clientHeight + 1);
}

async function openAttachedDropdown(page: Page, trigger: Locator) {
  await expect(trigger).toBeVisible();
  await placeTriggerAtViewportEdge(trigger);
  const beforeOpen = await viewportState(page);
  await trigger.click();
  const listbox = await controlledListbox(page, trigger);
  await expect(page.getByRole("listbox").filter({ visible: true })).toHaveCount(1);
  await expect.poll(() => viewportState(page)).toEqual(beforeOpen);
  await expectAttachedGeometry(page, trigger, listbox);
  return { beforeOpen, listbox };
}

async function expectEscapeClosePreservesScroll(page: Page, trigger: Locator) {
  const { beforeOpen, listbox } = await openAttachedDropdown(page, trigger);
  await page.keyboard.press("Escape");
  await expect(listbox).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => viewportState(page)).toEqual(beforeOpen);
}

async function expectSelectionPreservesScroll(page: Page, trigger: Locator) {
  const { beforeOpen, listbox } = await openAttachedDropdown(page, trigger);
  const option = listbox.getByRole("option").locator(':not([aria-selected="true"])').first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(listbox).toBeHidden();
  await expect.poll(() => viewportState(page)).toEqual(beforeOpen);
}

async function expectScrollDismissesWithoutJumpingBack(page: Page, trigger: Locator) {
  const { listbox } = await openAttachedDropdown(page, trigger);
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
}

test("ordinary and TextField selects stay anchored without open, select, or close scroll jumps", async ({ page }, testInfo) => {
  supportedProject(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);

  await page.goto("/leader/join");
  await expectEscapeClosePreservesScroll(page, page.getByRole("combobox", { name: "Status" }).first());
  await expectSelectionPreservesScroll(page, page.getByRole("combobox", { name: "Status" }).first());

  await page.goto("/leader/access");
  await expect(page.getByTestId("leader-access-TEST_uid_multi_section_leader")).toBeVisible();
  await expectEscapeClosePreservesScroll(page, page.getByRole("combobox", { name: "Reports to" }).first());
});

test("opening a second dropdown leaves only the intended listbox and no stale overlay", async ({ page }, testInfo) => {
  supportedProject(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/access");
  await expect(page.getByTestId("leader-access-TEST_uid_multi_section_leader")).toBeVisible();

  const reportsTo = page.getByRole("combobox", { name: "Reports to" });
  expect(await reportsTo.count()).toBeGreaterThanOrEqual(2);
  const first = reportsTo.nth(0);
  const second = reportsTo.nth(1);
  const { listbox: firstListbox } = await openAttachedDropdown(page, first);
  await second.click();
  const secondListbox = await controlledListbox(page, second);
  await expect(firstListbox).toBeHidden();
  await expect(secondListbox).toBeVisible();
  await expect(page.getByRole("listbox").filter({ visible: true })).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(secondListbox).toBeHidden();
  await first.click();
  await expect(await controlledListbox(page, first)).toBeVisible();
});

test("SectionSelect stays associated with its trigger on a long page and closes on scroll", async ({ page }, testInfo) => {
  supportedProject(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/badgework");
  await expect(page.getByRole("heading", { name: "Adventure Skills Badgework", exact: true })).toBeVisible();
  await expectScrollDismissesWithoutJumpingBack(page, page.getByRole("combobox", { name: "Section", exact: true }));
});
