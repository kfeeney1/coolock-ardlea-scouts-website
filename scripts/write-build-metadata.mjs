import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputPath = process.argv[2] || "dist/build-info.json";
const commit = String(process.env.GITHUB_SHA || process.env.VITE_BUILD_COMMIT || "local").trim();
const buildTime = new Date().toISOString();
const payload = {
  commit,
  buildTime,
  source: process.env.GITHUB_SHA ? "github-actions" : "local"
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote build metadata to ${outputPath}: ${commit}`);
