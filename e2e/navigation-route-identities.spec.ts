import { expect, test } from "@playwright/test";
import { credentials, login, openMenu, exposeGroup, clickNavItem, assertSiblingNotCurrent, projectNavigation, exposeQuartermaster } from "./support/navigation-recovery-helpers";

test.describe("SW-178 canonical role navigation — direct route identities", () => {
  test("role-specific direct routes cannot be claimed by sibling navigation identities", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    for (const [route, currentId, siblingIds] of [
      ["/leader/settings", "settings", ["treasurer-settings", "qm-settings"]],
      ["/leader/settings?view=treasurer", "treasurer-settings", ["settings", "qm-settings"]],
      ["/leader/settings?view=quartermaster", "qm-settings", ["settings", "treasurer-settings"]],
      ["/leader/reports?view=treasurer", "treasurer-reports", ["reports-exports"]],
      ["/leader/reports?view=insights", "reports-exports", ["treasurer-reports"]],
      ["/leader/equipment?view=quartermaster", "qm-equipment-stores", ["group-equipment-stores"]],
      ["/leader/equipment?view=group-operations", "group-equipment-stores", ["qm-equipment-stores"]],
      ["/leader/meetings?view=secretary", "secretary-meeting-records", ["group-meeting-records"]],
      ["/leader/meetings?view=group-operations", "group-meeting-records", ["secretary-meeting-records"]],
      ["/leader/finance?view=treasurer", "treasurer-floats", ["group-section-floats"]],
      ["/leader/finance?view=group-operations", "group-section-floats", ["treasurer-floats"]],
      ["/leader/subs?view=treasurer", "treasurer-subs", ["group-subs", "family-billing"]],
      ["/leader/subs?view=group-operations", "group-subs", ["treasurer-subs", "family-billing"]],
      ["/leader/subs#family-billing", "family-billing", ["treasurer-subs", "group-subs"]],
    ] as const) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
      // Some destinations first render the shared header inside a loading branch
      // and then replace it with the settled page shell. Wait for the specific
      // destination identity before interacting with that header so this test
      // checks navigation identity rather than the route's data-load transition.
      const pageIdentity = currentId === "family-billing" ? "subs" : currentId;
      await expect(page.getByTestId(`page-${pageIdentity}`)).toBeVisible();
      const groupByItem: Record<string, string> = {
        settings: "Administration", "treasurer-settings": "Treasurer", "qm-settings": "Quartermaster / Bo’sun",
        "treasurer-reports": "Treasurer", "reports-exports": "Insights & Records",
        "qm-equipment-stores": "Quartermaster / Bo’sun", "group-equipment-stores": "Group Operations",
        "secretary-meeting-records": "Secretary", "group-meeting-records": "Group Operations",
        "treasurer-floats": "Treasurer", "group-section-floats": "Group Operations",
        "treasurer-subs": "Treasurer", "group-subs": "Group Operations", "family-billing": "People & Parents",
      };
      let navigation = await exposeGroup(page, testInfo, groupByItem[currentId]);
      await expect(navigation.getByTestId("leader-nav-" + currentId)).toHaveAttribute("aria-current", "page");
      for (const siblingId of siblingIds) {
        navigation = await exposeGroup(page, testInfo, groupByItem[siblingId]);
        await expect(navigation.getByTestId("leader-nav-" + siblingId)).not.toHaveAttribute("aria-current", "page");
      }
    }
  });
});
