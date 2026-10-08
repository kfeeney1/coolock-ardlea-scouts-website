import { expect, test } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const sectionLeaderEmail = process.env.E2E_SECTION_LEADER_EMAIL || "test.scout.section.leader@example.com";
const memberName = "Casey OBrien Scouts 01";

test("SW-325 attendance and uniform checklist keeps one compact row and applies uniform rules", async ({ page }, testInfo) => {
  test.skip(!password, "Configure the canonical E2E password.");
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(sectionLeaderEmail);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

  const date = new Date(Date.UTC(2099, 2, 1 + testInfo.workerIndex + (testInfo.project.name === "mobile-chromium" ? 500 : 0)));
  const meetingDate = date.toISOString().slice(0, 10);
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Weekly Meetings" })).toBeVisible();
  await page.getByRole("link", { name: "Create Meeting" }).click();
  await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible();
  await page.getByLabel("Meeting date").fill(meetingDate);
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=/);
  await page.getByRole("button", { name: "Attendance", exact: true }).click();

  const checklist = page.getByRole("table", { name: "Meeting attendance checklist" });
  await expect(checklist).toBeVisible();
  for (const heading of ["Member", "Attendance", "Uniform"]) {
    await expect(checklist.getByRole("columnheader", { name: heading, exact: true })).toBeVisible();
  }
  const row = checklist.getByRole("row", { name: new RegExp(memberName) });
  const attendance = row.getByRole("checkbox", { name: `Attendance · ${memberName}`, exact: true });
  const uniform = row.getByRole("checkbox", { name: `Uniform · ${memberName}`, exact: true });
  const [attendanceBox, uniformBox] = await Promise.all([attendance.boundingBox(), uniform.boundingBox()]);
  expect(attendanceBox).not.toBeNull();
  expect(uniformBox).not.toBeNull();
  expect(Math.abs(attendanceBox!.y - uniformBox!.y)).toBeLessThan(1);
  expect(attendanceBox!.x).toBeLessThan(uniformBox!.x);

  await attendance.uncheck();
  await expect(uniform).not.toBeChecked();
  await uniform.check();
  await expect(attendance).toBeChecked();
  await attendance.uncheck();
  await expect(uniform).not.toBeChecked();
  await attendance.check();
  await expect(uniform).not.toBeChecked();

  const pageWidth = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const overflowers = [...document.body.querySelectorAll("*")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, className: typeof element.className === "string" ? element.className : "", text: element.textContent?.trim().slice(0, 40), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
      })
      .filter((element) => element.right > viewport + 1 || element.left < -1)
      .slice(0, 12);
    return { viewport, content: document.documentElement.scrollWidth, overflowers };
  });
  expect(pageWidth.content, JSON.stringify(pageWidth.overflowers)).toBeLessThanOrEqual(pageWidth.viewport);
});
