import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {hallBookingEndpoint} from "../src/services/hallBookingEndpoint.ts";
export function hallTestDeploymentErrors(env, source) {
  const errors = [];
  if (env.FIREBASE_PROJECT_ID !== "coolock-ardlea-scouts-test") errors.push("Only the isolated TEST project is allowed.");
  if (env.HALL_FREE_PLAN_CONFIRMED !== "true") errors.push("Owner verification of the existing Workers Free plan and available quota is required.");
  if (!/^[a-f0-9]{40}$/.test(env.HALL_BUILD_COMMIT ?? "")) errors.push("The exact reviewed main commit is required.");
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) errors.push("TEST-scoped Cloudflare deployment access is unavailable.");
  try {if (!hallBookingEndpoint({appEnv: "test", firebaseProjectId: env.FIREBASE_PROJECT_ID, hallApiUrl: env.VITE_HALL_BOOKING_API_URL})) throw new Error();}
  catch {errors.push("Configure the isolated TEST Worker origin before deployment.");}
  const allowed = ['name = "coolock-ardlea-scouts-hall-test"', 'main = "src/testHallEntry.js"', 'compatibility_date = "2026-08-01"', 'workers_dev = true', '[vars]', 'FIREBASE_PROJECT_ID = "coolock-ardlea-scouts-test"', '[triggers]', 'crons = []'];
  const lines = source.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("#"));
  if (lines.join("\n") !== allowed.join("\n")) errors.push("Use only the reviewed booking-only TEST config without paid bindings, routes or schedulers.");
  return errors;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = hallTestDeploymentErrors(process.env, await readFile(new URL("../email-worker/wrangler.hall-test.toml", import.meta.url), "utf8"));
  if (errors.length) {errors.forEach(value => console.error(value)); process.exitCode = 1;}
  else console.log("TEST target/configuration and owner Free-plan confirmation are present. No plan changes or deployment performed by this check.");
}
