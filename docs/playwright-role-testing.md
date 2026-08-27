# Playwright role and permission testing

The Playwright suite always runs public-page, Parent Portal UI and unauthenticated route-protection checks.

Authenticated permission tests use Firebase Authentication users created by the canonical comprehensive population seed. Their email addresses are fixed synthetic test values and are not secrets. All canonical test accounts use the development-only password `password1`.

## Seeded E2E accounts

| Test account | Email | Required state |
| --- | --- | --- |
| Parent only | `test.beaver.parent1@example.com` | Approved Beavers `parentAccounts/{uid}` record and no active `adminUsers/{uid}` record |
| Parent + Leader | `test.beaver.section.leader@example.com` | Approved parent record and active Beaver Section Leader record under the same Firebase UID |
| Leader | `test.scout.programme.scouter@example.com` | Active Scouts Programme Scouter |
| Multi-section Leader | `test.multi.section.leader@example.com` | Active leader assigned to Beavers and Cubs |
| Admin | `test.webadmin@example.com` | Active `admin` |
| Super Admin | `superadmin@example.com` | Active `super-admin` |

Every hard-coded test identity or `TEST_*` record consumed by application tests, E2E specs, workflows, or utility code is checked by the repository seed-contract quality gate. A consumer may only reference data defined by an active canonical seed source. Migration and cleanup scripts are the only exception; they may name retired IDs solely so those records can be detected or removed.

## Canonical test password

All canonical development and Playwright test accounts use:

- **Password:** `password1`

This value is intentionally fixed because these accounts are synthetic development/test identities only. Do not reuse this password for any real user or production account.

The emails, password and expected multi-section assignment (`Beavers,Cubs`) are configured directly in the workflows so live development seeding and emulator-backed Playwright runs use the same credentials.

## Creating/updating the users

1. Open **Actions → Seed Firebase Test Data**.
2. Select **Run workflow**.
3. Choose `seed`.
4. Tick the confirmation box.
5. Run the workflow.

The workflow creates or updates the deterministic test records and Authentication users. Re-running `seed` refreshes the same test UIDs and resets every canonical test account to `password1`.

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
