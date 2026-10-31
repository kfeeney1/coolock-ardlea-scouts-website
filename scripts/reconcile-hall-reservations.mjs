import {pathToFileURL} from "node:url";
import {hallAuditEnvironment, readHallJson} from "./audit-hall-reservations.mjs";
import {groupLocalDate} from "../src/services/groupLocalDate.ts";
import {planHallReconciliation, readOperatorSnapshot, applyHallReconciliation} from "./hall-source-reconciliation.mjs";
import {planHallReadiness, publishHallReadiness, revokeHallReadiness} from "./hall-readiness.mjs";
import {planHallTestRehearsal, startHallTestRehearsal, stopHallTestRehearsal, assertRehearsalDeployment} from "./hall-test-rehearsal.mjs";
import {checkTestHallBackend} from "./check-test-hall-backend.mjs";
export function hallControlOptions(argv, env) {
  const values = {};
  for (const arg of argv) {
    const match = /^--(mode|project|manifest|plan|evidence|from|through|commit)=(.+)$/.exec(arg);
    if (!match || Object.hasOwn(values, match[1])) throw new Error("Invalid control options.");
    values[match[1]] = match[2];
  }
  const modes = {plan: ["manifest"], apply: ["manifest", "plan"], "readiness-plan": ["evidence", "from", "through"], publish: ["evidence", "from", "through", "plan"], revoke: [], "rehearsal-plan": ["from", "through", "commit"], "rehearsal-start": ["from", "through", "commit", "plan"], "rehearsal-stop": []};
  if (!Object.hasOwn(modes, values.mode) || !values.project || modes[values.mode].some(key => !values[key]) || Object.keys(values).some(key => !["mode", "project", ...modes[values.mode]].includes(key))) throw new Error("Choose a complete supported mode.");
  const today = groupLocalDate();
  hallAuditEnvironment([`--project=${values.project}`, `--from=${values.from ?? today}`, `--through=${values.through ?? today}`], env);
  const demo = values.project.startsWith("demo-");
  if (demo ? !/^(127\.0\.0\.1|localhost):\d{1,5}$/.test(env.FIREBASE_AUTH_EMULATOR_HOST ?? "") : Boolean(env.FIREBASE_AUTH_EMULATOR_HOST)) throw new Error("Identity verification environment mismatch.");
  if ((["apply", "publish", "revoke"].includes(values.mode) || values.mode.startsWith("rehearsal-")) && !demo && values.project !== "coolock-ardlea-scouts-test") throw new Error("Live Production mutations are not authorised.");
  if (values.plan && !/^[a-f0-9]{64}$/.test(values.plan)) throw new Error("A reviewed plan digest is required.");
  if (values.commit && !/^[a-f0-9]{40}$/.test(values.commit)) throw new Error("The exact reviewed TEST revision is required.");
  return values;
}
export async function deployedTestBuild(evidence, project, fetcher = fetch) {
  if (project.startsWith("demo-")) return {commit: evidence.commit, environment: "local", source: "local"};
  if (project !== "coolock-ardlea-scouts-test") throw new Error("TEST target required.");
  const response = await fetcher("https://coolock-ardlea-scouts-test.web.app/build-info.json", {redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000)});
  if (!response.ok || !response.body) throw new Error("TEST build unavailable.");
  const reader = response.body.getReader(), chunks = []; let length = 0;
  try {
    while (true) {const {done, value} = await reader.read(); if (done) break; length += value.length; if (length > 4096) throw new Error("Invalid build metadata."); chunks.push(value);}
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {await reader.cancel(); reader.releaseLock();}
}
export async function rehearsalDeployment(options, env, fetcher = fetch) {
  const build = await deployedTestBuild({commit: options.commit}, options.project, fetcher);
  const boundary = options.project.startsWith("demo-") ? {project: options.project, workerCommit: options.commit, functionalAcceptance: false} : await checkTestHallBackend({...env, FIREBASE_PROJECT_ID: options.project, EXPECTED_WORKER_SHA: options.commit}, fetcher);
  const result = {...boundary, commit: options.commit, build};
  assertRehearsalDeployment(options.project, result);
  return result;
}
export async function runHallControl(argv, env = process.env) {
  const options = hallControlOptions(argv, env), token = env.HALL_OPERATOR_ID_TOKEN;
  if (typeof token !== "string" || !token || token.length > 16_384) throw new Error("A current operator identity token is required.");
  const manifest = options.manifest ? await readHallJson(options.manifest) : null, evidence = options.evidence ? await readHallJson(options.evidence) : null;
  const {initializeApp, applicationDefault, deleteApp} = await import("firebase-admin/app");
  const {getFirestore} = await import("firebase-admin/firestore"), {getAuth} = await import("firebase-admin/auth");
  const app = initializeApp({projectId: options.project, ...(env.FIRESTORE_EMULATOR_HOST ? {} : {credential: applicationDefault()})}, "hall-control");
  try {
    const claims = await getAuth(app).verifyIdToken(token, true), uid = claims.uid;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error("Unsupported operator identity.");
    const db = getFirestore(app), scope = {from: options.from, through: options.through};
    if (options.mode === "rehearsal-stop") return await stopHallTestRehearsal(db, uid, options.project);
    if (["rehearsal-plan", "rehearsal-start"].includes(options.mode)) {
      const deployment = await rehearsalDeployment(options, env);
      if (options.mode === "rehearsal-start") return await startHallTestRehearsal(db, uid, options.project, scope, deployment, options.plan);
      return await planHallTestRehearsal(await readOperatorSnapshot(db, uid), uid, options.project, scope, deployment);
    }
    if (options.mode === "revoke") return await revokeHallReadiness(db, uid, options.project);
    if (options.mode === "apply") return await applyHallReconciliation(db, uid, manifest, options.plan);
    if (options.mode === "plan") return await planHallReconciliation(await readOperatorSnapshot(db, uid), uid, manifest);
    const build = await deployedTestBuild(evidence, options.project);
    if (options.mode === "publish") return await publishHallReadiness(db, uid, options.project, scope, evidence, build, options.plan);
    return await planHallReadiness(await readOperatorSnapshot(db, uid), uid, options.project, scope, evidence, build);
  } finally {await deleteApp(app);}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {const result = await runHallControl(process.argv.slice(2)); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.canStart === false || result.canApply === false || result.canPublish === false || result.complete === false ? 2 : 0;}
  catch {console.error("Hall control could not complete. Inspect current records and obtain a fresh reviewed plan before resuming. No activation or acceptance is inferred."); process.exitCode = 1;}
}
