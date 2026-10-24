import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
for (const version of ["existing", "redesigned"]) for (const manager of [true, false]) {
  test(`SW-537 dashboard open polls only (${version}, ${manager ? "manager" : "voter"})`, async ({page}) => {
    const db = scheduleFixtureDb(), setting = db.doc("siteSettings/leaderNavigation"), previous = await setting.get();
    const refs = ["published", "draft", "closed", "ineligible"].map(state => db.collection("polls").doc(`sw537-${state}`));
    const options = ["Hike", "Camp"];
    try {
      await setting.set({version});
      for (const [index, ref] of refs.entries()) {
        const scope = {audienceType: "leaders", scopeType: "sections", scopeSections: ["Scouts"], status: index === 1 ? "draft" : index === 2 ? "closed" : "published"};
        // Parent audience is inaccessible to a leader voter, including a manager.
        if (index === 3) scope.audienceType = "parents";
        await ref.set({...scope, question: `SW537 ${index}`, options, createdBy: "fixture"});
        await ref.collection("audienceSections").doc("Scouts").set({...scope, section: "Scouts", pollId: ref.id});
        for (const [optionIndex, option] of options.entries()) await ref.collection("results").doc(String(optionIndex)).set({option, optionIndex, count: 0});
      }
      await loginAsLeader(page, {email: manager ? "superadmin@example.com" : "test.scout.programme.scouter@example.com", password: process.env.E2E_TEST_USER_PASSWORD!});
      const panel = page.getByTestId("leader-polls");
      await expect(panel.getByTestId("poll-create-form")).toHaveCount(0);
      await expect(panel.getByTestId(/^leader-poll-manager-/)).toHaveCount(0);
      // Superuser's Group assignment does not grant a Scouts vote.
      if (!manager) {
        const open = page.getByTestId(`leader-poll-${refs[0].id}`);
        await expect(open).toBeVisible();
        await open.getByRole("radio", {name: "Hike", exact: true}).check();
        await open.getByRole("button", {name: "Save response", exact: true}).click();
        await expect(open.getByTestId(/^leader-poll-audience-results-/)).toContainText("Hike: 1 (100%)");
      } else await expect(panel.getByTestId(`leader-poll-${refs[0].id}`)).toHaveCount(0);
      for (const ref of refs.slice(1)) await expect(panel.getByTestId(`leader-poll-${ref.id}`)).toHaveCount(0);
      await page.goto("/leader/polls");
      await expect(page.getByTestId("poll-create-form")).toBeVisible();
      await expect(page.getByTestId(`leader-poll-manager-${refs[1].id}`)).toContainText("draft");
      await expect(page.getByTestId(`leader-poll-manager-${refs[2].id}`).getByRole("button", {name: "View results", exact: true})).toBeVisible();
      if (manager) {
        await page.goto("/leader");
        await expect(page.getByTestId("leader-polls-empty")).toBeVisible();
        await expect(page.getByTestId("poll-create-form")).toHaveCount(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
      for (const ref of refs) await db.recursiveDelete(ref);
      if (previous.exists) await setting.set(previous.data()!); else await setting.delete();
    }
  });
}
