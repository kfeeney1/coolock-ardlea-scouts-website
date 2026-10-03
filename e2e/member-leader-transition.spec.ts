import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const password = process.env.E2E_TEST_USER_PASSWORD;

test("cancelling member-to-leader transition leaves member status unchanged", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Member transition runs on desktop and mobile Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill("test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await page.goto("/leader/members");

  const member = page.getByTestId("member-card-TEST_member_beaver_01");
  await expect(member).toBeVisible();
  await expect(member).toContainText("Active");
  await member.getByRole("button", { name: "Manage" }).click();
  await page.getByRole("button", { name: "Transition to Leader" }).click();

  const dialog = page.getByRole("dialog", { name: "Transition member to Leader" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("No membership or leader access changes until the member submits and an administrator approves the request.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("combobox").filter({ hasText: "Active" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox").filter({ hasText: "Active" })).toBeVisible();
});

test("invalid member transition link cannot submit a Leader Registration", async ({ page }) => {
  await page.goto("/leader/register?transition=invalid");
  await expect(page.getByText("This leader registration link is invalid.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Leader Registration" })).toBeDisabled();
});

async function completeTransition(page: import("@playwright/test").Page, section: "Cubs" | "Rovers", endMembership: boolean) {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  const suffix = randomUUID().slice(0, 8);
  const firstName = "TEST Transition";
  const lastName = `Member${suffix}`;
  const email = `test.transition.${suffix}@example.com`;
  const passwordForMember = `Transition-${suffix}-P455!`;

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill("test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await page.goto("/leader/members");
  await page.getByRole("button", { name: "Add Member", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Add Existing Member" });
  await addDialog.getByLabel("First name").fill(firstName);
  await addDialog.getByLabel("Last name").fill(lastName);
  await addDialog.getByLabel("Date of birth").fill("2000-01-01");
  await addDialog.getByRole("checkbox", { name: "Beavers", exact: true }).uncheck();
  await addDialog.getByRole("checkbox", { name: section, exact: true }).check();
  await addDialog.getByLabel("Email address").fill(email);
  await addDialog.getByLabel("Mobile number").fill("0871234567");
  await addDialog.getByRole("button", { name: "Add Member", exact: true }).click();
  await expect(addDialog).toBeHidden();

  const member = page.locator(`[data-testid^="member-card-"][data-member-last-name="${lastName}"]`);
  await expect(member).toBeVisible();
  await member.getByRole("button", { name: "Manage" }).click();
  await page.getByRole("button", { name: "Transition to Leader" }).click();
  const transitionDialog = page.getByRole("dialog", { name: "Transition member to Leader" });
  await expect(transitionDialog).toBeVisible();
  const endMembershipCheckbox = transitionDialog.getByRole("checkbox", { name: "End this member's current youth membership after leader approval" });
  await endMembershipCheckbox.setChecked(endMembership);
  await transitionDialog.getByRole("button", { name: "Prepare registration link" }).click();
  const link = await transitionDialog.getByLabel("Leader registration link").inputValue();

  await transitionDialog.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("dialog", { name: /Member —/ }).getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: /^Menu ·|Open Leader Menu/ }).click();
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Leader Login" })).toBeVisible();
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Leader Registration" })).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill(passwordForMember);
  await page.getByLabel("Confirm password", { exact: true }).fill(passwordForMember);
  await page.getByRole("combobox", { name: "Requested role" }).click();
  await page.getByRole("option", { name: "Scouter", exact: true }).click();
  await page.getByLabel(/I confirm that the information supplied is accurate/).check();
  await page.getByRole("button", { name: "Submit Leader Registration" }).click();
  await expect(page.getByText("Your leader registration has been sent to the group administrator.")).toBeVisible();

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill("test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await page.goto("/leader/requests");
  await page.getByRole("button", { name: `Review leader request for ${firstName} ${lastName}` }).click();
  const reviewDialog = page.getByRole("dialog", { name: "Review leader request" });
  await expect(reviewDialog).toContainText("This request started from an existing member record.");
  await reviewDialog.getByRole("button", { name: "Approve as Leader" }).click();
  const approvalDialog = page.getByRole("dialog", { name: "Approve leader access?" });
  await approvalDialog.getByRole("button", { name: "Confirm Approval" }).click();
  await expect(page.getByText(`${firstName} ${lastName} has been approved as a Leader`)).toBeVisible();

  await page.goto(`/leader/members?status=all&q=${encodeURIComponent(lastName)}`);
  const updatedMember = page.locator(`[data-testid^="member-card-"][data-member-last-name="${lastName}"]`);
  await expect(updatedMember).toBeVisible();
  await expect(updatedMember).toContainText(endMembership ? "Left" : "Active");
  await expect(updatedMember).toContainText(section);
  await page.goto(link);
  await expect(page.getByText("This leader registration link is unavailable or has expired.")).toBeVisible();
}

test("approved transition ends youth membership and prevents reusing the link", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Transition approval covers desktop and mobile Chromium.");
  await completeTransition(page, "Cubs", true);
});

test("approved Rover transition preserves concurrent Rover membership", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Transition approval covers desktop and mobile Chromium.");
  await completeTransition(page, "Rovers", false);
});
