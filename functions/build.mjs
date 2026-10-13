import { copyFile, mkdir } from "node:fs/promises";
const root = new URL("./", import.meta.url);
await mkdir(new URL("lib/shared/", root), { recursive: true });
for (const name of ["index.js", "handler.js"]) {
  await copyFile(new URL(`src/${name}`, root), new URL(`lib/${name}`, root));
}
for (const name of ["productionRoutes.js", "secureActionLinks.js", "reminderPersistence.js"]) {
  await copyFile(new URL(`../email-worker/src/${name}`, root), new URL(`lib/shared/${name}`, root));
}
console.log("Built TEST event backend from the shared authoritative event writer.");
