import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("leader sign-out waits for Firebase before clearing recoverable session state", () => {
  const provider = readFileSync("src/components/admin/AdminAuthProvider.tsx", "utf8");
  const logout = provider.slice(provider.indexOf("const logout = async"), provider.indexOf("const setUiTheme"));
  assert.ok(logout.indexOf("await signOut(auth)") < logout.indexOf("setUser(null)"));
  assert.match(logout, /setAdminProfile\(null\)/);
  assert.match(logout, /removeItem\(SESSION_LAST_ACTIVITY_KEY\)/);
});

test("leader menu navigates explicitly after sign-out and exposes a retryable failure", () => {
  const header = readFileSync("src/components/admin/LeaderDashboardHeader.tsx", "utf8");
  assert.match(header, /navigate\("\/leader\/login",\{replace:true\}\)/);
  assert.match(header, /setMenuOpen\(false\)/);
  assert.match(header, /You are still signed in; please try again/);
  assert.match(header, /signOutError&&<Alert severity="error"/);
});

test("logout Playwright covers desktop and mobile without conditional skips", () => {
  const spec = readFileSync("e2e/logout.spec.ts", "utf8");
  assert.doesNotMatch(spec, /test\.skip/);
  assert.match(spec, /page\.goBack\(\)/);
  assert.match(spec, /leader-dashboard-header/);
});
