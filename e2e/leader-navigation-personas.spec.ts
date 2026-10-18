import { expect, test, type Page } from "@playwright/test";
import { accountNavItems, dashboardNavItem, leaderNavGroups, redesignedNavigationGroups, type LeaderNavItem } from "../src/navigation/leaderNavigation";
import { loginAsLeader } from "./support/authentication-helpers";
import { categoryRouteSamples, navigationPersonas, personaAccountDestinations } from "./support/leader-navigation-personas";

const password = process.env.E2E_TEST_USER_PASSWORD;
const items = [dashboardNavItem, ...leaderNavGroups.flatMap((group) => group.items), ...accountNavItems];
const byId = new Map(items.map((item) => [item.id, item]));
const existingOrder = ["programme", "people-parents", "treasurer", "secretary", "quartermaster", "group-operations", "insights-records", "administration"];
const redesignedOrder = ["programme", "people-parents", "secretary", "quartermaster", "group-operations", "treasurer", "insights-records", "administration", "super-admin"];

async function selectVersion(page: Page, redesigned: boolean) {
  await page.goto("/leader/settings");
  const choice = page.getByRole("button", { name: `${redesigned ? "Redesigned" : "Existing"} navigation`, exact: true });
  await expect(choice).toBeEnabled();
  if (await choice.getAttribute("aria-pressed") !== "true") await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
}
async function openMenu(page: Page) {
  const toggle = page.locator('button[aria-controls="leader-navigation"]');
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect(page.getByRole("navigation", { name: "Leader navigation", exact: true })).toBeVisible();
}
async function identity(page: Page, item: LeaderNavItem) {
  if ("testId" in item.identity) await expect(page.getByTestId(item.identity.testId)).toBeVisible();
  else await expect(page.getByRole("heading", { name: item.identity.heading, exact: true, ...(item.identity.level ? { level: item.identity.level } : {}) })).toBeVisible();
}

for (const redesigned of [false, true]) {
  const groups = redesigned ? redesignedNavigationGroups(leaderNavGroups) : leaderNavGroups;
  for (const persona of navigationPersonas) {
    test(`${redesigned ? "Redesigned" : "Existing"} permission matrix: ${persona.name}`, async ({ page, browser, baseURL }, testInfo) => {
      test.skip(!password, "Configure canonical E2E credentials.");
      const settingsContext = await browser.newContext({ baseURL });
      const settingsPage = await settingsContext.newPage();
      const mobile = testInfo.project.name === "mobile-chromium";
      const root = page.getByTestId(redesigned ? "leader-navigation-redesigned" : mobile ? "leader-navigation-mobile" : "leader-navigation-desktop");
      const nav = page.getByRole("navigation", { name: "Leader navigation", exact: true });
      const expected: Record<string, string[]> = Object.fromEntries(Object.entries(persona.groups).map(([id, destinations]) => [id, [...destinations]]));
      if (redesigned && expected.administration.includes("system-information")) {
        expected.administration = expected.administration.filter((id) => id !== "system-information");
        expected["super-admin"] = ["system-information"];
      }
      const expectedIds = ["dashboard", ...Object.values(expected).flat(), ...personaAccountDestinations];
      const expectedCategories = (redesigned ? redesignedOrder : existingOrder).filter((id) => expected[id]?.length);
      const categoryToggle = (id: string, label: string) => redesigned
        ? root.locator(`button[aria-controls="redesigned-${id}-panel"]`)
        : root.getByRole("button", { name: label, exact: true });
      const expose = async (id: string) => {
        await openMenu(page);
        const group = groups.find((entry) => entry.items.some((item) => item.id === id));
        if (group && (redesigned || mobile)) {
          const toggle = categoryToggle(group.id, group.label);
          if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
        }
        return (group ? root : nav).getByTestId(`leader-nav-${id}`);
      };
      try {
        await loginAsLeader(settingsPage, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
        await selectVersion(settingsPage, redesigned);
        await loginAsLeader(page, { email: persona.email, password: password! });
        await expect(page.getByTestId("admin-overview")).toBeVisible();
        await openMenu(page);
        await expect(root).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const actualIds: string[] = [];
        for (const group of groups) {
          const wanted = expected[group.id];
          const title = redesigned || mobile ? categoryToggle(group.id, group.label) : root.getByText(group.label, { exact: true });
          await expect(title).toHaveCount(wanted ? 1 : 0);
          if (!wanted) continue;
          let links;
          if (redesigned || mobile) {
            await expect(title).toContainText(group.label);
            if (await title.getAttribute("aria-expanded") !== "true") await title.click();
            await expect(root.getByRole("region")).toHaveCount(1);
            links = root.getByRole("region").getByRole("link");
          } else {
            links = title.locator("..").getByRole("link");
          }
          const actual = await links.evaluateAll((elements) => elements.map((element) => ({ id: element.getAttribute("data-testid")!.replace("leader-nav-", ""), href: element.getAttribute("href") })));
          expect(actual.map((item) => item.id).sort(), `${persona.name}: ${group.label}`).toEqual([...wanted].sort());
          for (const item of actual) expect(item.href, item.id).toBe(byId.get(item.id)!.path);
          actualIds.push(...actual.map((item) => item.id));
        }
        for (const id of ["dashboard", ...personaAccountDestinations]) {
          const link = nav.getByTestId(`leader-nav-${id}`);
          await expect(link).toBeVisible();
          await expect(link).toHaveCount(1);
          await expect(link).toHaveAttribute("href", byId.get(id)!.path);
          actualIds.push(id);
        }
        expect(new Set(actualIds).size).toBe(actualIds.length);
        expect(actualIds.sort()).toEqual([...expectedIds].sort());
        for (const item of items.filter((entry) => !expectedIds.includes(entry.id))) {
          // Include collapsed/hidden DOM: unauthorised links must be omitted.
          await expect(nav.getByTestId(`leader-nav-${item.id}`)).toHaveCount(0);
        }
        if (redesigned) {
          expect(await root.locator("button[aria-controls]").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-controls")))).toEqual(expectedCategories.map((id) => `redesigned-${id}-panel`));
        } else if (mobile) {
          expect(await root.getByRole("button").allTextContents()).toEqual(expectedCategories.map((id) => groups.find((group) => group.id === id)!.label));
        }
        await page.keyboard.press("Escape");
        await expect(nav).toBeHidden();

        const samples = [...new Set([persona.primary, ...expectedCategories.map((id) => categoryRouteSamples[id]), "my-profile"] )];
        for (const id of samples) {
          const item = byId.get(id)!;
          const destination = await expose(id);
          await expect(destination).toBeVisible();
          expect((await destination.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          await destination.click();
          await expect(page).toHaveURL(new URL(item.path, baseURL).href);
          await identity(page, item);
          if (id === persona.primary) {
            // Preserve the previous fresh-session, reload and Back assurances.
            await page.reload(); await identity(page, item);
            await expose(id);
            await expect((groups.some((group) => group.items.some((entry) => entry.id === id)) ? root : nav).getByTestId(`leader-nav-${id}`)).toHaveAttribute("aria-current", "page");
            await page.goBack(); await expect(nav).toBeHidden(); await identity(page, item);
            await page.goBack(); await expect(page).toHaveURL(/\/leader$/);
            await expect(page.getByTestId("admin-overview")).toBeVisible();
          }
        }
        if (!expectedIds.includes("system-information")) {
          await page.goto("/leader/system");
          await expect(page).toHaveURL(/\/leader$/);
          await expect(page.getByTestId("admin-overview")).toBeVisible();
          await expect(page.getByRole("heading", { name: "System Information", exact: true, includeHidden: true })).toHaveCount(0);
          await page.goto("/leader/settings");
          await expect(page.getByTestId("page-settings").or(page.getByTestId("admin-overview"))).toBeVisible();
          await expect(page.getByRole("button", { name: "Redesigned navigation", exact: true, includeHidden: true })).toHaveCount(0);
        }
      } finally {
        try { await selectVersion(settingsPage, false); } finally { await settingsContext.close(); }
      }
    });
  }
}
