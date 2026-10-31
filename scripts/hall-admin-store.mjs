import {hallFailure} from "../email-worker/src/hallBookingModel.js";
import {versionOf} from "./hall-review-policy.mjs";
/** Trusted operator adapter only; no HTTP route. The source engine retains its lock and audit writes. */
export function hallAdminTransaction(db, native) {
    const snapshots = new Map(); let writes = 0;
    const count = () => {if (++writes > 500) throw new Error("Write bound exceeded.");};
    return {
      async read(paths) {
        if (!paths.length) return [];
        const docs = await native.getAll(...paths.map(path => db.doc(path)));
        docs.forEach(doc => snapshots.set(doc.ref.path, doc));
        return docs.map(doc => doc.exists ? doc.data() : null);
      },
      version: path => versionOf(snapshots.get(path)?.updateTime),
      creation: path => versionOf(snapshots.get(path)?.createTime),
      set(path, data) {count(); native.set(db.doc(path), data);},
      create(path, data) {count(); native.create(db.doc(path), data);},
      patch(path, data) {count(); native.update(db.doc(path), data);}
    };
}

export function assertMutationProject(db, project = db.projectId) {
  if (db.projectId !== project || (project !== "coolock-ardlea-scouts-test" && !/^demo-[a-z0-9-]+$/.test(project))) hallFailure(403, "hall/environment", "Operator mutations are restricted to the exact TEST or emulator project.");
}
