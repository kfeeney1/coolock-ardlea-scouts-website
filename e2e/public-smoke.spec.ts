import { expect, test } from "@playwright/test";

const publicRoutes = ["/", "/about", "/activities", "/join", "/contact"];
const registeredCharityText = "Registered Charity Number (RCN): 20207037";

test.describe("public website", () => {
  for (const route of publicRoutes) {
    test(`${route} renders visible content`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.ok()).toBeTruthy();
      await expect(page.locator("body")).not.toBeEmpty();
      await expect(page.locator("body")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toContainText(registeredCharityText);
      await expect(page.getByRole("contentinfo")).not.toContainText(/Build /i);
    });
  }
});

test.describe("public Parent Login entry-point audit", () => {
  for (const route of publicRoutes) {
    test(`${route} does not expose Parent Login in public navigation or calls to action`, async ({ page }) => {
      await page.goto(route);
      const width = page.viewportSize()?.width ?? 1280;
      if (width < 900) {
        await page.getByRole("button", { name: "Open navigation menu" }).click();
        await expect(page.getByRole("menuitem", { name: "Leader Login", exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole("banner").getByRole("link", { name: "Leader Login", exact: true })).toBeVisible();
      }
      await expect(page.getByText("Parent Login", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Parent Login", exact: true })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Parent Login", exact: true })).toHaveCount(0);
      if (width < 900) await expect(page.getByRole("menuitem", { name: "Parent Login", exact: true })).toHaveCount(0);
    });
  }
});

test("homepage shows section meeting times and the canonical meeting map", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Meeting Times" })).toBeVisible();

  const meetingTimes = [
    ["Beavers", "Wednesday, 6:30 pm–8:00 pm"],
    ["Cubs", "Tuesday, 7:00 pm–8:30 pm"],
    ["Scouts", "Wednesday, 8:00 pm–9:30 pm"],
    ["Ventures", "Tuesday, 8:30 pm–10:00 pm"]
  ];
  for (const [section, schedule] of meetingTimes) {
    await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
    await expect(page.getByText(schedule, { exact: true })).toBeVisible();
  }

  await expect(page.getByRole("heading", { name: "Where We Meet" })).toBeVisible();
  const mapLink = page.getByRole("link", { name: "View on Google Maps" });
  await expect(mapLink).toHaveAttribute("href", "https://maps.app.goo.gl/iexSS8BtsViUA2D87?g_st=ac");
  await expect(mapLink).toHaveAttribute("target", "_blank");
  await expect(mapLink).toHaveAttribute("rel", "noopener noreferrer");

  await expect(page.getByRole("button", { name: "Activity Consent" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Activity Consent|Consent Form/i })).toHaveCount(0);
  const joinUs = page.getByRole("link", { name: "Join Us" }).first();
  await expect(joinUs).toBeVisible();
  await expect(joinUs).toHaveAttribute("href", "/join");
  await joinUs.click();
  await expect(page).toHaveURL(/\/join$/);

  await page.goto("/");
  const width = page.viewportSize()?.width ?? 1280;
  if (width < 900) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Parent Login" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: /Consent Form/i })).toHaveCount(0);
  } else {
    await expect(page.getByRole("link", { name: "Parent Login" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Consent Form/i })).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
});

test("Join Us submits on mobile and desktop without collecting emergency contact details", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "Emergency contact" })).toHaveCount(0);
  await expect(page.getByLabel("Emergency contact name")).toHaveCount(0);
  await expect(page.getByLabel("Emergency contact phone")).toHaveCount(0);

  await page.getByLabel("First name").fill("Taylor");
  await page.getByLabel("Last name").fill("Test");
  await page.getByLabel("Date of birth").fill("2016-05-10");
  await page.getByLabel("Preferred section").click();
  await page.getByRole("option", { name: /Cubs/ }).click();
  await page.getByLabel("Parent / guardian name").fill("Alex Test");
  await page.getByLabel("Relationship").fill("Parent");
  await page.getByLabel("Mobile number").fill("0870000000");
  await page.getByLabel("Email address").fill("join-test@example.com");
  await page.getByLabel("I confirm that the information provided is accurate.").check();
  await page.getByLabel("I consent to being contacted about this joining enquiry.").check();
  await page.getByRole("button", { name: "Submit joining enquiry" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Application reference:" })).toContainText("Application reference:");
});

test("build information lives on About rather than the public footer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("contentinfo")).not.toContainText(/Build /i);

  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "Build information" })).toBeVisible();
  await expect(page.getByText(/Build .* · Commit /i)).toBeVisible();
});

test("activities show only published current and upcoming records", async ({ page }) => {
  await page.goto("/activities");

  await expect(page.getByRole("heading", { name: "TEST Public Single Day Activity" })).toBeVisible();
  await expect(page.getByText("Canonical public single-day example with no separate end date.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "TEST Rovers Open Service Project" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "TEST All Sections Group Day" })).toBeVisible();

  await expect(page.getByText("TEST Cubs Draft Camp")).toHaveCount(0);
  await expect(page.getByText("TEST Scouts Closed Hike")).toHaveCount(0);
  await expect(page.getByText("TEST Ventures Completed Activity")).toHaveCount(0);
});

test("contact page provides the public email link", async ({ page }) => {
  await page.goto("/contact");

  const email = page.getByRole("link", { name: "80th160thcoolockardlea@gmail.com" });
  await expect(email).toBeVisible();
  await expect(email).toHaveAttribute("href", "mailto:80th160thcoolockardlea@gmail.com");
  await expect(email).toBeInViewport();
});

test("leader pages require leader login", async ({ page }) => {
  await page.goto("/leader/events");
  await expect(page.getByRole("heading", { name: "Leader Login" })).toBeVisible();
  await expect(page.getByText("This area is restricted to approved Scout leaders.")).toBeVisible();
});

test("leader login includes password recovery", async ({ page }) => {
  await page.goto("/leader/login");
  await expect(page.getByRole("button", { name: "Forgot Password?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request Leader Access" })).toBeVisible();
});

test("SW-286 uncaught actions show safe references and retain diagnostic categories", async ({ page }) => {
  const diagnostics: Record<string, unknown>[] = [];
  page.on("console", async (message) => {
    if (message.type() === "error" && message.text().startsWith("Application failure")) {
      const value = await message.args()[1]?.jsonValue();
      if (value) diagnostics.push(value);
    }
  });
  await page.goto("/privacy");
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByTestId("application-errors-ready")).toBeAttached();
  for (const [code, category, action] of [
    ["firestore/permission-denied", "permission", "permission"],
    ["storage/unauthorized", "permission", "permission"],
    ["functions/unavailable", "unavailable", "service"],
    ["auth/network-request-failed", "network", "connection"],
    ["", "unexpected", "Try again"],
  ]) {
    await page.evaluate((code) => {
      const error = Object.assign(new Error("PRIVATE_PASSWORD PRIVATE_MEDICATION PRIVATE_TOKEN"), { code });
      window.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", { reason: error, promise: Promise.resolve() }));
    }, code);
    const alert = page.getByRole("alert").filter({ hasText: "An application action could not be completed" });
    await expect(alert).toContainText(action);
    await expect(alert).toContainText(/Reference: ERR-[A-F0-9]{12}/);
    await expect(alert).not.toContainText(/PRIVATE_|FirebaseError|stack/);
    await expect.poll(() => diagnostics.some((item) => item.category === category && (code ? item.code === code : !item.code))).toBeTruthy();
    expect(JSON.stringify(diagnostics)).not.toMatch(/PRIVATE_/);
    await alert.getByRole("button", { name: "Dismiss" }).click();
    await expect(alert).toHaveCount(0);
  }
});
