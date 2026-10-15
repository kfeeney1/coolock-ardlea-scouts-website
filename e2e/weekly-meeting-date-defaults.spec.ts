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

  const date = page.getByRole("textbox", { name: /^Meeting date/ });
  const dateCases = [
    { today: "2026-10-19", expected: [{ section: "Cubs", date: "20-10-2026" }, { section: "Ventures", date: "20-10-2026" }] },
    { today: "2026-10-20", expected: [{ section: "Cubs", date: "27-10-2026" }, { section: "Ventures", date: "27-10-2026" }, { section: "Beavers", date: "21-10-2026" }, { section: "Scouts", date: "21-10-2026" }] },
    { today: "2026-10-21", expected: [{ section: "Beavers", date: "28-10-2026" }, { section: "Scouts", date: "28-10-2026" }] },
    { today: "2026-12-29", expected: [{ section: "Cubs", date: "05-01-2027" }, { section: "Ventures", date: "05-01-2027" }] },
    { today: "2026-12-30", expected: [{ section: "Beavers", date: "06-01-2027" }, { section: "Scouts", date: "06-01-2027" }] }
  ];

  for (const dateCase of dateCases) {
    await page.clock.setFixedTime(localNoon(dateCase.today));
    for (const expected of dateCase.expected) {
      await selectSection(page, expected.section);
      await expect(date, `${expected.section} from ${dateCase.today}`).toHaveValue(expected.date);
    }
  }

  await page.clock.setFixedTime(localNoon("2026-10-19"));
  await selectSection(page, "Cubs");
  await expect(date).toHaveValue("20-10-2026");
  await selectSection(page, "Beavers");
  await expect(date).toHaveValue("21-10-2026");
  await date.fill("17-02-2027");
  await selectSection(page, "Ventures");
  await expect(date).toHaveValue("17-02-2027");

  await existingMeetingsPage.reload();
  await expect(existingMeetingsPage.getByTestId("meeting-history-TEST_e2e_weekly_scout")).toContainText("15-01-2099 · Scouts");
  await existingMeetingsPage.close();
});
