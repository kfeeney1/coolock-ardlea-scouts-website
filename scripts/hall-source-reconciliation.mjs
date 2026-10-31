import {assertHallCouncil, cleanHallBooking, hallFailure, HallBookingError, occupiedHallDays} from "../email-worker/src/hallBookingModel.js";
import {saveSourceHallReservation, hallSourceIdentity} from "../email-worker/src/hallSourceReservation.js";
import {hallAdminTransaction, assertMutationProject} from "./hall-admin-store.mjs";
import {collectHallAuditSnapshot} from "./hall-reconciliation-reader.mjs";
import {auditHallReservations, validateHallAuditOptions, HALL_AUDIT_LIMIT} from "./hall-reconciliation.mjs";
import {groupLocalDate} from "../src/services/groupLocalDate.ts";
import {addHallDays} from "../src/services/hallBookingTime.ts";
import {digest, equal, sourceKinds, validVersion} from "./hall-review-policy.mjs";
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));
export const operatorPaths = uid => [`adminUsers/${uid}`, `organisationLeadership/${uid}`, "siteSettings/maintenanceExperience", "siteSettings/calendarExperience", `maintenance/group/access/${uid}`];
export function assertOperator(operator, uid, now = Date.now(), maintenance = false) {
  const [profile, organisation, settings, calendar, access] = operator;
  assertHallCouncil(profile, organisation, now);
  if (profile.role !== "super-admin") hallFailure(403, "hall/operator", "Current Superuser and Council authority is required.");
  if (maintenance && (settings?.version !== "redesigned" || settings?.sdkRevision !== 1 || calendar?.version !== "redesigned" || access?.kind !== "leader" || access.sourceId !== uid)) hallFailure(403, "hall/operator", "Current Maintenance and Calendar scope is required.");
}
export function assertStaging(collections) {
  const setting = collections.get("siteSettings"), lock = collections.get("hall")?.get("group");
  if (lock?.testRehearsal && (lock.testRehearsal.state !== "stopped" || !/^[1-9][0-9]*$/.test(lock.testRehearsal.id ?? ""))) hallFailure(409, "hall/rehearsal-active", "Stop the TEST rehearsal before reconciliation or final publication.");
  if ((lock && (!Number.isSafeInteger(lock.revision ?? 0) || (lock.revision ?? 0) < 0 || (lock.baselineVersion !== undefined && !validVersion(lock.baselineVersion)))) || ["hallHire", "hallHirePublic"].some(key => setting?.get(key) && typeof setting.get(key).enabled !== "boolean") || (setting?.get("hallHireReadiness") && typeof setting.get("hallHireReadiness").ready !== "boolean")) hallFailure(409, "hall/index", "Configuration requires reconciliation.");
  if (setting?.get("hallHire")?.enabled === true || setting?.get("hallHirePublic")?.enabled === true || setting?.get("hallHireReadiness")?.ready === true || collections.get("hall")?.get("group")?.ready === true) hallFailure(409, "hall/staging", "Disable rollout/readiness before preactivation reconciliation.");
}
export function validateManifest(manifest) {
  if (!exact(manifest, ["schemaVersion", "from", "through", "decisions"]) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.decisions) || manifest.decisions.length > 100) hallFailure(400, "hall/manifest", "A bounded review manifest is required.");
  try {validateHallAuditOptions({...manifest, decisions: manifest.decisions.map(({path, version, resource}) => ({path, version, resource}))});}
  catch {hallFailure(400, "hall/manifest", "Invalid manifest horizon or source decisions.");}
  for (const value of manifest.decisions) {
    if (!exact(value, value.resource === "group-hall" ? ["path", "version", "resource", "interval"] : ["path", "version", "resource"])) hallFailure(400, "hall/manifest", "Unexpected manifest fields.");
    if (value.resource === "group-hall") {
      if (value.interval?.date < manifest.from || value.interval?.endDate > manifest.through) hallFailure(400, "hall/manifest", "The audit horizon must cover every proposed interval.");
      try {cleanHallBooking({id: "review", resourceId: "group-hall", kind: "internal", state: "confirmed", interval: value.interval, title: "Review", hirerName: "", contact: "", notes: ""});}
      catch {hallFailure(400, "hall/manifest", "Explicit unambiguous Dublin hall times are required.");}
    }
  }
  return manifest;
}
function classify(path) {const offset = path.lastIndexOf("/"); return {collection: path.slice(0, offset), id: path.slice(offset + 1), kind: sourceKinds[path.slice(0, offset)]};}
export function importFields(decision, current, now = Date.now()) {
  const {kind, id} = classify(decision.path), interval = decision.interval;
  if (!(kind === "maintenance" ? /^(?:[a-zA-Z0-9-]{20,64}|task-[a-zA-Z0-9-]{20,64})$/.test(id) : /^[A-Za-z0-9_-]{1,100}$/.test(id))) hallFailure(400, "hall/source", "Unsupported source ID.");
  const revision = kind === "maintenance" ? current.revision : (current.hallRevision ?? 0);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision > 1_000_000 || ![undefined, "", "group-hall"].includes(current.hallResource)) hallFailure(409, "hall/source", "Source metadata requires reconciliation.");
  if (kind === "maintenance" && (current.taskId ? (typeof current.taskId !== "string" || !/^[A-Za-z0-9-]{20,64}$/.test(current.taskId) || id !== `task-${current.taskId}`) : id.startsWith("task-"))) hallFailure(409, "hall/source", "Canonical task ownership is required.");
  if (decision.resource === "none") {
    if (current.hallResource === "group-hall") hallFailure(409, "hall/source-managed", "Release existing hall time through its original source.");
    return null;
  }
  const today = groupLocalDate(new Date(now));
  if (kind === "meeting") {
    if (!(current.status === "open" || (current.status === "closed" && current.meetingDate < today)) || interval.date !== current.meetingDate || interval.endDate !== current.meetingDate) hallFailure(409, "hall/source-schedule", "Use the current meeting date; closed future meetings require their owner workflow.");
    return {hallResource: "group-hall", hallStartTime: interval.startTime, hallEndTime: interval.endTime, hallRevision: (current.hallRevision ?? 0) + 1};
  }
  if (kind === "event") {
    if (!(["open", "closed"].includes(current.status) || (current.status === "completed" && current.endDate < today)) || interval.date < current.startDate || interval.endDate > current.endDate) hallFailure(409, "hall/source-schedule", "Hall time must remain inside the event; future completed sources require their owner workflow.");
    return {hallResource: "group-hall", hallInterval: interval, hallRevision: (current.hallRevision ?? 0) + 1};
  }
  if (kind !== "maintenance" || current.cancelled === true || typeof current.allDay !== "boolean" || !equal(interval, {date: current.date, startTime: current.allDay ? "00:00" : current.startTime, endDate: current.allDay ? addHallDays(current.date, 1) : current.date, endTime: current.allDay ? "00:00" : current.endTime})) hallFailure(409, "hall/source-schedule", "Use the current appointment interval.");
  return {hallResource: "group-hall", revision: (current.revision ?? 0) + 1};
}
function matchesManaged(decision, current, booking) {
  const {kind, collection, id} = classify(decision.path);
  const revision = kind === "maintenance" ? current.revision : (current.hallRevision ?? 0);
  if (!Number.isSafeInteger(revision) || revision < 0 || (booking && (booking.resourceId !== "group-hall" || booking.kind !== (kind === "maintenance" ? "blocked" : "internal") || !equal(booking.source, {collection, id}) || !Number.isSafeInteger(booking.revision) || booking.revision < 1 || booking.recurrence !== undefined || (booking.exceptions?.length ?? 0) !== 0))) return false;
  if (decision.resource === "none") return current.hallResource !== "group-hall" && (!booking || booking.state === "cancelled");
  const interval = kind === "meeting" ? {date: current.meetingDate, startTime: current.hallStartTime, endDate: current.meetingDate, endTime: current.hallEndTime} : kind === "event" ? current.hallInterval : {date: current.date, startTime: current.allDay ? "00:00" : current.startTime, endDate: current.allDay ? addHallDays(current.date, 1) : current.date, endTime: current.allDay ? "00:00" : current.endTime};
  return current.hallResource === "group-hall" && booking?.state === "confirmed" && equal(interval, decision.interval) && equal(booking.interval, interval);
}
export async function readOperatorSnapshot(db, uid) {
  return db.runTransaction(async tx => {
    const operator = (await tx.getAll(...operatorPaths(uid).map(path => db.doc(path)))).map(doc => doc.exists ? doc.data() : null);
    assertOperator(operator, uid);
    const snapshot = await collectHallAuditSnapshot(db, tx);
    snapshot.operator = operator;
    return snapshot;
  }, {readOnly: true});
}
/** No writes: compute a digest-bound plan and detect conflicts across all proposed imports. */
export async function planHallReconciliation(snapshot, uid, manifest, now = Date.now()) {
  validateManifest(manifest); assertOperator(snapshot.operator, uid, now); assertStaging(snapshot.collections);
  const items = [], blockers = [], effective = [], planned = [], newReviews = new Set();
  for (const decision of manifest.decisions) {
    const {collection, id, kind} = classify(decision.path);
    try {
      if (!kind || !(kind === "maintenance" ? /^(?:[a-zA-Z0-9-]{20,64}|task-[a-zA-Z0-9-]{20,64})$/.test(id) : /^[A-Za-z0-9_-]{1,100}$/.test(id))) hallFailure(400, "hall/source", "Unsupported source.");
      assertOperator(snapshot.operator, uid, now, kind === "maintenance");
      const current = snapshot.collections.get(collection)?.get(id), identity = await hallSourceIdentity(kind, id);
      if (!current || !validVersion(snapshot.creations.get(decision.path))) hallFailure(409, "hall/source", "A current source is required.");
      const review = snapshot.collections.get("hall/group/sourceReviews")?.get(identity.bookingId), booking = snapshot.collections.get("hall/group/bookings")?.get(identity.bookingId);
      const operation = await digest(decision), done = review?.operation === operation && review.createdVersion === snapshot.creations.get(decision.path) && matchesManaged(decision, current, booking);
      if (!done && snapshot.versions.get(decision.path) !== decision.version) hallFailure(409, "hall/stale", "Source version changed.");
      if (current.taskId && !snapshot.taskExists.has(current.taskId)) hallFailure(409, "hall/source", "Source task is missing.");
      const managed = current.hallResource === "group-hall" && matchesManaged(decision, current, booking);
      const fields = done || managed ? null : importFields(decision, current, now);
      if (decision.resource === "group-hall" && current.hallResource === "group-hall" && !matchesManaged(decision, current, booking)) hallFailure(409, "hall/source-managed", "Change an existing reservation through its source.");
      const action = done ? "already-applied" : current.hallResource === "group-hall" ? "already-managed" : fields ? "reserve" : "review-none";
      if (["reserve", "review-none"].includes(action) && !review) newReviews.add(identity.bookingId);
      items.push({path: decision.path, action, resource: decision.resource, version: decision.version, ...(fields ? {interval: decision.interval} : {})});
      effective.push({path: decision.path, version: snapshot.versions.get(decision.path), resource: decision.resource});
      if (action === "reserve") planned.push({id: identity.bookingId, resourceId: "group-hall", kind: kind === "maintenance" ? "blocked" : "internal", state: "confirmed", interval: decision.interval});
    } catch (error) {blockers.push({path: decision.path, code: error instanceof HallBookingError ? error.code : "hall/source"});}
  }
  const report = await auditHallReservations(snapshot, {...manifest, decisions: effective});
  const imports = new Set(items.filter(item => item.action === "reserve").map(item => item.path));
  blockers.push(...report.issues.filter(issue => !(issue.code === "confirmed-hall-needs-reservation" && imports.has(issue.path))));
  if ((snapshot.collections.get("hall/group/bookings")?.size ?? 0) + planned.filter(value => !snapshot.collections.get("hall/group/bookings")?.has(value.id)).length > HALL_AUDIT_LIMIT || (snapshot.collections.get("hall/group/sourceReviews")?.size ?? 0) + newReviews.size > HALL_AUDIT_LIMIT) blockers.push({path: "hall/group", code: "hall/scan-bound"});
  const slots = new Map(); let expanded = 0;
  reservations: for (const value of [...(snapshot.collections.get("hall/group/bookings")?.values() ?? []), ...planned]) {
    if (blockers.some(item => ["scan-limit", "expansion-limit", "invalid-booking"].includes(item.code))) break;
    try {
      for (const [date, values] of occupiedHallDays(value)) {
        expanded += values.length;
        if (expanded > 20_000) {blockers.push({path: "hall/group/bookings", code: "expansion-limit"}); break reservations;}
        const previous = slots.get(date) ?? [];
        if (values.some(slot => previous.some(other => slot.start < other.end && other.start < slot.end))) blockers.push({path: "hall/group/bookings", code: "hall/conflict"});
        slots.set(date, [...previous, ...values]);
      }
    } catch {blockers.push({path: "hall/group/bookings", code: "hall/index"});}
  }
  const state = [...snapshot.collections].map(([path, rows]) => [path, [...rows]]);
  const planDigest = await digest({manifest, uid, state, versions: [...snapshot.versions], creations: [...snapshot.creations], taskExists: [...snapshot.taskExists]});
  return {schemaVersion: 1, digest: planDigest, canApply: blockers.length === 0, activationApproved: false, items, blockers};
}
/** Trusted verified-identity operator only. Not registered in the public Worker. */
export async function applyHallDecision(db, uid, decision, now = Date.now()) {
  assertMutationProject(db);
  validateManifest({schemaVersion: 1, from: decision.interval?.date ?? "2000-01-01", through: decision.interval?.endDate ?? "2000-01-01", decisions: [decision]});
  const {id, kind} = classify(decision.path), identity = await hallSourceIdentity(kind, id), operation = await digest(decision);
  return db.runTransaction(async native => {
    const tx = hallAdminTransaction(db, native);
    const operator = await tx.read(operatorPaths(uid));
    assertOperator(operator, uid, now, kind === "maintenance");
    const [current, review, previous, lock, setting, safeSetting, readiness] = await tx.read([decision.path, `hall/group/sourceReviews/${identity.bookingId}`, `hall/group/bookings/${identity.bookingId}`, "hall/group", "siteSettings/hallHire", "siteSettings/hallHirePublic", "siteSettings/hallHireReadiness"]);
    assertStaging(new Map([["hall", new Map([["group", lock]])], ["siteSettings", new Map([["hallHire", setting], ["hallHirePublic", safeSetting], ["hallHireReadiness", readiness]])]]));
    if (!current) hallFailure(409, "hall/source", "A current source is required.");
    if (review?.operation === operation && review.createdVersion === tx.creation(decision.path) && matchesManaged(decision, current, previous)) return {path: decision.path, result: "already-applied"};
    if (tx.version(decision.path) !== decision.version) hallFailure(409, "hall/stale", "Source changed after review.");
    if (current.taskId && !(await tx.read([`maintenance/group/tasks/${current.taskId}`]))[0]) hallFailure(409, "hall/source", "Source task is missing.");
    const fields = importFields(decision, current, now);
    if (previous && previous.state !== "cancelled" && current.hallResource !== "group-hall") hallFailure(409, "hall/source-managed", "Existing source ownership requires reconciliation.");
    if (review && (!Number.isSafeInteger(review.revision) || review.revision < 1)) hallFailure(409, "hall/source", "Review history requires reconciliation.");
    if (current.hallResource === "group-hall") {
      if (matchesManaged(decision, current, previous)) return {path: decision.path, result: "already-managed"};
      hallFailure(409, "hall/source-managed", "Use the existing source workflow.");
    }
    const revision = (review?.revision ?? 0) + 1;
    const nextReview = {path: decision.path, createdVersion: tx.creation(decision.path), reviewedVersion: decision.version, resource: decision.resource, revision, actorUid: uid, operation, resultRevision: fields?.hallRevision ?? fields?.revision ?? 0};
    await saveSourceHallReservation({transaction: work => work(tx)}, uid, kind, id, async () => ({authorised: true,
      occupancy: fields ? {resourceId: "group-hall", kind: kind === "maintenance" ? "blocked" : "internal", state: "confirmed", interval: decision.interval} : null,
      persist: () => {
        if (fields) tx.patch(decision.path, {...fields, updatedBy: uid, updatedAt: new Date(now)});
        if (!fields && !previous) tx.set("hall/group", {...lock, revision: (lock?.revision ?? 0) + 1});
        tx.set(`hall/group/sourceReviews/${identity.bookingId}`, nextReview);
        tx.create(`hall/group/sourceReviews/${identity.bookingId}/history/${revision}`, {review: nextReview, at: new Date(now)});
        tx.create(`auditLog/hall-review-${identity.bookingId}-${revision}`, {category: "system", action: "hall-source-review", actorUid: uid, actorEmail: "", targetId: identity.bookingId, targetLabel: "Hall source review", description: "Confirmed canonical source resource review", section: "Group", createdAt: new Date(now)});
      }}), now);
    return {path: decision.path, result: "applied"};
  });
}
export async function applyHallReconciliation(db, uid, manifest, expectedDigest) {
  assertMutationProject(db);
  const plan = await planHallReconciliation(await readOperatorSnapshot(db, uid), uid, manifest);
  if (!plan.canApply || plan.digest !== expectedDigest) hallFailure(409, "hall/plan-changed", "Review a new complete dry-run plan before applying.");
  const results = [];
  for (const decision of manifest.decisions) {
    try {results.push(await applyHallDecision(db, uid, decision));}
    catch (error) {return {complete: false, activationApproved: false, results, remaining: manifest.decisions.slice(results.length).map(value => value.path), failed: {path: decision.path, code: error instanceof HallBookingError ? error.code : "hall/operator-unavailable"}};}
  }
  return {complete: true, activationApproved: false, results, remaining: []};
}
