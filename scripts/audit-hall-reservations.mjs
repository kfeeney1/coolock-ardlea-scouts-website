import {open} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {auditHallReservations, validateHallAuditOptions} from "./hall-reconciliation.mjs";
import {readHallAuditSnapshot} from "./hall-reconciliation-reader.mjs";

export function hallAuditEnvironment(argv, env) {
  const values = {};
  for (const arg of argv) {
    const match = /^--(project|from|through|decisions)=(.+)$/.exec(arg);
    if (!match || Object.hasOwn(values, match[1])) throw new Error("Invalid audit arguments.");
    values[match[1]] = match[2];
  }
  const project = values.project;
  if (!["coolock-ardlea-scouts-test", "coolock-ardlea-scouts"].includes(project) && !/^demo-[a-z0-9-]{1,60}$/.test(project ?? "")) throw new Error("Explicit known project required.");
  if (env.FIRESTORE_EMULATOR_HOST) {
    if (!project.startsWith("demo-") || !/^(127\.0\.0\.1|localhost):\d{1,5}$/.test(env.FIRESTORE_EMULATOR_HOST)) throw new Error("Emulator requires explicit demo project and loopback host.");
  } else if (project.startsWith("demo-")) throw new Error("Demo project requires an emulator.");
  if (env.GCLOUD_PROJECT && env.GCLOUD_PROJECT !== project) throw new Error("Project environment mismatch.");
  validateHallAuditOptions({from: values.from, through: values.through});
  return values;
}
export async function readHallJson(path) {
    const file = await open(path, "r"), chunks = [];
    let length = 0;
    try {
      while (true) {
        const buffer = Buffer.alloc(64_000), {bytesRead} = await file.read(buffer, 0, buffer.length, null);
        if (!bytesRead) break;
        length += bytesRead;
        if (length > 1_000_000) throw new Error("Decision file is too large.");
        chunks.push(buffer.subarray(0, bytesRead));
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } finally {await file.close();}
}
export async function runHallAudit(argv, env) {
  const options = hallAuditEnvironment(argv, env);
  let decisions = [];
  if (options.decisions) {
    decisions = await readHallJson(options.decisions);
  }
  validateHallAuditOptions({...options, decisions});
  // Existing ADC identity is used. No credential parsing, writes, deploys or repair mode.
  const {initializeApp, applicationDefault, deleteApp} = await import("firebase-admin/app");
  const {getFirestore} = await import("firebase-admin/firestore");
  const app = initializeApp({projectId: options.project, ...(env.FIRESTORE_EMULATOR_HOST ? {} : {credential: applicationDefault()})}, "hall-audit");
  try {
    const report = await auditHallReservations(await readHallAuditSnapshot(getFirestore(app)), {...options, decisions});
    return {project: options.project, ...report};
  } finally {await deleteApp(app);}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await runHallAudit(process.argv.slice(2), process.env);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.consistent ? 0 : 2;
  } catch {
    console.error("Hall reconciliation could not complete. Check the explicit project, dates, decision file and read access. No writes were performed.");
    process.exitCode = 1;
  }
}
