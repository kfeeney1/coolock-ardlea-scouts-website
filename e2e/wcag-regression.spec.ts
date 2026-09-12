import { expect, test, type Page } from "@playwright/test";

const leaderEmail = process.env.E2E_LEADER_EMAIL;
const leaderPassword = process.env.E2E_LEADER_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;
const parentPassword = process.env.E2E_TEST_USER_PASSWORD;

type Finding = { rule: string; target: string; detail: string };

async function scanWcagRegressionSurface(page: Page): Promise<Finding[]> {
  return page.evaluate(() => {
    const findings: Finding[] = [];
    const visible = (element: Element) => {
      const html = element as HTMLElement;
      const style = getComputedStyle(html);
      const rect = html.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const target = (element: Element) => {
      const html = element as HTMLElement;
      const id = html.id ? `#${html.id}` : "";
      const role = html.getAttribute("role") ? `[role=${html.getAttribute("role")}]` : "";
      return `${html.tagName.toLowerCase()}${id}${role}`;
    };
    const accessibleName = (element: Element) => {
      const html = element as HTMLElement;
      const labelledBy = html.getAttribute("aria-labelledby");
      const labelledText = labelledBy
        ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() || "").join(" ").trim()
        : "";
      const labels = "labels" in html && (html as HTMLInputElement).labels
        ? Array.from((html as HTMLInputElement).labels || []).map((label) => label.textContent?.trim() || "").join(" ").trim()
        : "";
      return html.getAttribute("aria-label")?.trim()
        || labelledText
        || labels
        || html.getAttribute("alt")?.trim()
        || html.getAttribute("title")?.trim()
        || html.textContent?.trim()
        || (html as HTMLInputElement).value?.trim()
        || "";
    };

    const ids = new Map<string, number>();
    document.querySelectorAll("[id]").forEach((element) => {
      const id = element.id;
      ids.set(id, (ids.get(id) || 0) + 1);
    });
    for (const [id, count] of ids) {
      if (count > 1) findings.push({ rule: "duplicate-id", target: `#${id}`, detail: `${count} elements share this id` });
    }

    document.querySelectorAll("[aria-labelledby], [aria-describedby]").forEach((element) => {
      for (const attribute of ["aria-labelledby", "aria-describedby"] as const) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        for (const id of value.split(/\s+/).filter(Boolean)) {
          if (!document.getElementById(id)) findings.push({ rule: "aria-reference", target: target(element), detail: `${attribute} references missing #${id}` });
        }
      }
    });

    document.querySelectorAll("button, a[href], input, select, textarea, [role=button], [role=link], [role=checkbox], [role=radio], [role=combobox]").forEach((element) => {
      if (!visible(element) || element.getAttribute("aria-hidden") === "true") return;
      if (!accessibleName(element)) findings.push({ rule: "accessible-name", target: target(element), detail: "visible interactive element has no accessible name" });
    });

    document.querySelectorAll("input:not([type=hidden]), select, textarea").forEach((element) => {
      if (!visible(element)) return;
      if (!accessibleName(element)) findings.push({ rule: "form-label", target: target(element), detail: "visible form control has no programmatic label" });
    });

    document.querySelectorAll("[tabindex]").forEach((element) => {
      const value = Number(element.getAttribute("tabindex"));
      if (Number.isFinite(value) && value > 0) findings.push({ rule: "positive-tabindex", target: target(element), detail: `tabindex=${value}` });
    });

    document.querySelectorAll('[role="dialog"], [role="alertdialog"]').forEach((element) => {
      if (visible(element) && !accessibleName(element)) findings.push({ rule: "dialog-name", target: target(element), detail: "visible dialog has no accessible name" });
    });

    document.querySelectorAll("table").forEach((table) => {
      if (!visible(table)) return;
      if (!table.querySelector("th")) findings.push({ rule: "table-headers", target: target(table), detail: "visible data table has no header cells" });
    });

    return findings;
  });
}

async function expectNoWcagRegressionFindings(page: Page) {
  const findings = await scanWcagRegressionSurface(page);
  expect(findings, "WCAG-oriented regression findings. This scanner is a CI guardrail, not proof of WCAG conformance.").toEqual([]);
}

async function loginLeader(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel(/email/i).fill(leaderEmail!);
  await page.getByLabel(/password/i).fill(leaderPassword!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/leader/);
}

async function loginParent(page: Page) {
  await page.goto("/parent");
  await page.getByLabel("Email").fill(parentEmail!);
  await page.getByLabel("Password").fill(parentPassword || "");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText(/Your account is approved and linked to 2 member records/i)).toBeVisible();
}

test.describe("WCAG-oriented regression scanner", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "WCAG regression scanner runs once on desktop Chromium.");
  });

  for (const route of ["/", "/about", "/activities", "/activities/consent", "/join", "/contact", "/leader/login", "/parent"]) {
    test(`${route} has no core semantic regression findings`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await expectNoWcagRegressionFindings(page);
    });
  }

  test("consent chooser remains scan-clean after keyboard interaction", async ({ page }) => {
    await page.goto("/activities/consent");
    const chooser = page.getByRole("button", { name: /Open Beavers consent form/i });
    await chooser.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /change section/i })).toBeVisible();
    await expectNoWcagRegressionFindings(page);
  });

  test("approved parent workflow remains scan-clean", async ({ page }) => {
    test.skip(!parentEmail || !parentPassword, "Canonical parent E2E credentials are required.");
    await loginParent(page);
    await expectNoWcagRegressionFindings(page);
  });

  test("leader reports surface remains scan-clean", async ({ page }) => {
    test.skip(!leaderEmail || !leaderPassword, "Leader E2E credentials are required.");
    await loginLeader(page);
    await page.goto("/leader/reports");
    await expect(page.locator("main")).toBeVisible();
    await expectNoWcagRegressionFindings(page);
  });
});
