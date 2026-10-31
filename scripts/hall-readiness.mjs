import {assertMutationProject} from "./hall-admin-store.mjs";
import {hallFailure} from "../email-worker/src/hallBookingModel.js";
import {groupLocalDate} from "../src/services/groupLocalDate.ts";
import {addHallDays} from "../src/services/hallBookingTime.ts";
import {auditHallReservations} from "./hall-reconciliation.mjs";
import {collectHallAuditSnapshot} from "./hall-reconciliation-reader.mjs";
import {assertOperator, assertStaging, operatorPaths} from "./hall-source-reconciliation.mjs";
import {digest, validVersion} from "./hall-review-policy.mjs";
export const HALL_ACCEPTANCE_CHECKS = ["public-privacy", "authorised-lifecycle", "source-reconciliation", "recurrence-dst", "concurrency-adjacency", "rollout-preservation", "mobile-320", "desktop-keyboard-focus", "themes", "enquiry"];
const sha = value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
export function assertTestEvidence(evidence, project, uid, build, now = Date.now()) {
  const demo = /^demo-[a-z0-9-]+$/.test(project);
  if (!demo && project !== "coolock-ardlea-scouts-test") hallFailure(403, "hall/environment", "Readiness writes are restricted to TEST or emulator projects.");
  const keys = ["schemaVersion", "jira", "environment", "project", "commit", "workerCommit", "verifiedAt", "verifiedByUid", "evidenceUrl", "passedChecks"];
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence) || Object.keys(evidence).some(key => !keys.includes(key)) || evidence.schemaVersion !== 1 || evidence.jira !== "SW-561"
    || evidence.environment !== (demo ? "emulator" : "firebase-test") || evidence.project !== project || evidence.verifiedByUid !== uid || !sha(evidence.commit) || evidence.workerCommit !== evidence.commit
    || !Array.isArray(evidence.passedChecks) || evidence.passedChecks.length !== HALL_ACCEPTANCE_CHECKS.length || new Set(evidence.passedChecks).size !== HALL_ACCEPTANCE_CHECKS.length || HALL_ACCEPTANCE_CHECKS.some(key => !evidence.passedChecks.includes(key))) hallFailure(400, "hall/evidence", "Complete exact-revision SW-561 acceptance evidence is required.");
  const verified = Date.parse(evidence.verifiedAt);
  if (typeof evidence.verifiedAt !== "string" || !Number.isFinite(verified) || new Date(verified).toISOString() !== evidence.verifiedAt || verified > now || now - verified > 86_400_000 || !build || build.commit !== evidence.commit || build.environment !== (demo ? "local" : "test") || (!demo && (build.source !== "github-actions" || !Number.isFinite(Date.parse(build.buildTime)) || Date.parse(build.buildTime) > verified))) hallFailure(409, "hall/evidence", "Acceptance must follow the deployed TEST build and be current.");
  if (demo ? evidence.evidenceUrl !== "emulator://synthetic" : !/^https:\/\/kfeeney1\.atlassian\.net\/browse\/SW-561\?focusedCommentId=\d+$/.test(evidence.evidenceUrl)) hallFailure(400, "hall/evidence", "A recorded SW-561 acceptance reference is required.");
}
export async function planHallReadiness(snapshot, uid, project, scope, evidence, build, now = Date.now()) {
  assertOperator(snapshot.operator, uid, now); assertStaging(snapshot.collections); assertTestEvidence(evidence, project, uid, build, now);
  const today = groupLocalDate(new Date(now));
  if (scope.from !== today || scope.through !== addHallDays(today, 365) || !validVersion(snapshot.readVersion)) hallFailure(400, "hall/readiness-scope", "Review the current full year and a complete current snapshot.");
  const report = await auditHallReservations(snapshot, {...scope, allIndexedDays: true});
  const state = [...snapshot.collections].map(([path, rows]) => [path, [...rows]]);
  const planDigest = await digest({state, versions: [...snapshot.versions], creations: [...snapshot.creations], uid, project, scope, evidence, build});
  return {digest: planDigest, canPublish: report.consistent, activationApproved: false, blockers: report.issues};
}
export async function publishHallReadiness(db, uid, project, scope, evidence, build, expectedDigest, now = Date.now()) {
  assertMutationProject(db, project);
  return db.runTransaction(async tx => {
    const operator = (await tx.getAll(...operatorPaths(uid).map(path => db.doc(path)))).map(doc => doc.exists ? doc.data() : null);
    assertOperator(operator, uid, now);
    const snapshot = await collectHallAuditSnapshot(db, tx);
    snapshot.operator = operator;
    const plan = await planHallReadiness(snapshot, uid, project, scope, evidence, build, now);
    if (!plan.canPublish || plan.digest !== expectedDigest) hallFailure(409, "hall/readiness-changed", "Reconcile and review a new readiness plan before publication.");
    const lock = snapshot.collections.get("hall").get("group") ?? {}, revision = (lock.revision ?? 0) + 1;
    const receipt = {project, actorUid: uid, evidence, evidenceDigest: await digest(evidence), reconciliationDigest: plan.digest, revision, at: new Date(now)};
    tx.set(db.doc("hall/group"), {...lock, revision, ready: true, baselineVersion: lock.baselineVersion ?? snapshot.readVersion});
    tx.set(db.doc("siteSettings/hallHireReadiness"), {ready: true});
    tx.create(db.doc(`hall/group/readiness/${revision}`), receipt);
    tx.create(db.doc(`auditLog/hall-readiness-${revision}`), {category: "system", action: "hall-readiness-publish", actorUid: uid, actorEmail: "", targetId: "group-hall", targetLabel: "Hall readiness", description: "Recorded TEST acceptance and source reconciliation", section: "Group", createdAt: new Date(now)});
    return {published: true, rolloutEnabled: false, revision};
  });
}
export async function revokeHallReadiness(db, uid, project, now = Date.now()) {
  if (project !== "coolock-ardlea-scouts-test" && !/^demo-[a-z0-9-]+$/.test(project)) hallFailure(403, "hall/environment", "Readiness writes are restricted to TEST or emulators.");
  assertMutationProject(db, project);
  return db.runTransaction(async tx => {
    const [profileDoc, lockDoc] = await tx.getAll(db.doc(`adminUsers/${uid}`), db.doc("hall/group"));
    const profile = profileDoc.data(), lock = lockDoc.data() ?? {};
    if (profile?.active !== true || profile.role !== "super-admin") hallFailure(403, "hall/operator", "Current Superuser authority is required.");
    const revision = (lock.revision ?? 0) + 1;
    tx.set(db.doc("hall/group"), {...lock, ready: false, revision}); tx.set(db.doc("siteSettings/hallHireReadiness"), {ready: false});
    tx.create(db.doc(`auditLog/hall-readiness-${revision}`), {category: "system", action: "hall-readiness-revoke", actorUid: uid, actorEmail: "", targetId: "group-hall", targetLabel: "Hall readiness", description: "Revoked readiness; reservations retained", section: "Group", createdAt: new Date(now)});
    return {revoked: true, revision};
  });
}
