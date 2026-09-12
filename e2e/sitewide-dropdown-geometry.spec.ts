import { expect, test, type ElementHandle, type Locator, type Page, type TestInfo } from "@playwright/test";

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

async function visibleListbox(page: Page) {
  const listbox = page.locator('[role="listbox"]:visible');
  await expect(listbox).toHaveCount(1);
  await expect(listbox).toBeVisible();
  return listbox;
}

async function triggerHandle(trigger: Locator) {
  const handle = await trigger.elementHandle();
  expect(handle).not.toBeNull();
  return handle as ElementHandle<HTMLElement>;
}

async function expectAttachedGeometry(page: Page, trigger: ElementHandle<HTMLElement>, listbox: Locator) {
  const menuBox = await listbox.evaluate((element) => {
    const surface = element.closest(".MuiPaper-root");
    const rect = (surface ?? element).getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const [triggerBox, viewport] = await Promise.all([
    trigger.boundingBox(),
    viewportState(page)
  ]);
  expect(triggerBox).not.toBeNull();

  const verticalGap = Math.max(
    triggerBox!.y - (menuBox.y + menuBox.height),
    menuBox.y - (triggerBox!.y + triggerBox!.height),
    0
  );
  expect(verticalGap).toBeLessThanOrEqual(8);
  expect(menuBox.x).toBeLessThan(triggerBox!.x + triggerBox!.width);
  expect(menuBox.x + menuBox.width).toBeGreaterThan(triggerBox!.x);
  expect(menuBox.x).toBeGreaterThanOrEqual(-1);
  expect(menuBox.y).toBeGreaterThanOrEqual(-1);
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.clientWidth + 1);
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.clientHeight + 1);
}

async function openAttachedDropdown(page: Page, trigger: Locator) {
  await expect(trigger).toBeVisible();
  await placeTriggerAtViewportEdge(trigger);
  const triggerElement = await triggerHandle(trigger);
  const beforeOpen = await viewportState(page);
  await trigger.click();
  const listbox = await visibleListbox(page);
  await expect.poll(() => viewportState(page)).toEqual(beforeOpen);
  await expectAttachedGeometry(page, triggerElement, listbox);
  return { beforeOpen, listbox, triggerElement };
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
  const option = listbox.locator('[role="option"]:not([aria-selected="true"])').first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(listbox).toBeHidden();
  await expect.poll(() => viewportState(page)).toEqual(beforeOpen);
}

async function expectBackgroundScrollLocked(page: Page, trigger: Locator) {
  const { beforeOpen, listbox } = await openAttachedDropdown(page, trigger);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
  await page.mouse.wheel(0, 500);
  await expect(listbox).toBeVisible();
  await expect.poll(() => viewportState(page)).toEqual(beforeOpen);
  await page.keyboard.press("Escape");
  await expect(listbox).toBeHidden();
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
  const firstElement = await triggerHandle(first);
  const secondElement = await triggerHandle(second);

  await openAttachedDropdown(page, first);
  await secondElement.click();
  const secondListbox = await visibleListbox(page);
  await expectAttachedGeometry(page, secondElement, secondListbox);

  await page.keyboard.press("Escape");
  await expect(secondListbox).toBeHidden();

  await firstElement.click();
  const reopenedFirstListbox = await visibleListbox(page);
  await expectAttachedGeometry(page, firstElement, reopenedFirstListbox);
});

test("SectionSelect stays associated with its trigger and locks background scrolling", async ({ page }, testInfo) => {
  supportedProject(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/badgework");
  await expect(page.getByRole("heading", { name: "Adventure Skills Badgework", exact: true })).toBeVisible();
  await expectBackgroundScrollLocked(page, page.getByRole("combobox", { name: "Section", exact: true }));
});