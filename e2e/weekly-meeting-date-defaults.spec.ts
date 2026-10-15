import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const timezoneId = "Europe/Dublin";
const sections = [
  { name: "Cubs" },
  { name: "Ventures" },
  { name: "Beavers" },
  { name: "Scouts" }
];

test.use({ timezoneId });

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(adminEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function selectSection(page: Page, name: string) {
  const section = page.getByRole("combobox", { name: "Section" });
  const listbox = page.getByRole("listbox");
  if ((await section.textContent())?.trim() === name) {
    const alternate = sections.find((candidate) => candidate.name !== name)!.name;
    await section.click();
    await page.getByRole("option", { name: alternate, exact: true }).click();
    await expect(listbox).toBeHidden();
  }
  await section.click();
  await page.getByRole("option", { name, exact: true }).click();
  await expect(listbox).toBeHidden();
}

function localNoon(isoDate: string) {
  const daylightOffset = isoDate < "2026-10-25" || isoDate >= "2027-03-28" ? "+01:00" : "+00:00";
  return new Date(`${isoDate}T12:00:00${daylightOffset}`);
}

test("SW-398 next meeting date is the next local weekday across date boundaries", async ({ page }) => {
  test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
  await login(page);
  await page.goto("/leader/weekly/create");
  await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible();
  await page.clock.install({ time: localNoon("2026-10-19") });

  const existingMeetingsPage = await page.context().newPage();
  await login(existingMeetingsPage);
  await existingMeetingsPage.goto("/leader/weekly");
  await expect(existingMeetingsPage.getByRole("heading", { name: "Weekly Meetings" })).toBeVisible();
  const existingMeeting = existingMeetingsPage.getByTestId("meeting-history-TEST_e2e_weekly_scout");
  await expect(existingMeeting).toContainText("15-01-2099 · Scouts");

  const date = page.getByLabel("Meeting date");
  const dateCases = [
    { today: "2026-10-19", expected: { Cubs: "2026-10-20", Ventures: "2026-10-20", Beavers: "2026-10-21", Scouts: "2026-10-21" } },
    { today: "2026-10-20", expected: { Cubs: "2026-10-27", Ventures: "2026-10-27", Beavers: "2026-10-21", Scouts: "2026-10-21" } },
    { today: "2026-10-21", expected: { Cubs: "2026-10-27", Ventures: "2026-10-27", Beavers: "2026-10-28", Scouts: "2026-10-28" } },
    { today: "2026-12-29", expected: { Cubs: "2027-01-05", Ventures: "2027-01-05", Beavers: "2026-12-30", Scouts: "2026-12-30" } },
    { today: "2026-12-30", expected: { Cubs: "2027-01-05", Ventures: "2027-01-05", Beavers: "2027-01-06", Scouts: "2027-01-06" } }
  ];

  for (const dateCase of dateCases) {
    await page.clock.setFixedTime(localNoon(dateCase.today));
    for (const section of sections) {
      await selectSection(page, section.name);
      await expect(date, `${section.name} from ${dateCase.today}`).toHaveValue(dateCase.expected[section.name]);
    }
  }

  await page.clock.setFixedTime(localNoon("2026-10-19"));
  await selectSection(page, "Cubs");
  await expect(date).toHaveValue("2026-10-20");
  await selectSection(page, "Ventures");
  await expect(date).toHaveValue("2026-10-20");
  await date.fill("2027-02-17");
  await selectSection(page, "Beavers");
  await expect(date).toHaveValue("2027-02-17");

  await existingMeetingsPage.reload();
  await expect(existingMeetingsPage.getByTestId("meeting-history-TEST_e2e_weekly_scout")).toContainText("15-01-2099 · Scouts");
  await existingMeetingsPage.close();
});
