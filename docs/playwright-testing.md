# Playwright end-to-end testing

The repository includes a small Playwright regression suite in `e2e/`.

## What runs automatically

On each same-repository pull request targeting `main`, GitHub Actions:

1. installs the normal application dependencies with `npm ci`;
2. builds the exact PR version with the existing Firebase/Vite secrets;
3. installs Playwright without changing `package.json` or `package-lock.json`;
4. starts the built Vite preview locally on port 4173;
5. runs the suite in desktop Chromium and a Pixel 7-sized Chromium viewport;
6. uploads the HTML report and failure traces/screenshots/videos as GitHub Actions artifacts.

The initial suite intentionally avoids creating Firebase users, events or consent records. This keeps routine PR checks safe and prevents test data from accumulating in production.

## Initial coverage

- public routes render instead of producing a blank page;
- protected leader routes send unauthorised visitors to Leader Login;
- Leader Login exposes Forgot Password and Request Leader Access;
- Parent Portal exposes registration and Forgot Password;
- the parent registration form never shows `Enable Parent Access`;
- Parent Portal remains usable at a mobile viewport.

## Run locally

From the repository root:

```bash
npm ci
npm install --no-save --package-lock=false @playwright/test
npx playwright install chromium
```

Start the site in another terminal using the environment configuration you normally use:

```bash
npm run dev
```

Then run:

```bash
E2E_BASE_URL=http://127.0.0.1:5173 npx playwright test
```

On Windows Command Prompt use:

```bat
set E2E_BASE_URL=http://127.0.0.1:5173
npx playwright test
```

Use `npx playwright test --ui` for Playwright's interactive test runner.

## Authenticated/write-flow tests

Tests that create accounts, approve parents, create events or modify consent should use dedicated seeded automation identities and clearly isolated test records. Do not place passwords or Firebase credentials in test source files; use GitHub Actions secrets when those tests are added.
