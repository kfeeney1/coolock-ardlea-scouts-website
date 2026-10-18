import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { holdOverlayCloseForMenu } from "./support/overlay-close-race";

test("dropdown cleanup preserves a reopened Rover dialog before its observer update", async ({ page }) => {
  const password = process.env.E2E_TEST_USER_PASSWORD;
  test.skip(!password, "Configure canonical E2E credentials.");
  await page.addInitScript(() => {
    const NativeObserver = MutationObserver;
    const deferred = new Set<() => void>();
    let paused = false;
    // Delay only the overlay bridge's body/visibility observation. The actual
    // portals, UI clicks, native history and Firestore requests remain real.
    window.MutationObserver = class extends NativeObserver {
      private bridge = false;
      constructor(callback: MutationCallback) {
        super((records, observer) => {
          if (paused && this.bridge) deferred.add(() => callback(records, observer));
          else callback(records, observer);
        });
      }
      observe(target: Node, options?: MutationObserverInit) {
        this.bridge = target === document.body && options?.attributeFilter?.join(",") === "aria-hidden,class,style";
        super.observe(target, options);
      }
    };
    (window as Window & { overlayObservation?: { pause: () => void; resume: () => void } }).overlayObservation = {
      pause: () => { paused = true; },
      resume: () => { paused = false; for (const run of deferred) run(); deferred.clear(); }
    };
  });
  await loginAsLeader(page, { email: "test.webadmin@example.com", password: password! });
  await page.goto("/leader/members");
  await expect(page.getByRole("button", { name: "Manage Rovers", exact: true })).toBeVisible();
  const cleanup = await holdOverlayCloseForMenu(page);
  try {
    await page.getByRole("combobox", { name: "Section", exact: true }).click();
    await expect.poll(() => page.evaluate(() => (history.state?.usr?.__coolockArdleaBackDismissStack || []).at(-1)?.startsWith("transient-overlay:") === true)).toBe(true);
    await page.getByRole("option", { name: "All Sections", exact: true }).click();
    await cleanup.ready();
    const index = await page.evaluate(() => history.state.idx);
    await page.evaluate(() => (window as Window & { overlayObservation?: { pause: () => void } }).overlayObservation?.pause());
    await page.getByRole("button", { name: "Manage Rovers", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Manage Rover Membership", exact: true });
    await expect(dialog).toBeVisible();
    await cleanup.flush();
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => history.state.idx)).toBe(index);
    await page.evaluate(() => (window as Window & { overlayObservation?: { resume: () => void } }).overlayObservation?.resume());
    await expect(dialog.getByText("Scouts Section Leader", { exact: true })).toBeVisible();
    // Genuine browser Back must still dismiss the current dialog.
    await page.goBack();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/leader\/members$/);
  } finally {
    await page.evaluate(() => (window as Window & { overlayObservation?: { resume: () => void } }).overlayObservation?.resume());
    await cleanup.restore();
  }
});
