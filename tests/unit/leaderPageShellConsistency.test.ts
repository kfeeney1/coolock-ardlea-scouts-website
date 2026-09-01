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

test("all leader pages use the same outer spacing and container width", async () => {
  const pages = await leaderPages();
  assert.ok(pages.length > 0, "Expected at least one leader page");

  const inconsistent = pages
    .filter(({ source }) => !source.includes('py: { xs: 3, md: 5 }') || !source.includes('<Container maxWidth="xl">'))
    .map(({ file }) => file);

  assert.deepEqual(inconsistent, [], `Leader pages with inconsistent shell geometry: ${inconsistent.join(", ")}`);
});
