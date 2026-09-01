import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

const pagesDir = path.join(process.cwd(), "src", "pages");

async function leaderPages() {
  const files = (await readdir(pagesDir)).filter((file) => file.endsWith(".tsx"));
  const pages = await Promise.all(files.map(async (file) => ({
    file,
    source: await readFile(path.join(pagesDir, file), "utf8")
  })));
  return pages.filter(({ source }) => source.includes("<LeaderDashboardHeader"));
}

test("leader page shell geometry is enforced centrally", async () => {
  const pages = await leaderPages();
  assert.ok(pages.length > 0, "Expected at least one leader page");

  const layout = await readFile(path.join(process.cwd(), "src", "components", "Layout.tsx"), "utf8");
  assert.match(layout, /pathname\.startsWith\("\/leader"\)/);
  assert.match(layout, /data-leader-route=/);
  assert.match(layout, /24px !important/);
  assert.match(layout, /40px !important/);
  assert.match(layout, /1536px !important/);
});

test("leader shell stays scoped away from login and public routes", async () => {
  const layout = await readFile(path.join(process.cwd(), "src", "components", "Layout.tsx"), "utf8");
  assert.match(layout, /pathname !== "\/leader\/login"/);
  assert.ok(!layout.includes('pathname.startsWith("/parent")'), "Parent/public route spacing should not be silently coupled to the leader shell");
});
