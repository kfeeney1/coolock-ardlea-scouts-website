import {versionOf} from "./hall-review-policy.mjs";
import {HALL_AUDIT_COLLECTIONS, HALL_AUDIT_LIMIT} from "./hall-reconciliation.mjs";
const rows = snapshot => new Map(snapshot.docs.map(doc => [doc.id, doc.data()]));
/** Only read APIs are used. Query limits include one sentinel to reject truncation. */
export function readHallAuditSnapshot(db) {
  return db.runTransaction(tx => collectHallAuditSnapshot(db, tx), {readOnly: true});
}
/** Shared collector also supports the readiness publisher’s single write transaction. */
export async function collectHallAuditSnapshot(db, tx) {
    const collections = new Map(), versions = new Map(), creations = new Map(), taskExists = new Set(), reviewEvidence = new Map(), evidence = new Map(), truncated = [];
    let readVersion = "";
    for (const [path, fields] of Object.entries(HALL_AUDIT_COLLECTIONS)) {
      let query = db.collection(path).limit(HALL_AUDIT_LIMIT + 1);
      if (fields) query = query.select(...fields);
      const snapshot = await tx.get(query);
      readVersion ||= versionOf(snapshot.readTime);
      if (snapshot.size > HALL_AUDIT_LIMIT) truncated.push(path);
      const docs = snapshot.docs.slice(0, HALL_AUDIT_LIMIT);
      collections.set(path, rows({docs}));
      for (const doc of docs) {versions.set(`${path}/${doc.id}`, versionOf(doc.updateTime)); creations.set(`${path}/${doc.id}`, versionOf(doc.createTime));}
    }
    const taskIds = [...new Set([...collections.get("maintenance/group/appointments").values()].map(value => value.taskId).filter(id => typeof id === "string" && /^[A-Za-z0-9-]{20,64}$/.test(id)))];
    for (let offset = 0; offset < taskIds.length; offset += 100) {
      const docs = await tx.getAll(...taskIds.slice(offset, offset + 100).map(id => db.doc(`maintenance/group/tasks/${id}`)), {fieldMask: ["status"]});
      docs.forEach(doc => {if (doc.exists) taskExists.add(doc.id);});
    }
    const paths = ["hall/group", "siteSettings/hallHire", "siteSettings/hallHirePublic", "siteSettings/hallHireReadiness"];
    const settings = await tx.getAll(...paths.map(path => db.doc(path)));
    collections.set("hall", new Map()); collections.set("siteSettings", new Map());
    settings.forEach((doc, index) => {if (doc.exists) collections.get(index === 0 ? "hall" : "siteSettings").set(doc.id, doc.data());});
    const heads = [...collections.get("hall/group/bookings")].filter(([id, booking]) => /^[A-Za-z0-9-]{1,100}$/.test(id) && Number.isSafeInteger(booking.revision) && booking.revision > 0);
    for (let offset = 0; offset < heads.length; offset += 100) {
      const chunk = heads.slice(offset, offset + 100);
      const refs = chunk.flatMap(([id, booking]) => [db.doc(`hall/group/bookings/${id}/history/${booking.revision}`), db.doc(`auditLog/hall-${id}-${booking.revision}`)]);
      const docs = await tx.getAll(...refs, {fieldMask: ["next.id", "next.revision", "next.resourceId", "next.kind", "next.state", "next.interval", "next.recurrence", "next.exceptions", "next.source", "actorUid", "at", "action", "targetId"]});
      chunk.forEach(([id], index) => evidence.set(id, {history: docs[index * 2].exists ? docs[index * 2].data() : null, audit: docs[index * 2 + 1].exists ? docs[index * 2 + 1].data() : null}));
    }
    const reviewHeads = [...collections.get("hall/group/sourceReviews")].filter(([id, value]) => /^[A-Za-z0-9-]{1,100}$/.test(id) && Number.isSafeInteger(value.revision) && value.revision > 0);
    for (let offset = 0; offset < reviewHeads.length; offset += 100) {
      const chunk = reviewHeads.slice(offset, offset + 100);
      const refs = chunk.flatMap(([id, value]) => [db.doc(`hall/group/sourceReviews/${id}/history/${value.revision}`), db.doc(`auditLog/hall-review-${id}-${value.revision}`)]);
      const docs = await tx.getAll(...refs, {fieldMask: ["review", "action", "targetId", "actorUid"]});
      chunk.forEach(([id], index) => reviewEvidence.set(id, {history: docs[index * 2].exists ? docs[index * 2].data() : null, audit: docs[index * 2 + 1].exists ? docs[index * 2 + 1].data() : null}));
    }
    return {collections, versions, creations, taskExists, readVersion, evidence, reviewEvidence, truncated};
}
