/**
 * Makes Playwright's green state meaningful in CI.
 *
 * A skip is only accepted when it is caused by the current Playwright project
 * not being one of the projects explicitly named by the test. Environment,
 * seed, credential and feature-condition skips are coverage gaps in CI and
 * fail the assurance run.
 */

function skipReason(test) {
  for (const annotation of test.annotations ?? []) {
    if (annotation.type === "skip") return annotation.description ?? "";
  }
  return "";
}

function isIntentionalProjectSkip(reason) {
  const target = /\b(project|Chromium|Pixel 7|desktop|mobile|WebKit)\b/i.test(reason);
  const selection = /\b(run|runs|only|once|coverage|covered|exercised|check|checks|journey|regression|scanner)\b/i.test(reason);
  const environmentDependency = /\b(configure|credential|credentials|password|seed|seeded|data|required|environment|deployment)\b/i.test(reason);
  return target && selection && !environmentDependency;
}

function label(test) {
  return `${test.parent.project()?.name ?? "unknown project"} › ${test.titlePath().join(" › ")}`;
}

export default class PlaywrightAssuranceReporter {
  problems = [];
  counts = { passed: 0, failed: 0, projectSkipped: 0, coverageSkipped: 0, flaky: 0 };

  onTestEnd(test, result) {
    if (result.status === "passed") this.counts.passed += 1;
    if (result.status === "failed" || result.status === "timedOut" || result.status === "interrupted") this.counts.failed += 1;

    if (result.status === "skipped") {
      const reason = skipReason(test);
      if (isIntentionalProjectSkip(reason)) {
        this.counts.projectSkipped += 1;
      } else {
        this.counts.coverageSkipped += 1;
        this.problems.push(`${label(test)}: unexpected coverage skip${reason ? ` — ${reason}` : " with no reason"}`);
      }
    }

    if (test.outcome() === "flaky") {
      this.counts.flaky += 1;
      this.problems.push(`${label(test)}: passed only after retry`);
    }
  }

  onEnd() {
    console.log(
      `Playwright assurance: ${this.counts.passed} passed, ${this.counts.failed} failed, ` +
      `${this.counts.projectSkipped} intentional project skips, ${this.counts.coverageSkipped} unexpected coverage skips, ` +
      `${this.counts.flaky} flaky.`
    );
    if (this.problems.length === 0) return;
    console.error("Playwright assurance failed:\n");
    for (const problem of this.problems) console.error(`- ${problem}`);
    return { status: "failed" };
  }
}
