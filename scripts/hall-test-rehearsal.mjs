import {assertMutationProject} from "./hall-admin-store.mjs";
import {hallFailure} from "../email-worker/src/hallBookingModel.js";
import {groupLocalDate} from "../src/services/groupLocalDate.ts";
import {addHallDays} from "../src/services/hallBookingTime.ts";
import {auditHallReservations} from "./hall-reconciliation.mjs";
import {collectHallAuditSnapshot} from "./hall-reconciliation-reader.mjs";
import {assertOperator, assertStaging, operatorPaths} from "./hall-source-reconciliation.mjs";
import {digest, validVersion} from "./hall-review-policy.mjs";

export function assertRehearsalDeployment(project, deployment, now = Date.now()) {
  const demo = /^demo-[a-z0-9-]+$/.test(project), build = deployment?.build;
  if (!demo && project !== "coolock-ardlea-scouts-test") hallFailure(403, "hall/environment", "Rehearsal is restricted to TEST or loopback emulation.");
  if (!/^[a-f0-9]{40}$/.test(deployment?.commit ?? "") || build?.commit !== deployment.commit
    || build.environment !== (demo ? "local" : "test") || deployment.workerCommit !== deployment.commit
    || deployment.functionalAcceptance !== false || deployment.project !== project
    || (!demo && (build.source !== "github-actions" || !Number.isFinite(Date.parse(build.buildTime)) || Date.parse(build.buildTime) > now))) hallFailure(409, "hall/rehearsal-deployment", "Matching deployed TEST frontend and Worker preflight are required.");
}
/** No acceptance is asserted; complete source reconciliation is still mandatory. */
export async function planHallTestRehearsal(snapshot, uid, project, scope, deployment, now = Date.now()) {
  assertRehearsalDeployment(project, deployment, now);
  assertOperator(snapshot.operator, uid, now); assertStaging(snapshot.collections);
  const today = groupLocalDate(new Date(now));
  if (scope.from !== today || scope.through !== addHallDays(today, 365) || !validVersion(snapshot.readVersion)) hallFailure(400, "hall/readiness-scope", "Review the current full year and complete snapshot.");
  const report = await auditHallReservations(snapshot, {...scope, allIndexedDays: true});
  const state = [...snapshot.collections].map(([path, rows]) => [path, [...rows]]);
  const planDigest = await digest({state, versions: [...snapshot.versions], creations: [...snapshot.creations], uid, project, scope, deployment});
  return {digest: planDigest, canStart: report.consistent, activationApproved: false, acceptanceRecorded: false, manualStopRequired: true, blockers: report.issues};
}
export async function startHallTestRehearsal(db, uid, project, scope, deployment, expectedDigest, now = Date.now()) {
  assertMutationProject(db, project);
  return db.runTransaction(async tx => {
    const operator = (await tx.getAll(...operatorPaths(uid).map(path => db.doc(path)))).map(doc => doc.exists ? doc.data() : null);
    assertOperator(operator, uid, now);
    const snapshot = await collectHallAuditSnapshot(db, tx); snapshot.operator = operator;
    const plan = await planHallTestRehearsal(snapshot, uid, project, scope, deployment, now);
    if (!plan.canStart || plan.digest !== expectedDigest) hallFailure(409, "hall/rehearsal-changed", "Review a fresh reconciled TEST rehearsal plan.");
    const lock = snapshot.collections.get("hall").get("group") ?? {}, revision = (lock.revision ?? 0) + 1, id = String(revision);
    const rehearsal = {id, state: "active", actorUid: uid, commit: deployment.commit};
    const receipt = {rehearsal, project, reconciliationDigest: plan.digest, deployment, at: new Date(now), acceptanceRecorded: false};
    tx.set(db.doc("hall/group"), {...lock, revision, ready: true, testRehearsal: rehearsal});
    tx.set(db.doc("siteSettings/hallHireReadiness"), {ready: true});
    tx.create(db.doc(`hall/group/testRehearsals/${id}`), receipt);
    tx.create(db.doc(`auditLog/hall-rehearsal-start-${revision}`), audit(uid, "start", now));
    return {started: true, session: id, temporaryReadiness: true, rolloutEnabled: false, acceptanceRecorded: false, manualStopRequired: true};
  });
}
function audit(uid, action, now) {
  return {category: "system", action: `hall-test-rehearsal-${action}`, actorUid: uid, actorEmail: "", targetId: "group-hall", targetLabel: "Hall TEST rehearsal", description: action === "start" ? "Opened controlled TEST rehearsal; acceptance pending" : "Stopped TEST rehearsal; rollout off and records retained", section: "Group", createdAt: new Date(now)};
}
/** Emergency shutdown still works after Council revocation; never restore a stale lock snapshot. */
export async function stopHallTestRehearsal(db, uid, project, now = Date.now()) {
  assertMutationProject(db, project);
  return db.runTransaction(async tx => {
    const [profileDoc, lockDoc] = await tx.getAll(db.doc(`adminUsers/${uid}`), db.doc("hall/group"));
    const profile = profileDoc.data(), lock = lockDoc.data() ?? {};
    if (profile?.active !== true || profile.role !== "super-admin") hallFailure(403, "hall/operator", "Current Superuser authority is required.");
    if (!lock.testRehearsal) return {stopped: false, acceptanceRecorded: false};
    const session = lock.testRehearsal;
    if (!/^[1-9][0-9]*$/.test(session.id ?? "") || !["active", "stopped"].includes(session.state) || !Number.isSafeInteger(lock.revision) || lock.revision < 1) hallFailure(409, "hall/index", "Rehearsal metadata requires inspection.");
    if (session.state === "stopped") return {stopped: false, session: session.id, acceptanceRecorded: false};
    const revision = lock.revision + 1, receipt = await tx.get(db.doc(`hall/group/testRehearsals/${session.id}`));
    if (!receipt.exists || receipt.get("rehearsal.id") !== session.id || receipt.get("project") !== project) hallFailure(409, "hall/index", "Rehearsal receipt requires inspection.");
    tx.set(db.doc("hall/group"), {...lock, ready: false, revision, testRehearsal: {...session, state: "stopped"}});
    tx.set(db.doc("siteSettings/hallHireReadiness"), {ready: false});
    tx.set(db.doc("siteSettings/hallHire"), {enabled: false, updatedBy: uid, updatedAt: new Date(now)});
    tx.set(db.doc("siteSettings/hallHirePublic"), {enabled: false});
    tx.create(db.doc(`hall/group/testRehearsals/${session.id}/history/${revision}`), {state: "stopped", actorUid: uid, at: new Date(now), revision, acceptanceRecorded: false});
    tx.create(db.doc(`auditLog/hall-rehearsal-stop-${revision}`), audit(uid, "stop", now));
    return {stopped: true, session: session.id, rolloutEnabled: false, recordsRetained: true, acceptanceRecorded: false};
  });
}
