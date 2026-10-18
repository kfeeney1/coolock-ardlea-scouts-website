function progress(phase, label) {
  if (process.connected) process.send({ type: "playwright-progress", phase, label });
}
function label(test) {
  return `${test.parent.project()?.name}: ${test.location.file}:${test.location.line} ${test.title}`;
}
function stepLabel(test, step) {
  // API step titles can contain filled credentials or token-bearing URLs.
  // The source location identifies the blocked action without echoing inputs.
  const location = step.location ? `${step.location.file}:${step.location.line}:${step.location.column}` : "fixture";
  return `${label(test)} / ${step.category} at ${location}`;
}
export default class PlaywrightProgressReporter {
  onBegin(_config, suite) {
    progress("begin", `${suite.allTests().length} selected tests`);
    console.log(`Playwright progress: ${suite.allTests().length} selected tests; startup complete.`);
  }
  onTestBegin(test) {
    progress("test", label(test));
    console.log(`Playwright START ${label(test)}`);
  }
  onStepBegin(test, _result, step) { progress("step", stepLabel(test, step)); }
  onStepEnd(test, _result, step) { progress("step-end", stepLabel(test, step)); }
  onTestEnd(test, result) {
    progress("test-end", `${result.status}: ${label(test)}`);
    console.log(`Playwright END ${result.status} ${result.duration}ms ${label(test)}`);
  }
  onEnd(result) { progress("end", result.status); }
}
