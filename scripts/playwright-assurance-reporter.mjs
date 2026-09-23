/**
 * Makes Playwright's green state meaningful in CI.
 *
 * Project-targeting skips are intentional: many state-changing journeys run in
 * one browser while responsive journeys run on Pixel 7. Required CI
 * configuration is validated before discovery in playwright.config.ts.
 */
export default class PlaywrightAssuranceReporter {
  problems = [];
  counts = { passed: 0, failed: 0, skipped: 0, flaky: 0 };

  onTestEnd(test, result) {
    if (result.status === "passed") this.counts.passed += 1;
    if (result.status === "failed" || result.status === "timedOut" || result.status === "interrupted") this.counts.failed += 1;
    if (result.status === "skipped") this.counts.skipped += 1;

    const outcome = test.outcome();
    if (outcome === "flaky") {
      this.counts.flaky += 1;
      this.problems.push(`${test.parent.project()?.name ?? "unknown project"} › ${test.titlePath().join(" › ")}: passed only after retry`);
    }

  }

  onEnd() {
    console.log(`Playwright assurance: ${this.counts.passed} passed, ${this.counts.failed} failed, ${this.counts.skipped} intentional project skips, ${this.counts.flaky} flaky.`);
    if (this.problems.length === 0) return;
    console.error("Playwright assurance failed:\n");
    for (const problem of this.problems) console.error(`- ${problem}`);
    return { status: "failed" };
  }
}
