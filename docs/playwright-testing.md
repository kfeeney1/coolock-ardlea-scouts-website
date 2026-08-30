# Playwright end-to-end testing

The repository has a broad Playwright regression suite under `e2e/`. It covers public pages, authentication and role boundaries, parent workflows, leader operations, meetings/events, equipment, finance and selected accessibility checks.

## Execution model

The browser suite uses a deterministic Firebase emulator dataset. Firestore, Authentication and Storage emulators are started for normal same-repository pull requests and `main` runs, the canonical seed is applied, then applied a second time to prove the seed remains idempotent when data already exists.

Because authenticated/write-flow specs share that deterministic dataset, Playwright defaults to one worker. This prevents finance/equipment/meeting mutations from racing each other locally or in CI. A developer working only on isolated/read-only tests can opt into more workers explicitly with `E2E_WORKERS`.

The configured projects are:

- desktop Chromium for the full suite;
- Pixel 7 Chromium for the full non-WebKit-specific suite;
- an iPhone 15 WebKit critical-path smoke spec rather than a second full regression matrix.

Authenticated feature specs can deliberately skip duplicate mobile execution when the behaviour is already covered by the desktop journey and separate responsive/public coverage.

## Reliability contract

`npm run quality` includes `npm run check:playwright-suite`. The static suite check runs without installing browsers and rejects common sources of flaky or unsafe E2E tests:

- fixed `page.waitForTimeout()` / `frame.waitForTimeout()` sleeps;
- `networkidle` navigation waits for Firebase-driven pages;
- committed focused tests;
- a hard-coded canonical test password inside E2E specs;
- specs that do not import Playwright from `@playwright/test`.

Use locator assertions, event-specific waits and `expect.poll()` for asynchronous behaviour. Prefer accessible role/label/test-id locators over CSS structure. Structural XPath should be treated as a migration target when the application can expose a stable semantic locator.

The Playwright configuration gives each test 45 seconds and assertions up to 10 seconds. CI retries failed tests twice and retains failure traces, screenshots and video. A failed workflow also captures Firebase emulator and Vite preview logs alongside `test-results/` so permission, emulator and application failures can be diagnosed from the same artifact.

## CI sequence

For normal same-repository PRs and `main`, the E2E workflow:

1. installs application dependencies with `npm ci`;
2. runs the normal quality gate, including the Playwright static contract;
3. verifies the deterministic Playwright seed contract;
4. starts Firestore, Auth and Storage emulators using the branch rules;
5. seeds and verifies the canonical dataset twice;
6. installs the pinned Playwright runner and Chromium/WebKit browsers;
7. starts the exact built Vite preview;
8. runs `playwright test --list` so discovery/configuration failures are visible before browser execution;
9. runs the browser suite;
10. uploads the HTML report and, on failure, traces/screenshots/videos plus emulator and preview logs.

Dependabot PRs do not receive repository secrets, so they run the static quality/seed-contract protections but intentionally skip credentialed emulator/browser journeys.

## Run locally

Install the application and a Playwright runner without changing the lockfile:

```bash
npm ci
npm install --no-save --package-lock=false @playwright/test
npx playwright install chromium webkit
```

Start the Firebase emulators and seed them with the same canonical scripts used by CI, then start the site and run:

```bash
E2E_BASE_URL=http://127.0.0.1:5173 npm run test:e2e
```

Use `npx playwright test --ui` for interactive debugging. Keep `E2E_WORKERS=1` for the normal shared-emulator suite; only increase it when running tests that are known to be isolated/read-only.

## Test-data rules

Authenticated and write-flow tests must use canonical synthetic identities and deterministic test records. Do not create uncontrolled Firebase users or write E2E data to production. Credentials must come from environment variables rather than source code. Any new hard-coded test identity or `TEST_*` record must also be represented by the repository seed contract so stale seed dependencies are detected before browser execution.
