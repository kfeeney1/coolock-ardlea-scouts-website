import {HALL_AUDIT_COLLECTIONS, HALL_AUDIT_LIMIT} from "./hall-reconciliation.mjs";
const rows = snapshot => new Map(snapshot.docs.map(doc => [doc.id, doc.data()]));
/** Only read APIs are used. Query limits include one sentinel to reject truncation. */
export function readHallAuditSnapshot(db) {
  return db.runTransaction(async tx => {
    const collections = new Map(), versions = new Map(), evidence = new Map(), truncated = [];
    for (const [path, fields] of Object.entries(HALL_AUDIT_COLLECTIONS)) {
      let query = db.collection(path).limit(HALL_AUDIT_LIMIT + 1);
      if (fields) query = query.select(...fields);
      const snapshot = await tx.get(query);
      if (snapshot.size > HALL_AUDIT_LIMIT) truncated.push(path);
      const docs = snapshot.docs.slice(0, HALL_AUDIT_LIMIT);
      collections.set(path, rows({docs}));
      for (const doc of docs) versions.set(`${path}/${doc.id}`, `${doc.updateTime.seconds}:${doc.updateTime.nanoseconds}`);
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
    return {collections, versions, evidence, truncated};
  }, {readOnly: true});
}
