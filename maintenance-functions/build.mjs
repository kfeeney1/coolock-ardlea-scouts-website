import { readFile, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
const source = await readFile(new URL("../src/security/scoutingAppointments.ts", import.meta.url), "utf8");
const output = "// Generated from the canonical scoutingAppointments.ts. Run node maintenance-functions/build.mjs.\n" + stripTypeScriptTypes(source);
const target = new URL("src/appointments.js", import.meta.url);
if (process.argv.includes("--check")) { if (await readFile(target, "utf8") !== output) throw new Error("Refresh the Maintenance canonical appointment adapter."); }
else await writeFile(target, output);
