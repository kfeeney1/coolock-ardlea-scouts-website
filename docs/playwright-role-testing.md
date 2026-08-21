# Playwright role and permission testing

The Playwright suite always runs public-page, Parent Portal UI and unauthenticated route-protection checks.

Authenticated permission tests are enabled by dedicated Firebase test accounts configured as GitHub Actions secrets. These accounts should contain only test data and should not be used by real leaders or parents.

## Recommended test accounts

Create or retain one stable account for each role below:

| Test account | Required state |
| --- | --- |
| Parent only | Approved `parentAccounts/{uid}` record and no active `adminUsers/{uid}` record |
| Parent + Leader | Approved parent record and active leader record under the same Firebase UID |
| Leader | Active `adminUsers/{uid}` record with role `leader` and one assigned section |
| Multi-section Leader | Active leader with at least two assigned sections |
| Admin | Active `adminUsers/{uid}` record with role `admin` |
| Super Admin | Active `adminUsers/{uid}` record with role `super-admin` |

The tests are read-only: they sign in, navigate and inspect access controls. They do not approve requests, edit members, change events or send notifications.

## GitHub Actions secrets

Add these under **Repository Settings → Secrets and variables → Actions → Secrets**:

- `E2E_PARENT_EMAIL`
- `E2E_PARENT_PASSWORD`
- `E2E_PARENT_LEADER_EMAIL`
- `E2E_PARENT_LEADER_PASSWORD`
- `E2E_LEADER_EMAIL`
- `E2E_LEADER_PASSWORD`
- `E2E_MULTI_SECTION_LEADER_EMAIL`
- `E2E_MULTI_SECTION_LEADER_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_SUPER_ADMIN_EMAIL`
- `E2E_SUPER_ADMIN_PASSWORD`

Add this under **Actions → Variables** (it is not sensitive):

- `E2E_MULTI_SECTION_LEADER_SECTIONS` — comma-separated expected sections, for example `Beavers,Cubs`.

If credentials for a role are not configured, only that role-specific test is skipped; the rest of the suite still runs.

## Coverage

The role matrix checks:

- every protected `/leader/*` route sends unauthenticated visitors to Leader Login;
- a parent-only account can use Parent Portal but is redirected away from Leader Dashboard;
- a dual-role parent/leader sees both Parent Portal and Leader Dashboard with one login;
- an ordinary leader sees operational leader pages but not Parent Access or Leader Access administration;
- a multi-section leader displays all configured section assignments;
- an Admin can open Parent Access and Leader Access management;
- a Super Admin can open the full Leader Access management area.

These tests run on pull requests and again after merges to `main`. Authenticated checks run once in desktop Chromium to reduce repeated Firebase logins; the existing public/UI suite still runs on desktop and mobile Chromium.
