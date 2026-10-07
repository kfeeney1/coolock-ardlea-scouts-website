import { expect, test } from "@playwright/test";

for (const navigation of ["leader", "parent"] as const) {
  test(`SW-128 ${navigation} logout recovers from Firebase persistence failure`, async ({ page }) => {
    const email = process.env[navigation === "leader" ? "E2E_LEADER_EMAIL" : "E2E_PARENT_EMAIL"]?.trim();
    const password = process.env.E2E_TEST_USER_PASSWORD;
    if (!email || !password) throw new Error("Configure the canonical E2E logout credentials.");
    await page.goto(navigation === "leader" ? "/leader/login" : "/parent");
    await page.getByLabel(navigation === "leader" ? "Email address" : "Email", { exact: true }).fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(navigation === "leader" ? page.getByTestId("leader-dashboard-header") : page.getByText(/Your account is approved and linked to 2 member records/i)).toBeVisible();

    // Firebase signOut is local: an HTTP failure does not exercise its error path.
    // Reject auth-user removal at the browser persistence boundary instead.
    await page.evaluate(() => {
      const remove = Storage.prototype.removeItem;
      let attempts = 0;
      Storage.prototype.removeItem = function (key) {
        if (this === window.sessionStorage && key.startsWith("firebase:authUser:")) {
          attempts += 1;
          throw new DOMException("SW-128 injected storage failure", "UnknownError");
        }
        return remove.call(this, key);
      };
      (window as Window & { logoutAttempts?: () => number }).logoutAttempts = () => attempts;
      (window as Window & { restoreLogoutStorage?: () => void }).restoreLogoutStorage = () => { Storage.prototype.removeItem = remove; };
    });
    const openNavigation = async () => {
      if (navigation === "leader") await page.getByRole("button", { name: /Open Leader Menu|Hide Leader Menu|Menu ·/ }).click();
      else if (page.viewportSize()!.width < 900) await page.getByRole("button", { name: "Open navigation menu" }).click();
    };
    const signOut = () => page.getByRole(navigation === "parent" && page.viewportSize()!.width < 900 ? "menuitem" : "button", { name: "Sign Out", exact: true });
    await openNavigation();
    // Dispatch duplicate taps in one task, before React can disable the control.
    await signOut().evaluate((button) => { (button as HTMLElement).click(); (button as HTMLElement).click(); });
    await expect(page.getByRole("alert").filter({ hasText: /Sign out did not complete/i })).toBeVisible();
    await expect(page.getByText(/Signing Out(?:…|\.\.\.)/i)).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & { logoutAttempts?: () => number }).logoutAttempts!())).toBe(1);
    await page.evaluate(() => (window as Window & { restoreLogoutStorage?: () => void }).restoreLogoutStorage!());
    if (navigation === "parent" && page.viewportSize()!.width < 900) await openNavigation();
    await expect(signOut()).toBeEnabled();
    await signOut().click();
    await expect(page).toHaveURL(navigation === "leader" ? /\/leader\/login$/ : /\/$/);
    await expect(page.getByTestId("authenticated-header-identity")).toHaveCount(0);
    await expect(page.getByTestId("leader-dashboard-header")).toHaveCount(0);
  });
}

test("leader can sign out from the shared dashboard menu", async ({ page }) => {
  const email = process.env.E2E_LEADER_EMAIL?.trim();
  const password = process.env.E2E_LEADER_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
  if (!email || !password) throw new Error("Configure the seeded E2E leader credentials.");

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  const menuButton = page.getByRole("button", { name: /Open Leader Menu|Hide Leader Menu|Menu ·/ });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
  await page.getByRole("button", { name: "Sign Out" }).click();

  await expect(page).toHaveURL(/\/leader\/login$/);
  await expect(page.getByRole("heading", { name: "Leader Login" })).toBeVisible();
  await expect(page.getByTestId("leader-dashboard-header")).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/leader\/login$/);

  await page.goto("/leader");
  await expect(page).toHaveURL(/\/leader\/login$/);
  await page.reload();
  await expect(page.getByTestId("leader-dashboard-header")).toHaveCount(0);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
});


test("SW-213 keeps Sign Out enabled until the user initiates logout", async ({ page }) => {
  const email = process.env.E2E_LEADER_EMAIL?.trim();
  const password = process.env.E2E_LEADER_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
  if (!email || !password) throw new Error("Configure the seeded E2E leader credentials.");

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

  const menuButton = page.getByRole("button", { name: /Open Leader Menu|Hide Leader Menu|Menu ·/ });
  await menuButton.click();
  const signOut = page.getByRole("button", { name: "Sign Out", exact: true });
  await expect(signOut).toBeVisible();
  await expect(signOut).toBeEnabled();
  await expect(page.getByText("Signing Out…", { exact: true })).toHaveCount(0);

  await menuButton.click();
  await expect(signOut).toHaveCount(0);
  await menuButton.click();
  await expect(signOut).toBeVisible();
  await expect(signOut).toBeEnabled();
  await expect(page.getByText("Signing Out…", { exact: true })).toHaveCount(0);

  await page.goto("/leader/members");
  await expect(page.getByRole("heading", { name: "Member Management" })).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("button", { name: "Sign Out", exact: true })).toBeEnabled();
  await expect(page.getByText("Signing Out…", { exact: true })).toHaveCount(0);
});

test("SW-213 clears public-header sign-out state when switching authenticated accounts", async ({ page }) => {
  const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL?.trim();
  const leaderEmail = process.env.E2E_LEADER_EMAIL?.trim();
  const password = process.env.E2E_TEST_USER_PASSWORD;
  if (!superAdminEmail || !leaderEmail || !password) {
    throw new Error("Configure the seeded E2E Super Admin, leader and shared test password.");
  }

  const signIn = async (email: string) => {
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  };
  const openPublicNavigation = async () => {
    if (page.viewportSize()!.width < 900) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
    }
  };
  const publicSignOut = () => page.viewportSize()!.width < 900
    ? page.getByRole("menuitem", { name: "Sign Out", exact: true })
    : page.getByRole("banner").getByRole("button", { name: "Sign Out", exact: true });

  await page.goto("/leader/login");
  const documentMarker = await page.evaluate(() => {
    const marker = crypto.randomUUID();
    (window as Window & { logoutDocument?: string }).logoutDocument = marker;
    return marker;
  });
  const home = () => page.getByRole("banner").locator('a[href="/"]').first();
  await signIn(superAdminEmail);
  await home().click();
  const firstIdentity = page.getByTestId("authenticated-header-identity");
  await expect(firstIdentity).toBeVisible();
  const superAdminIdentity = await firstIdentity.innerText();
  await openPublicNavigation();
  await publicSignOut().click();
  await expect(page.getByTestId("authenticated-header-identity")).toHaveCount(0);
  await openPublicNavigation();
  await page.getByRole(page.viewportSize()!.width < 900 ? "menuitem" : "link", { name: "Leader Login", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Leader Login" })).toBeVisible();

  await signIn(leaderEmail);
  await home().click();
  const leaderIdentity = page.getByTestId("authenticated-header-identity");
  await expect(leaderIdentity).toBeVisible();
  await expect(leaderIdentity).not.toHaveText(superAdminIdentity);
  await openPublicNavigation();

  const secondSignOut = publicSignOut();
  await expect(secondSignOut).toBeVisible();
  await expect(secondSignOut).toBeEnabled();
  await expect(page.getByText(/Signing Out(?:…|\.\.\.)/i)).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { logoutDocument?: string }).logoutDocument)).toBe(documentMarker);
});
