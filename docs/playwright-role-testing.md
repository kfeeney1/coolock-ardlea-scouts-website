# Playwright role and permission testing

The Playwright suite always runs public-page, Parent Portal UI and unauthenticated route-protection checks.

Authenticated permission tests use six Firebase Authentication users created by the normal **Seed Firebase Test Data** workflow. Their email addresses are fixed test values and are not secrets. All six accounts share one password stored securely in GitHub Actions.

## Seeded E2E accounts

| Test account | Email | Required state |
| --- | --- | --- |
| Parent only | `test.parent.only@example.com` | Approved `parentAccounts/{uid}` record and no active `adminUsers/{uid}` record |
| Parent + Leader | `test.leader.parent@example.com` | Approved parent record and active Beaver leader record under the same Firebase UID |
| Leader | `test.leader.only@example.com` | Active Scout leader |
| Multi-section Leader | `test.leader.multisection@example.com` | Active leader assigned to Beavers and Cubs |
| Admin | `test.admin@example.com` | Active `admin` |
| Super Admin | `test.superadmin@example.com` | Active `super-admin` |

The tests are read-only: they sign in, navigate and inspect access controls. They do not approve requests, edit members, change events or send notifications.

## One GitHub Actions secret

Under **Repository Settings → Secrets and variables → Actions → Secrets**, add just one secret:

- **Name:** `E2E_TEST_USER_PASSWORD`
- **Secret:** choose a test-only password of at least 8 characters.

Do not use a password that you use anywhere else. The value is supplied both to the Firebase test-data seeder and to Playwright, but is never committed to the repository.

The emails and expected multi-section assignment (`Beavers,Cubs`) are configured directly in the workflow because they are non-sensitive synthetic test data.

## Creating/updating the users

After `E2E_TEST_USER_PASSWORD` exists:

1. Open **Actions → Seed Firebase Test Data**.
2. Select **Run workflow**.
3. Choose `seed`.
4. Tick the confirmation box.
5. Run the workflow.

The workflow seeds the existing Firestore test records and then creates or updates all six Firebase Authentication users. Re-running `seed` is safe: it refreshes the same test UIDs and resets them to the configured shared test password.

Running the same workflow with `cleanup` removes the known test documents and all six test Authentication users. The companion E2E seeder refuses to delete its extra role records unless they still carry the `testData=true` marker.

## Coverage

The role matrix checks:

- every protected `/leader/*` route sends unauthenticated visitors to Leader Login;
- a parent-only account can use Parent Portal but is redirected away from Leader Dashboard;
- a dual-role parent/leader sees both Parent Portal and Leader Dashboard with one login;
- an ordinary leader sees operational leader pages but not Parent Access or Leader Access administration;
- a multi-section leader displays both Beavers and Cubs assignments;
- an Admin can open Parent Access and Leader Access management;
- a Super Admin can open the full Leader Access management area.

These tests run on pull requests and again after merges to `main`. Authenticated checks run once in desktop Chromium to reduce repeated Firebase logins; the existing public/UI suite still runs on desktop and mobile Chromium.
