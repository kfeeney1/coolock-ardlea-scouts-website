import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("app installs the site-wide transient overlay Back bridge", async () => {
  const source = await readFile("src/App.tsx", "utf8");
  assert.match(source, /TransientOverlayBackDismissBridge/);
  assert.match(source, /<TransientOverlayBackDismissBridge\s*\/>/);
});

test("transient overlay Back bridge covers dialogs and select listboxes", async () => {
  const source = await readFile("src/components/TransientOverlayBackDismissBridge.tsx", "utf8");
  assert.match(source, /\[role="dialog"\]/);
  assert.match(source, /\[role="listbox"\]/);
  assert.match(source, /transient-overlay:/);
  assert.match(source, /navigate\(-1\)/);
  assert.match(source, /key:\s*"Escape"/);
});

test("leader navigation participates in Back history without a competing close click", async () => {
  const source = await readFile("src/components/admin/LeaderDashboardHeader.tsx", "utf8");
  assert.match(source, /useBackDismiss\(menuOpen, closeMenuAndRestoreFocus, "leader-navigation"\)/);
  assert.match(source, /component=\{Link\} to=\{item\.path\} replace/);
  assert.doesNotMatch(source, /to=\{item\.path\}[^>]*onClick=\{\(\) => setMenuOpen\(false\)\}/);
});
