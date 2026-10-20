import { HttpsError } from "firebase-functions/v2/https";
import { loadEligibleLeaders, selectAssignee } from "./assignment.js";
import { requireMaintenance } from "./request.js";
const root = "maintenance/group/tasks";
export function validateTask(input) {
  if (typeof input?.id !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(input.id)) throw new HttpsError("invalid-argument", "Invalid task reference.");
  if (typeof input.description !== "string" || !input.description.trim() || input.description.trim().length > 8000) throw new HttpsError("invalid-argument", "Enter a task description of up to 8000 characters.");
  if (!Array.isArray(input.documentIds) || input.documentIds.length > 20 || new Set(input.documentIds).size !== input.documentIds.length || input.documentIds.some(id => typeof id !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(id))) throw new HttpsError("invalid-argument", "Choose up to 20 maintenance documents.");
  return { description: input.description.trim(), documentIds: input.documentIds };
}
export async function handleTasks(db, request) {
  const uid = await requireMaintenance(db, request);
  const input = request.data || {};
  if (input.action === "leaders") return {leaders: await loadEligibleLeaders(db)};
  if (input.action === "update") {
    if (typeof input.id !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(input.id) || !["open", "complete"].includes(input.status) || !Number.isSafeInteger(input.revision)) throw new HttpsError("invalid-argument", "Choose a valid task status.");
    const ref = db.doc(`${root}/${input.id}`);
    const task = await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (!current) throw new HttpsError("not-found", "Task no longer exists.");
      if (current.revision !== input.revision) throw new HttpsError("aborted", "Another member changed this task. Reload it before saving.");
      const assignment = selectAssignee(await loadEligibleLeaders(db, tx), input.assigneeUid);
      const updated = {...current, ...assignment, status: input.status, revision: current.revision + 1, updatedBy: uid, updatedAt: Date.now()};
      tx.set(ref, updated);
      return {id: input.id, ...updated};
    });
    return {task};
  }
  if (input.action === "list") {
    let query = db.collection(root).orderBy("createdAt", "desc").limit(50);
    if (input.after) {
      if (typeof input.after !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(input.after)) throw new HttpsError("invalid-argument", "Invalid page reference.");
      const cursor = await db.doc(`${root}/${input.after}`).get();
      if (!cursor.exists) throw new HttpsError("not-found", "Refresh the task list.");
      query = query.startAfter(cursor);
    }
    const tasks = await query.get();
    return {tasks: tasks.docs.map(doc => ({id: doc.id, ...doc.data()})), next: tasks.size === 50 ? tasks.docs.at(-1).id : ""};
  }
  if (input.action === "get") {
    if (typeof input.id !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(input.id)) throw new HttpsError("invalid-argument", "Invalid task reference.");
    const task = await db.doc(`${root}/${input.id}`).get();
    if (!task.exists) throw new HttpsError("not-found", "Task no longer exists.");
    return {task: {id: task.id, ...task.data()}};
  }
  if (input.action === "create") {
    const data = validateTask(input);
    const ref = db.doc(`${root}/${input.id}`);
    await db.runTransaction(async tx => {
      const previous = (await tx.get(ref)).data();
      if (previous) {
        if (previous.createdBy !== uid || previous.description !== data.description || JSON.stringify(previous.documentIds) !== JSON.stringify(data.documentIds)) throw new HttpsError("already-exists", "This task reference is already in use.");
        return;
      }
      for (const id of data.documentIds) {
        if ((await tx.get(db.doc(`maintenance/group/documents/${id}`))).data()?.state !== "ready") throw new HttpsError("failed-precondition", "A linked document is not ready. Refresh the document list.");
      }
      const assignment = selectAssignee(await loadEligibleLeaders(db, tx), input.assigneeUid);
      tx.create(ref, {...data, ...assignment, status: "open", revision: 1, createdBy: uid, createdAt: Date.now(), updatedBy: uid, updatedAt: Date.now()});
    });
    return {id: input.id};
  }
  throw new HttpsError("invalid-argument", "Unknown task action.");
}
